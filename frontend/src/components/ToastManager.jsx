import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'Low', duration = 5000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, fading: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300); // Matches CSS transition fade-out duration
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} ${toast.fading ? 'fade-out' : ''}`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="flex items-start gap-3">
              <div>
                <p className="text-sm font-bold">
                  {toast.type === 'Critical'
                    ? '🔴 Critical Alert'
                    : toast.type === 'High'
                    ? '🟠 High Alert'
                    : toast.type === 'Medium'
                    ? '🟡 Medium Warning'
                    : '🟢 Low Risk Update'}
                </p>
                <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
                  {toast.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
