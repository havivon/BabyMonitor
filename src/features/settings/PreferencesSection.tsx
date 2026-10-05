import { Milk, SunMoon, Weight } from 'lucide-react';
import type { ThemePreference, VolumeUnit, WeightUnit } from '../../domain/types';
import { appStore, useSettings } from '../../store';
import { Segmented } from '../growth/ui/Segmented';

const VOLUME = [
  { value: 'ml', label: 'מ״ל', ariaLabel: 'מיליליטר' },
  { value: 'oz', label: 'oz', ariaLabel: 'אונקיות' },
] as const satisfies readonly { value: VolumeUnit; label: string; ariaLabel: string }[];
const WEIGHT = [
  { value: 'kg', label: 'ק״ג', ariaLabel: 'קילוגרם' },
  { value: 'lb', label: 'lb', ariaLabel: 'ליברות' },
] as const satisfies readonly { value: WeightUnit; label: string; ariaLabel: string }[];
const THEME = [
  { value: 'auto', label: 'אוטומטי' },
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** "יחידות ותצוגה": volume / weight units and theme. */
export function PreferencesSection() {
  const { volumeUnit, weightUnit, theme } = useSettings();
  const update = appStore.getState().updateSettings;
  return (
    <section className="section" style={{ gap: 'var(--space-2)' }} aria-labelledby="set-units">
      <h2 className="section__eyebrow" id="set-units">
        יחידות ותצוגה
      </h2>
      <ul className="list" role="list">
        <li>
          <div className="row">
            <span className="row__icon">
              <Milk aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">נפח</span>
            </span>
            <Segmented
              size="inline"
              label="יחידת נפח"
              options={VOLUME}
              value={volumeUnit}
              onChange={(v) => {
                update({ volumeUnit: v });
              }}
            />
          </div>
        </li>
        <li>
          <div className="row">
            <span className="row__icon">
              <Weight aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">משקל</span>
            </span>
            <Segmented
              size="inline"
              label="יחידת משקל"
              options={WEIGHT}
              value={weightUnit}
              onChange={(v) => {
                update({ weightUnit: v });
              }}
            />
          </div>
        </li>
        <li>
          <div className="row row--wrap">
            <span className="row__icon">
              <SunMoon aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">ערכת נושא</span>
            </span>
            <Segmented
              label="ערכת נושא"
              options={THEME}
              value={theme}
              onChange={(v) => {
                update({ theme: v });
              }}
            />
          </div>
        </li>
      </ul>
    </section>
  );
}
