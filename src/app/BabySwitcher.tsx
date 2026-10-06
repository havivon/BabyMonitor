import { Check, ChevronDown, Heart, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { formatAge } from '../domain/age';
import type { Baby } from '../domain/types';
import { useNow } from '../hooks/useNow';
import { he } from '../i18n/he';
import { appStore, selectAllTimers, useActiveBaby, useAppStore } from '../store';

const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

function Avatar({ baby, index }: { baby: Baby; index: number }) {
  return (
    <span className={`avatar${index % 2 ? ' avatar--alt' : ''}`} aria-hidden="true">
      {initialOf(baby.name)}
    </span>
  );
}

/**
 * Header baby switcher (DESIGN §6.24): avatar + name + age; opens a sheet listing all babies
 * (radio rows) plus "הוספת ילד/ה" (→ the add-baby flow).
 */
export function BabySwitcher() {
  const baby = useActiveBaby();
  const babies = useAppStore((s) => s.babies);
  const timers = useAppStore(selectAllTimers);
  const now = useNow(60_000);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!baby) return null;

  const index = babies.findIndex((b) => b.id === baby.id);
  const age = formatAge(baby.birthDate, now);

  return (
    <>
      <button
        type="button"
        className="baby-switch"
        aria-haspopup="dialog"
        aria-label={`${he.switcher.label}: ${he.switcher.current(baby.name, age)}`}
        onClick={() => setOpen(true)}
      >
        <Avatar baby={baby} index={index} />
        <span className="baby-switch__text">
          <span className="baby-switch__name truncate">{baby.name}</span>
          {age && <span className="baby-switch__age truncate">{age}</span>}
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={he.switcher.title}>
        <div className="list" role="radiogroup" aria-label={he.switcher.title}>
          {babies.map((b, i) => {
            const selected = b.id === baby.id;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="row"
                onClick={() => {
                  appStore.getState().setActiveBaby(b.id);
                  setOpen(false);
                }}
              >
                <Avatar baby={b} index={i} />
                <span className="row__body">
                  <span className="row__title">{b.name}</span>
                  <span className="row__sub">{formatAge(b.birthDate, now)}</span>
                </span>
                <span className="row__end">
                  {timers[b.id] && (
                    <span className="badge badge--breast">
                      <Heart aria-hidden="true" />
                      {he.timer.title}
                    </span>
                  )}
                  {selected && (
                    <span className="badge badge--primary">
                      <Check aria-hidden="true" />
                      {he.switcher.selected}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="list">
          <button
            type="button"
            className="row row--primary"
            onClick={() => {
              setOpen(false);
              void navigate('/onboarding');
            }}
          >
            <span className="row__icon" aria-hidden="true">
              <Plus />
            </span>
            <span className="row__body">
              <span className="row__title">{he.switcher.add}</span>
            </span>
          </button>
        </div>
      </Sheet>
    </>
  );
}
