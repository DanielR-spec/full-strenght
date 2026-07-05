import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      {/* Modal Card */}
      <div 
        className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 text-rose-500 mb-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold font-heading text-zinc-100">{title}</h3>
          </div>
          
          <p className="text-zinc-400 text-sm leading-relaxed">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="py-4 text-center font-medium text-sm text-zinc-400 hover:bg-zinc-800/50 transition-colors border-r border-zinc-800 focus:outline-hidden"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="py-4 text-center font-semibold text-sm text-rose-500 hover:bg-rose-950/20 active:bg-rose-950/40 transition-colors focus:outline-hidden disabled:opacity-50"
          >
            {isSubmitting ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
