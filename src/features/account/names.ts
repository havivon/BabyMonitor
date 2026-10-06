import { he } from '../../i18n/he';

/** Hebrew list join: "דנה" · "דנה ונועם" · "דנה, נועם ומאיה". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ו${names[names.length - 1] ?? ''}`;
}

/** Default family name (DESIGN §15.7): "משפחת {last word}" for 2+ words, else "משפחת {name}". */
export function defaultFamilyName(displayName: string | null | undefined): string {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  return last ? he.account.setup.familyNameDefault(last) : '';
}

export const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';
