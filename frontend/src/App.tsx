import { Box, CircularProgress } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
      <Route
        path="/app/*"
        element={
          !usuario ? <Navigate to="/" replace /> :
          usuario.rol === 'trabajador' ? <TrabajadorLayout /> : <ClienteLayout />
        }
      />
      <Route path="/" element={usuario ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
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
