import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1B4332',
      light: '#2D6A4F',
      dark: '#0D2B1D',
      contrastText: '#fff',
    },
    secondary: {
      main: '#E76F51',
      light: '#F4A261',
      dark: '#C0533A',
      contrastText: '#fff',
    },
    info: {
      main: '#2A9D8F',
      light: '#56C5B7',
      dark: '#1F7A6F',
    },
    background: {
      default: '#FAFAF8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A2E',
      secondary: '#5A6577',
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h4: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 700,
    },
    h5: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 600,
    },
    body1: {
      fontFamily: '"Inter", sans-serif',
    },
    body2: {
      fontFamily: '"Inter", sans-serif',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          border: '1px solid #eaeaea',
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          background: '#FAFAF8',
          borderBottom: '1px solid #eaeaea',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
        containedSecondary: {
          color: '#fff',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            background: '#FAFAF8',
            borderBottom: '2px solid #eaeaea',
            fontSize: '0.8rem',
            color: '#5A6577',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      `,
    },
  },
});

export default theme;
