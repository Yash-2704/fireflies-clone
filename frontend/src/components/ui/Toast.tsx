"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; kind: "success" | "error"; message: string };
type Notify = { success: (m: string) => void; error: (m: string) => void };

const ToastContext = createContext<Notify>({ success: () => {}, error: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const [notify] = useState<Notify>(() => ({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
  }));

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className="flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-[13px] shadow-xl">
            {t.kind === "success"
              ? <CheckCircle2 size={16} className="text-emerald-400" />
              : <XCircle size={16} className="text-red-400" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
