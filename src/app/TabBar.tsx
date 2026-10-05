import { ChartColumn, History, House, Settings, Sprout, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { he } from '../i18n/he';

const TABS: readonly { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: he.tab.home, Icon: House },
  { to: '/history', label: he.tab.history, Icon: History },
  { to: '/growth', label: he.tab.growth, Icon: Sprout },
  { to: '/stats', label: he.tab.stats, Icon: ChartColumn },
  { to: '/settings', label: he.tab.settings, Icon: Settings },
];

/** Bottom tab bar; DOM order = RTL reading order (בית is right-most). `aria-current="page"` via NavLink. */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label={he.nav.label}>
      <div className="tabbar__inner">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="tabbar__item">
            <span className="tabbar__icon">
              <Icon aria-hidden="true" />
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
