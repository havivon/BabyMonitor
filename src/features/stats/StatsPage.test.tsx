import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStore } from '../../store';
import { local } from '../../test/helpers';
import { StatsPage } from './StatsPage';

const NOW = local(2026, 10, 5, 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  appStore.getState().resetAll();
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

function seed() {
  const s = appStore.getState();
  const baby = s.addBaby({ name: 'נועה', birthDate: '2026-07-01', sex: 'female' });
  // Last 7 complete days: 8 bottles × 100 ml; the 7 days before: 6 × 100 ml.
  for (let d = 1; d <= 14; d++) {
    const n = d <= 7 ? 8 : 6;
    for (let i = 0; i < n; i++) {
      s.addEntry({
        babyId: baby.id,
        type: 'bottle',
        at: local(2026, 10, 5 - d, 1 + i * 3),
        content: 'formula',
        amountMl: 100,
      });
    }
  }
  return baby;
}

const tile = (label: string) => screen.getByText(label).closest('.stat') as HTMLElement;

describe('StatsPage', () => {
  it('shows the empty state with fewer than two days of data', () => {
    appStore.getState().addBaby({ name: 'נועה', birthDate: '2026-07-01', sex: 'female' });
    render(<StatsPage />);
    expect(screen.getByText('אין עדיין מספיק נתונים')).toBeInTheDocument();
  });

  it('shows daily averages with the change vs the previous period', () => {
    seed();
    render(<StatsPage />);
    expect(within(tile('האכלות ביום')).getByText('8')).toBeInTheDocument();
    expect(within(tile('האכלות ביום')).getByText('+2')).toBeInTheDocument();
    expect(within(tile('האכלות ביום')).getByText(/מהשבוע הקודם/)).toBeInTheDocument();
    expect(within(tile('בקבוק ביום')).getByText('800')).toBeInTheDocument();
    expect(tile('הנקה ביום').querySelector('.stat__value')).toHaveTextContent('0ד׳');
    expect(screen.getByRole('heading', { name: 'האכלות לפי יום' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'כמות בקבוק יומית' })).toBeInTheDocument();
    // No breastfeeding → that chart is hidden.
    expect(screen.queryByRole('heading', { name: 'זמן הנקה יומי' })).not.toBeInTheDocument();
  });

  it('switches the range', async () => {
    seed();
    const user = userEvent.setup();
    render(<StatsPage />);
    await user.click(screen.getByRole('radio', { name: '14 ימים' }));
    expect(screen.getByRole('radio', { name: '14 ימים' })).toHaveAttribute('aria-checked', 'true');
    // 14 days: (7×8 + 7×6) / 14 = 7 per day; the previous 14 days only had nothing → no delta.
    expect(within(tile('האכלות ביום')).getByText('7')).toBeInTheDocument();
    expect(within(tile('האכלות ביום')).getByText('ממוצע יומי')).toBeInTheDocument();
    expect(within(tile('בקבוק ביום')).getByText('700')).toBeInTheDocument();
  });

  it('respects the volume unit', () => {
    seed();
    appStore.getState().updateSettings({ volumeUnit: 'oz' });
    render(<StatsPage />);
    expect(within(tile('בקבוק ביום')).getByText('27.1')).toBeInTheDocument();
    expect(within(tile('בקבוק ביום')).getByText('oz')).toBeInTheDocument();
  });
});
