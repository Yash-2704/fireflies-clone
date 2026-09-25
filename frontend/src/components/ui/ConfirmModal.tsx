"use client";

import { Modal } from "@/components/ui/Modal";

export function ConfirmModal({ title, message, confirmLabel = "Delete", onConfirm, onClose }: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} width="max-w-md">
      <p className="text-[13px] text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="btn bg-red-600 text-white hover:bg-red-700">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
