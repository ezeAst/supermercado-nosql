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
  Avatar,
} from '@mui/material';
import QueueIcon from '@mui/icons-material/Queue';
import { useAuth } from '../contexts/AuthContext';
import ColaPage from './trabajador/ColaPage';
import DetallePedidoPage from './trabajador/DetallePedidoPage';

const DRAWER = 200;

export default function TrabajadorLayout() {
  const { logout } = useAuth();
  const [activeCola, setActiveCola] = useState(true);
  const [pedidoId, setPedidoId] = useState<string | null>(null);

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
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Playfair Display", serif', flexGrow: 1 }}>
            Almacén — Supermercado NoSQL
          </Typography>
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
