import { ChevronLeft, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/toast';
import {
  backupFileName,
  feedingsToCsv,
  measurementsToCsv,
  parseBackup,
  serializeBackup,
  type BackupData,
} from '../../domain/backup';
import { toDateKey } from '../../domain/dates';
import { appStore, selectBackupData } from '../../store';
import { downloadText } from './download';
import { IMPORT_ERROR_TEXT } from './importMessages';

type Step = { kind: 'import'; data: BackupData } | { kind: 'wipe1' } | { kind: 'wipe2' } | null;

/** "גיבוי ונתונים": JSON backup export/import, CSV export and delete-all (DESIGN §7.9). */
export function DataSection() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(null);

  const exportJson = () => {
    const now = Date.now();
    downloadText(
      backupFileName(now),
      serializeBackup(selectBackupData(appStore.getState()), now),
      'application/json',
    );
    toast.show({ text: 'קובץ הגיבוי נשמר' });
  };

  const exportCsv = (kind: 'feedings' | 'measurements') => {
    const { entries, measurements, babies } = appStore.getState();
    const stamp = toDateKey(Date.now());
    if (kind === 'feedings') {
      downloadText(
        `babymonitor-feedings-${stamp}.csv`,
        feedingsToCsv(entries, babies),
        'text/csv;charset=utf-8',
      );
    } else {
      downloadText(
        `babymonitor-measurements-${stamp}.csv`,
        measurementsToCsv(measurements, babies),
        'text/csv;charset=utf-8',
      );
    }
    toast.show({ text: 'קובץ הגיליון נשמר' });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.show({ text: IMPORT_ERROR_TEXT.READ_FAILED, variant: 'error' });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      toast.show({ text: IMPORT_ERROR_TEXT[result.error.code], variant: 'error' });
      return;
    }
    setStep({ kind: 'import', data: result.data });
  };

  const importSummary = (data: BackupData): string => {
    const parts = [
      `${data.babies.length} ${data.babies.length === 1 ? 'ילד/ה' : 'ילדים'}`,
      `${data.entries.length} רישומי האכלה`,
      `${data.measurements.length} מדידות`,
    ];
    return `הייבוא יחליף את כל הנתונים שבמכשיר בנתונים מהקובץ (${parts.join(', ')}).`;
  };

  return (
    <section className="section" style={{ gap: 'var(--space-2)' }} aria-labelledby="set-data">
      <h2 className="section__eyebrow" id="set-data">
        גיבוי ונתונים
      </h2>
      <ul className="list" role="list">
        <li>
          <button type="button" className="row" onClick={exportJson}>
            <span className="row__icon">
              <Download aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">ייצוא גיבוי</span>
              <span className="row__sub">קובץ JSON לשמירה או להעברה למכשיר אחר</span>
            </span>
            <span className="row__end">
              <ChevronLeft aria-hidden="true" />
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="row" onClick={() => fileInput.current?.click()}>
            <span className="row__icon">
              <Upload aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">ייבוא מגיבוי</span>
              <span className="row__sub">מחליף את כל הנתונים במכשיר</span>
            </span>
            <span className="row__end">
              <ChevronLeft aria-hidden="true" />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="בחירת קובץ גיבוי"
            data-testid="backup-file-input"
            onChange={(e) => {
              void onFile(e);
            }}
          />
        </li>
        <li>
          <button
            type="button"
            className="row"
            onClick={() => {
              exportCsv('feedings');
            }}
          >
            <span className="row__icon">
              <FileSpreadsheet aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">ייצוא האכלות לגיליון (CSV)</span>
            </span>
            <span className="row__end">
              <ChevronLeft aria-hidden="true" />
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="row"
            onClick={() => {
              exportCsv('measurements');
            }}
          >
            <span className="row__icon">
              <FileSpreadsheet aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">ייצוא מדידות לגיליון (CSV)</span>
            </span>
            <span className="row__end">
              <ChevronLeft aria-hidden="true" />
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="row row--danger"
            onClick={() => {
              setStep({ kind: 'wipe1' });
            }}
          >
            <span className="row__icon">
              <Trash2 aria-hidden="true" />
            </span>
            <span className="row__body">
              <span className="row__title">מחיקת כל הנתונים</span>
            </span>
          </button>
        </li>
      </ul>

      <ConfirmDialog
        open={step?.kind === 'import'}
        title="לייבא את הגיבוי?"
        text={step?.kind === 'import' ? importSummary(step.data) : ''}
        confirmLabel="ייבוא והחלפה"
        danger
        icon={<Upload aria-hidden="true" />}
        onConfirm={() => {
          if (step?.kind === 'import') appStore.getState().importBackup(step.data);
          setStep(null);
          toast.show({ text: 'הגיבוי יובא בהצלחה' });
        }}
        onCancel={() => {
          setStep(null);
        }}
      />
      <ConfirmDialog
        open={step?.kind === 'wipe1'}
        title="למחוק את כל הנתונים?"
        text="כל ההאכלות, המדידות והילדים יימחקו מהמכשיר הזה. אי אפשר לבטל את הפעולה — אלא אם נשמר קובץ גיבוי."
        confirmLabel="מחיקה לצמיתות"
        danger
        onConfirm={() => {
          setStep({ kind: 'wipe2' });
        }}
        onCancel={() => {
          setStep(null);
        }}
      />
      <ConfirmDialog
        open={step?.kind === 'wipe2'}
        title="בטוח למחוק הכול?"
        text="זו ההזדמנות האחרונה לעצור. מומלץ לייצא קובץ גיבוי לפני המחיקה."
        confirmLabel="כן, למחוק הכול"
        danger
        onConfirm={() => {
          appStore.getState().resetAll();
          setStep(null);
          toast.show({ text: 'כל הנתונים נמחקו' });
        }}
        onCancel={() => {
          setStep(null);
        }}
      />
    </section>
  );
}
