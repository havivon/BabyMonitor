import { Fragment } from 'react';
import { isolateNumbers } from '../../../i18n/format';

const ISOLATE = /⁦([^⁩]*)⁩/g;

/**
 * Hebrew text whose numbers, signed numbers and ranges (as detected by `isolateNumbers`) are
 * rendered inside `<bdi>` elements, so "100–150" never displays reversed in RTL (QA BUG-009).
 * DOM-level isolation (rather than invisible LRI/PDI characters) also keeps copy/paste clean.
 */
export function IsolatedText({ text }: { text: string }) {
  const marked = isolateNumbers(text);
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of marked.matchAll(ISOLATE)) {
    if (m.index > last) parts.push(marked.slice(last, m.index));
    parts.push(<bdi key={m.index}>{m[1]}</bdi>);
    last = m.index + m[0].length;
  }
  if (last < marked.length) parts.push(marked.slice(last));
  return <Fragment>{parts}</Fragment>;
}
