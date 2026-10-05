import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

function Clock({ interval }: { interval?: number }) {
  return <span>{useNow(interval)}</span>;
}

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  vi.useRealTimers();
});

const setVisibility = (v: DocumentVisibilityState): void => {
  visibility = v;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('useNow', () => {
  it('ticks on the interval boundary', () => {
    render(<Clock />);
    expect(screen.getByText('1000000')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('1001000')).toBeInTheDocument();
  });

  it('pauses while hidden and catches up immediately when visible', () => {
    render(<Clock interval={30_000} />);
    setVisibility('hidden');
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(screen.getByText('1000000')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('visible');
    expect(screen.getByText('1120000')).toBeInTheDocument();
  });
});
