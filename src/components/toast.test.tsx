import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastOptions } from './toast';

function Trigger({ opts }: { opts: ToastOptions }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(opts)}>
      show
    </button>
  );
}

const renderWith = (opts: ToastOptions) =>
  render(
    <ToastProvider>
      <Trigger opts={opts} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('toast', () => {
  it('renders in a polite live region and auto-dismisses (3.5 s without action)', () => {
    const { container } = renderWith({ text: 'נשמר' });
    const region = container.querySelector('.toast-region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByRole('status')).toHaveTextContent('נשמר');
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    expect(screen.queryByText('נשמר')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('נשמר')).not.toBeInTheDocument();
  });

  it('runs the action once, closes, and lives 6 s with an action', () => {
    const onAction = vi.fn();
    renderWith({ text: 'הרישום נמחק', actionLabel: 'בטל', onAction });
    fireEvent.click(screen.getByText('show'));
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('הרישום נמחק')).not.toBeInTheDocument();
  });

  it('pauses while hovered and shows one toast at a time', () => {
    renderWith({ text: 'א', durationMs: 1000 });
    fireEvent.click(screen.getByText('show'));
    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('א')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('status'));
    fireEvent.click(screen.getByText('show')); // replaces, restarting the clock
    expect(screen.getAllByRole('status')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('א')).not.toBeInTheDocument();
  });

  it('uses role="alert" for errors and throws outside the provider', () => {
    renderWith({ text: 'שגיאה', variant: 'error' });
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByRole('alert')).toHaveClass('toast--error');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger opts={{ text: 'x' }} />)).toThrow(/ToastProvider/);
  });
});
