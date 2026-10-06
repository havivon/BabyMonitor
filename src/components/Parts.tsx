import { Fragment, type ReactNode } from 'react';

export interface PartsProps {
  /** Items such as "6 האכלות", "370 מ״ל", "49 ד׳ הנקה" — each one never breaks internally. */
  items: readonly ReactNode[];
  /** Separator glued to the END of each item but the last (default "·"; '' = caller glues its own). */
  separator?: string;
}

/**
 * Renders a "a · b · c" list where every item is an unbreakable unit (`.nowrap`), so a number
 * is never separated from its unit. Lines may only wrap at the space AFTER a separator, which also
 * keeps "·" from starting a line.
 */
export function Parts({ items, separator = '·' }: PartsProps) {
  const last = items.length - 1;
  return (
    <>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span className="nowrap">
            {item}
            {i < last && separator && ` ${separator}`}
          </span>
          {i < last && ' '}
        </Fragment>
      ))}
    </>
  );
}
