import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = 'Confirmar', danger = false }) {
  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>{title || 'Confirmar'}</DialogTitle>
      <DialogContent>
        <DialogContentText color="text.secondary">{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">Cancelar</Button>
        <Button onClick={onConfirm} variant="contained" color={danger ? 'error' : 'primary'}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
