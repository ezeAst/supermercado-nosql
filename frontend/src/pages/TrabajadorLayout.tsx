import { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import QueueIcon from '@mui/icons-material/Queue';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../contexts/AuthContext';
import ColaPage from './trabajador/ColaPage';
import DetallePedidoPage from './trabajador/DetallePedidoPage';

const DRAWER = 200;

export default function TrabajadorLayout() {
  const { usuario, logout } = useAuth();
  const [activeCola, setActiveCola] = useState(true);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const showDetail = (id: string) => {
    setPedidoId(id);
    setActiveCola(false);
  };

  const showCola = () => {
    setPedidoId(null);
    setActiveCola(true);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, background: '#1B4332' }}>
        <Toolbar>
          <Avatar sx={{ width: 28, height: 28, bgcolor: '#E76F51', fontSize: 14, mr: 1 }}>
            W
          </Avatar>
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Playfair Display", serif' }}>
            Almacén — Supermercado NoSQL
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ mr: 1.5, opacity: 0.9 }}>
            {usuario?.nombre}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <Avatar sx={{ width: 28, height: 28, bgcolor: '#E76F51', fontSize: 14 }}>
              {usuario?.nombre?.charAt(0)}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled sx={{ fontSize: 13 }}>{usuario?.email}</MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER, boxSizing: 'border-box', pt: 8, borderRight: '1px solid #eaeaea' },
        }}
      >
        <List disablePadding>
          <ListItemButton
            selected={activeCola}
            onClick={showCola}
            sx={{
              mx: 1, borderRadius: 2, my: 0.3,
              '&.Mui-selected': { background: '#FFF3E0', '&:hover': { background: '#FFE0B2' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: activeCola ? '#E65100' : undefined }}>
              <QueueIcon />
            </ListItemIcon>
            <ListItemText
              primary="Cola de Pedidos"
              primaryTypographyProps={{ fontSize: 14, fontWeight: activeCola ? 600 : 400 }}
            />
          </ListItemButton>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, mt: 8, minHeight: 'calc(100vh - 64px)', background: '#FAFAF8' }}
      >
        {activeCola && <ColaPage onSelectPedido={showDetail} />}
        {!activeCola && pedidoId && (
          <DetallePedidoPage pedidoId={pedidoId} onBack={showCola} />
        )}
      </Box>
    </Box>
  );
}
