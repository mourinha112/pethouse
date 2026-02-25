import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function Loading({ text = 'Carregando...' }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={2} py={6}>
      <CircularProgress size={48} sx={{ color: 'primary.main' }} />
      {text && <Typography color="text.secondary">{text}</Typography>}
    </Box>
  );
}
