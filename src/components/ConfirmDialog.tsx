import type { ReactNode } from 'react';

export function ConfirmDialog({
  title, children, confirmLabel, danger, onConfirm, onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="row end">
          <button className="btn" onClick={onCancel} autoFocus>취소</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
