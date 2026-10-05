import { AppHeader } from '../../app/AppHeader';
import { AboutSection } from './AboutSection';
import { BabiesSection } from './BabiesSection';
import { DataSection } from './DataSection';
import { PreferencesSection } from './PreferencesSection';

/** Settings screen (DESIGN §7.9). */
export function SettingsPage() {
  return (
    <>
      <AppHeader title="הגדרות" />
      <main className="page" style={{ gap: 'var(--space-5)' }}>
        <BabiesSection />
        <PreferencesSection />
        <DataSection />
        <AboutSection />
      </main>
    </>
  );
}
