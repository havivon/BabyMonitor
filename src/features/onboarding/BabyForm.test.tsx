import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { BabyForm } from './BabyForm';

const length = (): HTMLElement => screen.getByLabelText(/^אורך לידה/);
const head = (): HTMLElement => screen.getByLabelText(/^היקף ראש בלידה/);
const type = (el: HTMLElement, value: string): void => {
  fireEvent.change(el, { target: { value } });
  fireEvent.blur(el);
};
const save = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
};

function renderForm(initial?: Parameters<typeof BabyForm>[0]['initial']) {
  const onSubmit = vi.fn();
  render(
    <BabyForm
      submitLabel="שמירה"
      onSubmit={onSubmit}
      initial={{ name: 'נועה', birthDate: '2026-07-01', sex: 'female', ...initial }}
    />,
  );
  return onSubmit;
}

beforeEach(() => {
  appStore.getState().resetAll();
});

describe('BabyForm — birth length and head circumference', () => {
  it('are optional cm fields next to birth weight, with the hospital-summary hint', () => {
    const onSubmit = renderForm();
    expect(length()).toHaveAccessibleDescription('מופיע בסיכום מבית החולים');
    expect(head()).toHaveAccessibleDescription('מופיע בסיכום מבית החולים');
    const follows = (a: HTMLElement, b: HTMLElement): boolean =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(screen.getByLabelText(/^משקל לידה/), length())).toBe(true);
    expect(follows(length(), head())).toBe(true);
    save();
    expect(onSubmit).toHaveBeenCalledWith({ name: 'נועה', birthDate: '2026-07-01', sex: 'female' });
  });

  it.each([
    ['34.9', 'אורך הלידה צריך להיות בין 35 ל-65 ס״מ'],
    ['65.1', 'אורך הלידה צריך להיות בין 35 ל-65 ס״מ'],
    ['abc', 'אורך הלידה צריך להיות בין 35 ל-65 ס״מ'],
  ])('length %s is rejected on blur and blocks saving', (value, message) => {
    const onSubmit = renderForm();
    type(length(), value);
    expect(length()).toHaveAccessibleDescription(message);
    expect(length()).toHaveAttribute('aria-invalid', 'true');
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(length()).toHaveFocus();
  });

  it.each(['24.9', '45.1'])('head %s is rejected', (value) => {
    const onSubmit = renderForm();
    type(head(), value);
    expect(head()).toHaveAccessibleDescription('היקף הראש בלידה צריך להיות בין 25 ל-45 ס״מ');
    save();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts the range edges and a decimal comma; submits whole millimetres', () => {
    const onSubmit = renderForm();
    type(length(), '49,5');
    type(head(), '25');
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ birthLengthMm: 495, birthHeadMm: 250 }),
    );
    onSubmit.mockClear();
    type(length(), '65');
    type(head(), '45');
    save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ birthLengthMm: 650, birthHeadMm: 450 }),
    );
  });

  it('edit: shows the saved values in cm; a cleared field is sent as undefined (removed)', () => {
    const onSubmit = renderForm({ birthWeightG: 3300, birthLengthMm: 502, birthHeadMm: 345 });
    expect(length()).toHaveValue('50.2');
    expect(head()).toHaveValue('34.5');
    type(head(), '');
    type(screen.getByLabelText(/^משקל לידה/), '');
    save();
    const data = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(data.birthLengthMm).toBe(502);
    expect(data).toHaveProperty('birthHeadMm', undefined);
    expect(data).toHaveProperty('birthWeightG', undefined);
  });
});
