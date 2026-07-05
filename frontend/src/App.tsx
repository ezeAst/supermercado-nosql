import { Box, CircularProgress } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ClienteLayout from './pages/ClienteLayout';
import TrabajadorLayout from './pages/TrabajadorLayout';
import InfraPage from './pages/InfraPage';

function AppContent() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/infra" element={<InfraPage />} />
      <Route path="/trabajador" element={<TrabajadorLayout />} />
      <Route path="/app/*" element={!usuario ? <LoginPage /> : <ClienteLayout />} />
      <Route path="/" element={usuario ? <ClienteLayout /> : <LoginPage />} />
      <Route path="*" element={usuario ? <ClienteLayout /> : <LoginPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
