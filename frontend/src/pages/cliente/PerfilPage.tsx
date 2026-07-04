import { Box, Card, CardContent, Typography, Avatar, Divider, Chip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import { useAuth } from '../../contexts/AuthContext';

export default function PerfilPage() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  return (
    <Box sx={{ maxWidth: 500 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Mi Perfil</Typography>

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <Avatar
            sx={{
              width: 80,
              height: 80,
              bgcolor: '#E76F51',
              fontSize: 32,
              mb: 2,
            }}
          >
            {usuario.nombre.charAt(0)}
          </Avatar>
          <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif' }}>
            {usuario.nombre}
          </Typography>
          <Chip
            label={usuario.rol === 'cliente' ? 'Cliente' : 'Trabajador'}
            size="small"
            sx={{
              mt: 0.5,
              bgcolor: usuario.rol === 'cliente' ? '#E8F5E9' : '#FFF3E0',
              color: usuario.rol === 'cliente' ? '#1B4332' : '#E65100',
              fontWeight: 600,
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EmailIcon color="action" />
            <Box>
              <Typography variant="caption" color="text.secondary">Email</Typography>
              <Typography variant="body2">{usuario.email}</Typography>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BadgeIcon color="action" />
            <Box>
              <Typography variant="caption" color="text.secondary">Rol</Typography>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{usuario.rol}</Typography>
            </Box>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon color="action" />
            <Box>
              <Typography variant="caption" color="text.secondary">ID de usuario</Typography>
              <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                {usuario._id}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
