import { AppHeader } from '../../app/AppHeader';
import { AccountSection } from '../account/AccountSection';
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
        {/* Accounts & family (engineer #2, docs/ACCOUNTS.md §6) — renders nothing until configured. */}
        <AccountSection />
        <BabiesSection />
        <PreferencesSection />
        <DataSection />
        <AboutSection />
      </main>
    </>
  );
}
