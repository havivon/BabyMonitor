import type { BackupErrorCode } from '../../domain/backup';

/** Hebrew explanation per backup import error code. Every failure imports nothing. */
export const IMPORT_ERROR_TEXT: Record<BackupErrorCode | 'READ_FAILED', string> = {
  INVALID_JSON: 'הקובץ אינו קובץ גיבוי תקין (JSON). לא יובא דבר.',
  NOT_A_BACKUP: 'הקובץ אינו גיבוי תקין של BabyMonitor. לא יובא דבר.',
  UNSUPPORTED_VERSION:
    'הגיבוי נוצר בגרסה חדשה יותר של האפליקציה. כדאי לעדכן את האפליקציה ולנסות שוב.',
  INVALID_DATA: 'חלק מהנתונים בקובץ פגומים, ולכן לא יובא דבר.',
  DUPLICATE_ID: 'בקובץ יש רישומים כפולים, ולכן לא יובא דבר.',
  UNKNOWN_BABY: 'בקובץ יש רישומים של ילד/ה שלא מופיע/ה בו, ולכן לא יובא דבר.',
  READ_FAILED: 'לא הצלחנו לקרוא את הקובץ. כדאי לנסות שוב.',
};
