import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#B60100',
      light: '#E53935',
      dark: '#8B0000',
      contrastText: '#fff',
    },
    secondary: {
      main: '#1a1d24',
    },
    background: {
      default: '#f5f6f8',
      paper: '#fff',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
  },
  typography: {
    fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
});

export default theme;
