import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ScienceIcon from '@mui/icons-material/Science';
import PersonIcon from '@mui/icons-material/Person';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import type { Usuario } from '../types';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'rol' | 'usuario'>('rol');
  const [rol, setRol] = useState<'cliente' | 'trabajador'>('cliente');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 'usuario') {
      setLoading(true);
      setError('');
      api.listUsuarios(rol)
        .then(setUsuarios)
        .catch(() => setUsuarios([]))
        .finally(() => setLoading(false));
    }
  }, [step, rol]);

  const handleLogin = async (u: Usuario) => {
    setLoading(true);
    setError('');
    try {
      await login(u.email, u.nombre.toLowerCase().replace(/\s/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
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
      <Card sx={{ width: 420, maxWidth: '90vw' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ShoppingCartIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5">Supermercado NoSQL</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Demo · MongoDB + Redis
            </Typography>
          </Box>

          {step === 'rol' ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Selecciona el tipo de usuario
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  sx={{ py: 3, flexDirection: 'column', gap: 1 }}
                  onClick={() => { setRol('cliente'); setStep('usuario'); }}
                >
                  <PersonIcon sx={{ fontSize: 36 }} />
                  <Typography variant="body2" fontWeight={600}>Cliente</Typography>
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  color="secondary"
                  sx={{ py: 3, flexDirection: 'column', gap: 1 }}
                  onClick={() => navigate('/trabajador')}
                >
                  <WarehouseIcon sx={{ fontSize: 36 }} />
                  <Typography variant="body2" fontWeight={600}>Trabajador</Typography>
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Button
                size="small"
                startIcon={<ArrowBackIcon />}
                onClick={() => setStep('rol')}
                sx={{ mb: 1, color: '#5A6577' }}
              >
                Volver
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Selecciona un usuario {rol === 'cliente' ? 'cliente' : 'trabajador'}
              </Typography>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
                  {usuarios.map((u) => (
                    <ListItemButton
                      key={u._id}
                      onClick={() => handleLogin(u)}
                      disabled={loading}
                      sx={{ borderRadius: 2, mb: 0.5 }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: rol === 'trabajador' ? '#E76F51' : '#1B4332' }}>
                          {u.nombre.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={u.nombre}
                        secondary={u.email}
                        primaryTypographyProps={{ fontWeight: 500 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}

              {error && <Alert severity="error" size="small" sx={{ mt: 1 }}>{error}</Alert>}
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <Button
            component={Link}
            to="/infra"
            variant="text"
            size="small"
            fullWidth
            startIcon={<ScienceIcon />}
            sx={{ color: '#5A6577', fontSize: 13 }}
          >
            Ver infraestructura (sin sesión)
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
