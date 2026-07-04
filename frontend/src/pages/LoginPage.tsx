import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ScienceIcon from '@mui/icons-material/Science';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onShowInfra: () => void;
}

export default function LoginPage({ onShowInfra }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoCliente = async () => {
    setLoading(true);
    try {
      await login('ana.torres@demo.supermercado.pe', 'anatorres');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoTrabajador = async () => {
    setLoading(true);
    try {
      await login('juan.perez@demo.supermercado.pe', 'juanperez');
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #1B4332 100%)',
      }}
    >
      <Card sx={{ width: 400, maxWidth: '90vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ShoppingCartIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5">Supermercado NoSQL</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Demo · MongoDB + Redis
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField size="small" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <TextField size="small" label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />

            {error && <Alert severity="error" size="small">{error}</Alert>}

            <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : undefined} sx={{ py: 1.2 }}>
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>

            <Button
              variant="text"
              size="small"
              fullWidth
              onClick={onShowInfra}
              startIcon={<ScienceIcon />}
              sx={{ color: '#5A6577', fontSize: 13 }}
            >
              Ver infraestructura (sin sesión)
            </Button>
          </Box>

          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #eaeaea' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, textAlign: 'center' }}>
              Acceso rápido de demostración
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" fullWidth onClick={handleDemoCliente} disabled={loading} sx={{ fontSize: 12 }}>
                Cliente demo
              </Button>
              <Button variant="outlined" size="small" fullWidth color="secondary" onClick={handleDemoTrabajador} disabled={loading} sx={{ fontSize: 12 }}>
                Trabajador demo
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
