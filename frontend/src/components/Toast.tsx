"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, Clock, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
};

type ToastContextType = {
  showToast: (type: ToastType, message: string, description?: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: Toast = { id, type, message, description };
    
    setToasts((prev) => [...prev, toast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  const success = useCallback((message: string, description?: string) => {
    showToast("success", message, description);
  }, [showToast]);

  const error = useCallback((message: string, description?: string) => {
    showToast("error", message, description);
  }, [showToast]);

  const warning = useCallback((message: string, description?: string) => {
    showToast("warning", message, description);
  }, [showToast]);

  const info = useCallback((message: string, description?: string) => {
    showToast("info", message, description);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const config = {
    success: {
      icon: CheckCircle,
      iconColor: "text-green-400",
      borderColor: "border-green-500/50",
    },
    error: {
      icon: XCircle,
      iconColor: "text-red-400",
      borderColor: "border-red-500/50",
    },
    warning: {
      icon: AlertCircle,
      iconColor: "text-yellow-400",
      borderColor: "border-yellow-500/50",
    },
    info: {
      icon: Clock,
      iconColor: "text-zinc-300",
      borderColor: "border-[#2b2b30]",
    },
  };

  const { icon: Icon, iconColor, borderColor } = config[toast.type];

  const getBorderColor = () => {
    switch(toast.type) {
      case 'success': return 'rgba(16, 185, 129, 0.5)'; // green-500/50
      case 'error': return 'rgba(239, 68, 68, 0.5)'; // red-500/50
      case 'warning': return 'rgba(234, 179, 8, 0.5)'; // yellow-500/50
      case 'info': return '#2b2b30';
      default: return '#2b2b30';
    }
  };

  return (
    <div
      className={`
        pointer-events-auto
        min-w-[320px] max-w-md
        rounded border backdrop-blur-xl
        p-4 shadow-2xl
        animate-in slide-in-from-right-full duration-300
        font-mono
      `}
      style={{ 
        backgroundColor: '#121218', 
        borderColor: getBorderColor()
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-100 leading-tight">
            {toast.message}
          </p>
          {toast.description && (
            <p className="text-xs text-zinc-400 mt-1 leading-snug">
              {toast.description}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="flex-shrink-0 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

