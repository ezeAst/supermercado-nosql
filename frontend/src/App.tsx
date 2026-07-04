import { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ClienteLayout from './pages/ClienteLayout';
import TrabajadorLayout from './pages/TrabajadorLayout';
import InfraPage from './pages/InfraPage';

function AppContent() {
  const { usuario, loading } = useAuth();
  const [showInfra, setShowInfra] = useState(false);

  if (showInfra) return <InfraPage onBack={() => setShowInfra(false)} />;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!usuario) return <LoginPage onShowInfra={() => setShowInfra(true)} />;

  if (usuario.rol === 'trabajador') return <TrabajadorLayout />;

  return <ClienteLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
