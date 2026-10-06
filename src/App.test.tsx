import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { appStore } from './store';
import { seedStore } from './test/harness';

beforeEach(() => {
  appStore.getState().resetAll();
  window.location.hash = '';
});

describe('App shell', () => {
  it('redirects a first run (no baby) to onboarding, then lands on Home', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ברוכים הבאים ל-BabyMonitor' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#/onboarding');
    expect(screen.queryByRole('navigation', { name: 'ניווט ראשי' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('שם'), { target: { value: ' נועה ' } });
    fireEvent.change(screen.getByLabelText('תאריך לידה'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('radio', { name: 'בת' }));
    fireEvent.change(screen.getByLabelText(/משקל לידה/), { target: { value: '3,3' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחלה' }));

    expect(await screen.findByText('עוד לא נרשמו האכלות')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
    const { babies, measurements } = appStore.getState();
    expect(babies).toMatchObject([
      { name: 'נועה', birthDate: '2026-07-01', sex: 'female', birthWeightG: 3300 },
    ]);
    expect(measurements).toEqual([]); // birth weight lives only on the baby (single source)
  });

  it('onboarding validation shows Hebrew errors and focuses the first invalid field', async () => {
    window.location.hash = '#/onboarding';
    render(<App />);
    const name = await screen.findByLabelText('שם');
    fireEvent.submit(name.closest('form')!);
    expect(screen.getByText('יש להזין שם')).toBeInTheDocument();
    expect(screen.getByText('יש לבחור תאריך לידה')).toBeInTheDocument();
    expect(screen.getByText('יש לבחור מין לחישוב האחוזונים')).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(appStore.getState().babies).toHaveLength(0);
  });

  it.each([
    ['#/history', 'היסטוריה'],
    ['#/settings', 'הגדרות'],
    ['#/stats', 'סטטיסטיקה'],
    ['#/growth', 'גדילה'],
  ])('route %s renders its page and marks its tab current', async (hash, title) => {
    seedStore();
    window.location.hash = hash;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
    expect(within(nav).getByRole('link', { name: title })).toHaveAttribute('aria-current', 'page');
  });

  it('unknown routes fall back to Home', async () => {
    seedStore();
    window.location.hash = '#/nope';
    render(<App />);
    expect(await screen.findByRole('button', { name: /החלפת ילד\/ה/ })).toBeInTheDocument();
  });

  it('shows the active-timer banner on every tab; it opens the timer and hides meanwhile', async () => {
    const baby = seedStore();
    act(() => appStore.getState().startTimer(baby.id, 'right'));
    window.location.hash = '#/history';
    const { container } = render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'היסטוריה' });
    expect(container.querySelector('.app')).toHaveClass('app--has-timer');
    fireEvent.click(screen.getByRole('button', { name: 'פתיחת טיימר ההנקה' }));
    expect(screen.getByRole('dialog', { name: 'הנקה' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'פתיחת טיימר ההנקה' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'מזעור — הטיימר ימשיך לפעול' }));
    expect(screen.getByRole('button', { name: 'פתיחת טיימר ההנקה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'השהיית ההנקה' }));
    expect(screen.getByText('הנקה מושהית · ימין')).toBeInTheDocument();
  });
});
