import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appStore,
  enableCrossTabSync,
  useActiveBaby,
  useActiveEntries,
  useActiveMeasurements,
  useActiveTimer,
  useAppStore,
  useSettings,
} from './hooks';
import { STORAGE_KEY } from './persistence';

beforeEach(() => {
  appStore.getState().resetAll();
  localStorage.clear();
});

describe('store hooks', () => {
  it('expose active-baby slices and re-render on change', () => {
    const { result } = renderHook(() => ({
      baby: useActiveBaby(),
      entries: useActiveEntries(),
      measurements: useActiveMeasurements(),
      timer: useActiveTimer(),
      settings: useSettings(),
    }));
    expect(result.current.baby).toBeNull();
    act(() => {
      const baby = appStore
        .getState()
        .addBaby({ name: 'נועה', birthDate: '2026-06-01', sex: 'female' });
      appStore.getState().addEntry({
        babyId: baby.id,
        type: 'bottle',
        at: Date.now(),
        content: 'formula',
        amountMl: 90,
      });
      appStore.getState().startTimer(baby.id, 'left');
    });
    expect(result.current.baby?.name).toBe('נועה');
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.measurements).toEqual([]);
    expect(result.current.timer?.segments[0]?.side).toBe('left');
    expect(result.current.settings.volumeUnit).toBe('ml');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('נועה');
  });

  it('does not loop on derived arrays (stable selector output)', () => {
    let renders = 0;
    function Probe() {
      renders++;
      const entries = useActiveEntries();
      const count = useAppStore((s) => s.babies.length);
      return <p>{`${entries.length}/${count}`}</p>;
    }
    render(<Probe />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(renders).toBeLessThanOrEqual(2);
  });

  it('rehydrates when another tab writes the storage key', () => {
    const stop = enableCrossTabSync(appStore);
    const payload = JSON.stringify({
      version: 1,
      state: {
        babies: [
          {
            id: 'x',
            name: 'מכרטיסייה אחרת',
            birthDate: '2026-01-01',
            sex: 'male',
            createdAt: 1_790_000_000_000,
          },
        ],
        entries: [],
        measurements: [],
        activeTimers: {},
        settings: { volumeUnit: 'ml', weightUnit: 'kg', theme: 'auto', activeBabyId: 'x' },
      },
    });
    localStorage.setItem(STORAGE_KEY, payload);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(appStore.getState().babies[0]?.id).toBe('x');
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    stop();
  });
});
