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
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonIcon from '@mui/icons-material/Person';
import HistoryIcon from '@mui/icons-material/History';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';
import ProductosPage from './cliente/ProductosPage';
import PerfilPage from './cliente/PerfilPage';
import HistorialPage from './cliente/HistorialPage';
import CarritoPage from './cliente/CarritoPage';

const DRAWER = 200;

const tabs = [
  { id: 'productos', label: 'Productos', icon: <StorefrontIcon /> },
  { id: 'carrito', label: 'Carrito', icon: <ShoppingCartIcon /> },
  { id: 'historial', label: 'Historial', icon: <HistoryIcon /> },
  { id: 'perfil', label: 'Mi Perfil', icon: <PersonIcon /> },
];

export default function ClienteLayout() {
  const { usuario, logout } = useAuth();
  const [active, setActive] = useState('productos');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, background: '#1B4332' }}>
        <Toolbar>
          <ShoppingCartIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Playfair Display", serif' }}>
            Supermercado NoSQL
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
          {tabs.map((tab) => (
            <ListItemButton
              key={tab.id}
              selected={active === tab.id}
              onClick={() => setActive(tab.id)}
              sx={{
                mx: 1, borderRadius: 2, my: 0.3,
                '&.Mui-selected': { background: '#E8F5E9', '&:hover': { background: '#C8E6C9' } },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: active === tab.id ? '#1B4332' : undefined }}>
                {tab.icon}
              </ListItemIcon>
              <ListItemText
                primary={tab.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active === tab.id ? 600 : 400 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, mt: 8, minHeight: 'calc(100vh - 64px)', background: '#FAFAF8' }}
      >
        {active === 'productos' && <ProductosPage />}
        {active === 'carrito' && <CarritoPage />}
        {active === 'historial' && <HistorialPage />}
        {active === 'perfil' && <PerfilPage />}
      </Box>
    </Box>
  );
}
