import type { Quantity } from './format';

/** Renders "<ltr number> unit" per DESIGN §11.3. */
export function Qty({ q }: { q: Quantity }) {
  return (
    <>
      <span className="ltr num">{q.number}</span> {q.unit}
    </>
  );
}
