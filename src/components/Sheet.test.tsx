import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Sheet } from './Sheet';

function Harness({
  dirty = false,
  onClose = () => undefined,
}: {
  dirty?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Sheet
        open={open}
        dirty={dirty}
        title="בקבוק"
        variant="bottle"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button type="button">שמירה</button>}
      >
        <input aria-label="כמות" />
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('opens as a labelled modal dialog, focuses the first field, locks scroll, restores focus', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'open' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'בקבוק' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveClass('sheet', 'sheet--bottle');
    expect(screen.getByLabelText('כמות')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'סגירה' }));
    expect(dialog).not.toHaveAttribute('open');
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    expect(screen.queryByLabelText('כמות')).not.toBeInTheDocument(); // content unmounts
  });

  it('closes on Esc (cancel) and on a scrim tap, not on clicks inside', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(screen.getByLabelText('כמות'));
    fireEvent.click(screen.getByLabelText('כמות'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('asks "לצאת בלי לשמור?" when dirty', () => {
    const onClose = vi.fn();
    render(<Harness dirty onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.click(screen.getByRole('button', { name: 'סגירה' }));
    const confirm = screen.getByRole('alertdialog', { name: 'לצאת בלי לשמור?' });
    expect(screen.getByRole('button', { name: 'המשך עריכה' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'המשך עריכה' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'סגירה' }));
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ConfirmDialog', () => {
  it('is an alertdialog described by its text; Esc cancels', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="למחוק?"
        text="אי אפשר לבטל."
        confirmLabel="מחיקה"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'למחוק?' });
    expect(dialog).toHaveAccessibleDescription('אי אפשר לבטל.');
    expect(screen.getByRole('button', { name: 'ביטול' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'מחיקה' })).toHaveClass('btn--danger');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'מחיקה' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
