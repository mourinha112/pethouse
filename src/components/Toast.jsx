import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');

  const show = useCallback((msg, sev = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const toast = {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setOpen(false)} severity={severity} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
