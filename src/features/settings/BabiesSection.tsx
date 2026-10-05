import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/toast';
import type { Baby } from '../../domain/types';
import { BabyForm } from '../onboarding/BabyForm';
import { appStore, useAppStore, type NewBaby } from '../../store';
import { formatDateNumeric } from '../growth/ui/format';

type SheetState = { mode: 'add' } | { mode: 'edit'; baby: Baby } | null;

/** "ילדים": list with select / edit / delete and "הוספת ילד/ה" (DESIGN §7.9). */
export function BabiesSection() {
  const babies = useAppStore((s) => s.babies);
  const activeId = useAppStore((s) => s.settings.activeBabyId);
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [toDelete, setToDelete] = useState<Baby | null>(null);

  const open = (state: NonNullable<SheetState>) => {
    setSheet(state);
    setSession((n) => n + 1);
    setSheetOpen(true);
  };
  const close = () => {
    setSheetOpen(false);
  };

  const submit = (data: NewBaby) => {
    if (sheet?.mode === 'edit') {
      appStore.getState().updateBaby(sheet.baby.id, data);
      toast.show({ text: 'הפרטים נשמרו' });
    } else {
      appStore.getState().addBaby(data);
      toast.show({ text: `נוסף פרופיל חדש: ${data.name}` });
    }
    close();
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    appStore.getState().removeBaby(toDelete.id);
    toast.show({ text: `הנתונים של ${toDelete.name} נמחקו` });
    setToDelete(null);
    close();
  };

  return (
    <section className="section" style={{ gap: 'var(--space-2)' }} aria-labelledby="set-babies">
      <h2 className="section__eyebrow" id="set-babies">
        ילדים
      </h2>
      <ul className="list" role="list">
        {babies.map((baby, index) => {
          const active = baby.id === activeId;
          return (
            <li key={baby.id}>
              <div className="row">
                <span className={index % 2 ? 'avatar avatar--alt' : 'avatar'} aria-hidden="true">
                  {baby.name.trim().charAt(0)}
                </span>
                <span className="row__body">
                  <span className="row__title">{baby.name}</span>
                  <span className="row__sub">
                    תאריך לידה: <span className="ltr num">{formatDateNumeric(baby.birthDate)}</span>
                  </span>
                </span>
                <span className="row__end">
                  {active ? (
                    <span className="badge badge--primary">נבחר</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-label={`בחירת ${baby.name}`}
                      onClick={() => {
                        appStore.getState().setActiveBaby(baby.id);
                      }}
                    >
                      בחירה
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    aria-label={`עריכת הפרטים של ${baby.name}`}
                    onClick={() => {
                      open({ mode: 'edit', baby });
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                </span>
              </div>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="row row--primary"
            onClick={() => {
              open({ mode: 'add' });
            }}
          >
            <span className="row__icon">
              <Plus aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">הוספת ילד/ה</span>
            </span>
          </button>
        </li>
      </ul>

      <Sheet
        open={sheetOpen}
        onClose={close}
        title={sheet?.mode === 'edit' ? 'עריכת פרטים' : 'הוספת ילד/ה'}
      >
        {sheet && (
          <BabyForm
            key={session}
            initial={sheet.mode === 'edit' ? sheet.baby : undefined}
            submitLabel={sheet.mode === 'edit' ? 'שמירה' : 'הוספה'}
            onSubmit={submit}
            onCancel={close}
            footerNote={
              sheet.mode === 'edit' ? (
                <button
                  type="button"
                  className="btn btn--ghost-danger btn--block"
                  onClick={() => {
                    setToDelete(sheet.baby);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  מחיקת {sheet.baby.name}
                </button>
              ) : undefined
            }
          />
        )}
      </Sheet>
      <ConfirmDialog
        open={toDelete !== null}
        title={`למחוק את ${toDelete?.name ?? ''}?`}
        text={`כל ההאכלות והמדידות של ${toDelete?.name ?? ''} יימחקו מהמכשיר הזה. אי אפשר לבטל את הפעולה.`}
        confirmLabel={`מחיקת ${toDelete?.name ?? ''}`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => {
          setToDelete(null);
        }}
      />
    </section>
  );
}
