import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/toast';
import { appStore } from '../../store';
import { local } from '../../test/helpers';
import { GrowthPage } from './GrowthPage';

const NOW = local(2026, 10, 5, 10);

function setup(
  birthWeightG?: number,
  birth: { birthLengthMm?: number; birthHeadMm?: number } = {},
) {
  const baby = appStore.getState().addBaby({
    name: 'נועה',
    birthDate: '2026-06-01',
    sex: 'female',
    ...(birthWeightG ? { birthWeightG } : {}),
    ...birth,
  });
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <GrowthPage />
    </ToastProvider>,
  );
  return { baby, user };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  appStore.getState().resetAll();
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined); // Recharts: 0×0 container in jsdom
});
afterEach(() => {
  vi.useRealTimers();
});

describe('GrowthPage', () => {
  it('shows the empty state and opens the add sheet', async () => {
    const { user } = setup();
    expect(screen.getByText('עוד אין מדידות')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'הוספת מדידה' })[1]!);
    expect(screen.getByRole('heading', { name: 'מדידה חדשה' })).toBeInTheDocument();
  });

  it('validates and adds a measurement', async () => {
    const { user, baby } = setup();
    await user.click(screen.getAllByRole('button', { name: 'הוספת מדידה' })[0]!);
    const save = screen.getByRole('button', { name: 'שמירה' });

    await user.click(save);
    expect(screen.getByText('יש להזין לפחות ערך אחד')).toBeInTheDocument();
    const weight = screen.getByLabelText('משקל');
    expect(weight).toHaveFocus();
    expect(weight).toHaveAttribute('aria-invalid', 'true');

    await user.type(weight, '45');
    await user.click(save);
    expect(screen.getByText('המשקל צריך להיות בין 0.5 ל-30 ק״ג')).toBeInTheDocument();

    await user.clear(weight);
    await user.type(weight, '5.82');
    await user.type(screen.getByLabelText(/אורך/), '300');
    await user.click(save);
    expect(screen.getByText('האורך צריך להיות בין 30 ל-120 ס״מ')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/אורך/));
    await user.type(screen.getByLabelText(/אורך/), '59.5');
    await user.click(save);

    expect(appStore.getState().measurements).toEqual([
      {
        id: expect.any(String) as unknown,
        babyId: baby.id,
        date: '2026-10-05',
        weightG: 5820,
        lengthMm: 595,
      },
    ]);
    expect(await screen.findByText('המדידה נשמרה')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getByText('5 באוקטובר 2026')).toBeInTheDocument();
    expect(within(list).getByText('5.82')).toBeInTheDocument();
  });

  it('edits, deletes and restores a measurement (undo)', async () => {
    const { user, baby } = setup(3300);
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-07-01', weightG: 4300 });
    const row = await screen.findByRole('button', { name: 'עריכת מדידה מ-1 ביולי 2026' });
    await user.click(row);
    expect(screen.getByRole('heading', { name: 'עריכת מדידה' })).toBeInTheDocument();
    const weight = screen.getByLabelText('משקל');
    expect(weight).toHaveValue('4.3');
    await user.clear(weight);
    await user.type(weight, '4350');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(appStore.getState().measurements[0]?.weightG).toBe(4350);

    await user.click(screen.getByRole('button', { name: 'עריכת מדידה מ-1 ביולי 2026' }));
    await user.click(screen.getByRole('button', { name: 'מחיקה' }));
    expect(appStore.getState().measurements).toEqual([]);
    await user.click(await screen.findByRole('button', { name: /בטל/ }));
    expect(appStore.getState().measurements[0]?.weightG).toBe(4350);
  });

  it('keeps the stored grams when only the note is edited in lb mode (BUG-007)', async () => {
    const { user, baby } = setup(3300);
    appStore.getState().updateSettings({ weightUnit: 'lb' });
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-07-01', weightG: 3346 });
    await user.click(await screen.findByRole('button', { name: 'עריכת מדידה מ-1 ביולי 2026' }));
    expect(screen.getByLabelText('משקל')).toHaveValue('7.38');
    await user.type(screen.getByLabelText(/הערה/), 'נשקל בטיפת חלב');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(appStore.getState().measurements[0]).toMatchObject({
      weightG: 3346,
      note: 'נשקל בטיפת חלב',
    });
  });

  it('renders the percentile summary, birth row and flags with warm copy', async () => {
    vi.setSystemTime(local(2026, 6, 6, 10)); // day 5
    const { baby } = setup(3500);
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-06-05', weightG: 3100 });
    const title = await screen.findByText(
      (_, el) =>
        el?.className === 'banner__title' && el.textContent === 'ירידה של 11.4% ממשקל הלידה',
    );
    // Numbers inside the Hebrew copy are bidi-isolated in <bdi> (BUG-009).
    expect(title.querySelector('bdi')).toHaveTextContent('11.4');
    expect(screen.getByText(/מצדיקה בדיקה. כדאי להתייעץ עם רופא\/ת הילדים/)).toBeInTheDocument();
    expect(
      [...screen.getByText(/מצדיקה בדיקה/).querySelectorAll('bdi')].map((b) => b.textContent),
    ).toContain('10');
    expect(screen.getByText('משקל לידה')).toBeInTheDocument();
    // Percentile appears once the WHO tables have loaded.
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /^אחוזון \d/ })).toBeInTheDocument();
    });
    expect(screen.getByText(/WHO/, { selector: '.percentile__body span' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /משקל לגיל/ })).toBeInTheDocument();
  });

  it('switches metric and shows a per-metric empty summary', async () => {
    const { user } = setup(3300);
    await user.click(screen.getByRole('radio', { name: 'היקף ראש' }));
    expect(screen.getByRole('radio', { name: 'היקף ראש' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('עוד אין מדידות היקף ראש')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'היקף ראש לגיל' })).toBeInTheDocument();
  });

  it('shows the milk guideline card only for a mainly bottle-fed baby', async () => {
    const { baby } = setup(3300);
    const s = appStore.getState();
    s.addMeasurement({ babyId: baby.id, date: '2026-10-01', weightG: 5120 });
    s.addEntry({
      babyId: baby.id,
      type: 'bottle',
      at: NOW - 3_600_000,
      content: 'formula',
      amountMl: 120,
    });
    expect(await screen.findByText('כמות חלב יומית משוערת')).toBeInTheDocument();
    // 5.12 kg × 120/180 ml ≈ 614/922 ml → shown rounded to 10 ml.
    expect(screen.getByText('610–920')).toBeInTheDocument();
    // A breastfeed in the last 72 h (mixed feeding) → no ml target.
    act(() => {
      appStore.getState().addEntry({
        babyId: baby.id,
        type: 'breast',
        startedAt: NOW - 7_200_000,
        endedAt: NOW - 6_600_000,
        segments: [{ side: 'left', startedAt: NOW - 7_200_000, endedAt: NOW - 6_600_000 }],
      });
    });
    expect(screen.queryByText('כמות חלב יומית משוערת')).not.toBeInTheDocument();
  });

  it('says "ביום הלידה" for a birth-only summary and labels the birth row', async () => {
    setup(3300);
    expect(await screen.findByText(/ביום הלידה/)).toBeInTheDocument();
    expect(screen.queryByText(/בגיל היום הראשון/)).not.toBeInTheDocument();
    expect(screen.getByText('משקל לידה', { selector: '.row__sub' })).toBeInTheDocument();
  });

  it('length/head empty state offers a CTA that opens the sheet focused on that field', async () => {
    const { user } = setup(3300);
    await user.click(screen.getByRole('radio', { name: 'אורך' }));
    await user.click(screen.getByRole('button', { name: 'הוספת מדידת אורך' }));
    expect(screen.getByRole('heading', { name: 'מדידה חדשה' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /אורך/ })).toHaveFocus();
  });

  it('the header button focuses the field of the current tab', async () => {
    const { user } = setup(3300);
    await user.click(screen.getByRole('radio', { name: 'היקף ראש' }));
    await user.click(screen.getAllByRole('button', { name: 'הוספת מדידה' })[0]!);
    expect(screen.getByRole('textbox', { name: /היקף ראש/ })).toHaveFocus();
  });

  it('plots birth length / head from the profile (summary + birth row)', async () => {
    const { user } = setup(undefined, { birthLengthMm: 495, birthHeadMm: 340 });
    // No measurements and no birth weight, but birth length exists → no global empty state.
    expect(screen.queryByText('עוד אין מדידות')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'אורך' }));
    expect(screen.getByText(/אורך לידה · 1 ביוני/)).toBeInTheDocument();
    expect(screen.getByText('אורך לידה', { selector: '.row__sub' })).toBeInTheDocument();
    expect(screen.getAllByText('49.5').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('radio', { name: 'היקף ראש' }));
    expect(screen.getByText('היקף ראש בלידה', { selector: '.row__sub' })).toBeInTheDocument();
  });
});
