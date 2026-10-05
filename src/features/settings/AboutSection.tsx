import { BookOpen, Info, ShieldCheck } from 'lucide-react';

const VERSION = import.meta.env.VITE_APP_VERSION ?? '—';

/** "אודות": privacy, version, sources and the medical disclaimer. */
export function AboutSection() {
  return (
    <section className="section" style={{ gap: 'var(--space-2)' }} aria-labelledby="set-about">
      <h2 className="section__eyebrow" id="set-about">
        אודות
      </h2>
      <ul className="list" role="list">
        <li>
          <div className="row">
            <span className="row__icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">הנתונים נשמרים רק במכשיר הזה</span>
              <span className="row__sub">אין חשבון, אין שרת ואין שיתוף</span>
            </span>
          </div>
        </li>
        <li>
          <div className="row">
            <span className="row__icon">
              <BookOpen aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">מקורות</span>
              <span className="row__sub">
                טבלאות גדילה: <span className="ltr">WHO Child Growth Standards</span>
              </span>
            </span>
          </div>
        </li>
        <li>
          <div className="row">
            <span className="row__icon">
              <Info aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">גרסה</span>
            </span>
            <span className="row__end ltr num">{VERSION}</span>
          </div>
        </li>
      </ul>
      <p className="disclaimer" style={{ paddingInline: 'var(--space-1)' }}>
        <Info aria-hidden="true" />
        <span>
          BabyMonitor נועדה למעקב אישי. החישובים מבוססים על הנחיות כלליות ואינם תחליף לייעוץ רפואי.
          בכל שאלה או חשש — כדאי להתייעץ עם רופא/ת הילדים או עם אחות טיפת חלב.
        </span>
      </p>
    </section>
  );
}
