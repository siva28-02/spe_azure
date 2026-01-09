import React, { useEffect, useRef } from 'react';
import { Button } from './Button';
import { X, AlertTriangle, Loader2, Info } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
}

export const InputModal: React.FC<InputModalProps> = ({ 
  isOpen, onClose, onSubmit, title, initialValue = "", placeholder, submitLabel = "Save"
}) => {
  const [value, setValue] = React.useState(initialValue);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setValue(initialValue);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(value);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => !isSubmitting && onClose()} 
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={() => handleSubmit()} disabled={isSubmitting || !value.trim()}>
            {isSubmitting ? "Processing..." : submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", isDestructive = false
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      console.error(e);
      // Parent should handle errors, but we reset loading state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button 
            variant={isDestructive ? "danger" : "primary"} 
            onClick={handleConfirm} 
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        {isDestructive && (
            <div className="p-2 bg-red-100 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
        )}
        <div className="pt-1">
            <p className="text-gray-600 whitespace-pre-line">{message}</p>
        </div>
      </div>
    </Modal>
  );
};

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'error' | 'info';
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, title, message, type = 'error' }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <Button onClick={onClose}>OK</Button>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-full shrink-0 ${type === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
           {type === 'error' ? (
             <AlertTriangle className="w-6 h-6 text-red-600" />
           ) : (
             <Info className="w-6 h-6 text-blue-600" />
           )}
        </div>
        <div className="pt-1">
            <p className="text-gray-600 whitespace-pre-line">{message}</p>
        </div>
      </div>
    </Modal>
  );
};