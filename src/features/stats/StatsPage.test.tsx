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

function seed(days = 14, split = 7) {
  const s = appStore.getState();
  const baby = s.addBaby({ name: 'נועה', birthDate: '2026-07-01', sex: 'female' });
  // Last `split` complete days: 8 bottles × 100 ml; the days before: 6 × 100 ml.
  for (let d = 1; d <= days; d++) {
    const n = d <= split ? 8 : 6;
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
    expect(screen.queryByRole('radiogroup', { name: 'טווח' })).not.toBeInTheDocument();
  });

  it('shows daily averages with the change vs the previous period', () => {
    seed();
    render(<StatsPage />);
    expect(within(tile('האכלות ביום')).getByText('8')).toBeInTheDocument();
    expect(within(tile('האכלות ביום')).getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('ממוצע יומי · השינוי לעומת 7 הימים הקודמים')).toBeInTheDocument();
    expect(within(tile('בקבוק ביום')).getByText('800')).toBeInTheDocument();
    // Delta = signed value + unit only (counts have no unit); the period is in one caption.
    const visibleDelta = (label: string) => {
      const el = tile(label).querySelector('.stat__delta')?.cloneNode(true) as
        HTMLElement | undefined;
      el?.querySelector('.visually-hidden')?.remove();
      return el?.textContent.trim();
    };
    expect(visibleDelta('בקבוק ביום')).toBe('+200 מ״ל');
    expect(visibleDelta('האכלות ביום')).toBe('+2');
    // Zero change → "ללא שינוי" with no trend icon.
    expect(visibleDelta('הנקה ביום')).toBe('ללא שינוי');
    expect(tile('הנקה ביום').querySelector('.stat__delta svg')).toBeNull();
    expect(tile('בקבוק ביום').querySelector('.stat__delta svg')).not.toBeNull();
    // Screen readers still hear the comparison.
    expect(tile('בקבוק ביום').querySelector('.stat__delta')).toHaveTextContent(
      'לעומת 7 הימים הקודמים',
    );
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

  it('captions the comparison period once, per range', async () => {
    seed(28, 14);
    const user = userEvent.setup();
    render(<StatsPage />);
    await user.click(screen.getByRole('radio', { name: '14 ימים' }));
    expect(tile('בקבוק ביום').querySelector('.stat__delta')).toHaveTextContent(/^\+200 מ״ל/);
    expect(screen.getByText('ממוצע יומי · השינוי לעומת 14 הימים הקודמים')).toBeInTheDocument();
  });

  it('shows the bottle guideline band only for a mainly bottle-fed baby', () => {
    const baby = seed();
    appStore.getState().addMeasurement({ babyId: baby.id, date: '2026-10-01', weightG: 5000 });
    const { unmount } = render(<StatsPage />);
    expect(screen.getByText('טווח מומלץ (בקבוק בלבד)')).toBeInTheDocument();
    unmount();
    // Mixed feeding: a breastfeed today → no ml target (DESIGN §6.20).
    appStore.getState().addEntry({
      babyId: baby.id,
      type: 'breast',
      startedAt: NOW - 3_600_000,
      endedAt: NOW - 3_000_000,
      segments: [{ side: 'left', startedAt: NOW - 3_600_000, endedAt: NOW - 3_000_000 }],
    });
    render(<StatsPage />);
    expect(screen.getByRole('heading', { name: 'כמות בקבוק יומית' })).toBeInTheDocument();
    expect(screen.queryByText('טווח מומלץ (בקבוק בלבד)')).not.toBeInTheDocument();
    expect(screen.queryByText(/לפי כ-150 מ״ל לק״ג/)).not.toBeInTheDocument();
  });

  it('respects the volume unit', () => {
    seed();
    appStore.getState().updateSettings({ volumeUnit: 'oz' });
    render(<StatsPage />);
    expect(within(tile('בקבוק ביום')).getByText('27.1')).toBeInTheDocument();
    expect(tile('בקבוק ביום').querySelector('.stat__unit')).toHaveTextContent('oz');
    expect(tile('בקבוק ביום').querySelector('.stat__delta')).toHaveTextContent(/^\+6.8 oz/);
  });
});
