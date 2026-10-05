import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/toast';
import { appStore } from '../../store';
import { local } from '../../test/helpers';
import { GrowthPage } from './GrowthPage';

const NOW = local(2026, 10, 5, 10);

function setup(birthWeightG?: number) {
  const baby = appStore.getState().addBaby({
    name: 'נועה',
    birthDate: '2026-06-01',
    sex: 'female',
    ...(birthWeightG ? { birthWeightG } : {}),
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

  it('renders the percentile summary, birth row and flags with warm copy', async () => {
    vi.setSystemTime(local(2026, 6, 6, 10)); // day 5
    const { baby } = setup(3500);
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-06-05', weightG: 3100 });
    expect(await screen.findByText('ירידה של 11.4% ממשקל הלידה')).toBeInTheDocument();
    expect(screen.getByText(/מצדיקה בדיקה. כדאי להתייעץ עם רופא\/ת הילדים/)).toBeInTheDocument();
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

  it('shows the milk guideline card for a young baby with a weight', async () => {
    const { baby } = setup(3300);
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-10-01', weightG: 5000 });
    expect(await screen.findByText('כמות חלב יומית משוערת')).toBeInTheDocument();
    expect(screen.getByText('600–900')).toBeInTheDocument();
  });
});
