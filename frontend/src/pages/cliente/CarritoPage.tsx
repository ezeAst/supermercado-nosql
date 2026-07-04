import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { CarritoItem } from '../../types';

export default function CarritoPage() {
  const { usuario } = useAuth();
  const [items, setItems] = useState<CarritoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [direccion, setDireccion] = useState('');
  const [metodo, setMetodo] = useState('tarjeta');
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const data = await api.getCarrito(usuario._id);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [usuario]);

  useEffect(() => { load(); }, [load]);

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const handleCantidad = async (item: CarritoItem, delta: number) => {
    if (!usuario) return;
    const nueva = item.cantidad + delta;
    if (nueva <= 0) {
      await handleEliminar(item.producto_id);
      return;
    }
    try {
      await api.actualizarCantidadCarrito(usuario._id, item.producto_id, nueva);
      load();
    } catch {}
  };

  const handleEliminar = async (prodId: string) => {
    if (!usuario) return;
    try {
      await api.eliminarProductoCarrito(usuario._id, prodId);
      load();
    } catch {}
  };

  const handleConfirmar = async () => {
    if (!usuario || !direccion.trim()) return;
    setConfirming(true);
    setMsg(null);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch(`/api/v1/carritos/${usuario._id}/confirmar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ direccion_entrega: direccion, metodo_pago: metodo }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setMsg({ type: 'warning', text: 'Pedido duplicado (409) — ya existía con ese Idempotency-Key.' });
      } else if (res.status === 201) {
        setMsg({ type: 'success', text: `✅ Pedido creado — estado: ${data.estado}` });
        setItems([]);
      } else {
        setMsg({ type: 'error', text: `Error ${res.status}: ${data.detail || JSON.stringify(data)}` });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: `Error de red: ${e.message}` });
    } finally { setConfirming(false); }
  };

  const handleVaciar = async () => {
    if (!usuario) return;
    try { await api.vaciarCarrito(usuario._id); } catch { /* ignore */ }
    setItems([]);
  };

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Mi Carrito</Typography>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="center">Cant.</TableCell>
                  <TableCell align="right">Precio Unit.</TableCell>
                  <TableCell align="right">Subtotal</TableCell>
                  <TableCell width={80}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>
                      Carrito vacío. ¡Agrega productos desde la tienda!
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => (
                    <TableRow key={i.producto_id}>
                      <TableCell sx={{ fontWeight: 500 }}>{i.nombre}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => handleCantidad(i, -1)}>
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography sx={{ minWidth: 20, textAlign: 'center' }}>{i.cantidad}</Typography>
                          <IconButton size="small" onClick={() => handleCantidad(i, 1)}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        S/ {i.precio_unitario.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
                        S/ {i.subtotal.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => handleEliminar(i.producto_id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, borderTop: '2px solid #eaeaea' }}>
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>Total</Typography>
            <Typography variant="h6" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
              S/ {total.toFixed(2)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', mb: 2 }}>
              Confirmar Pedido
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                size="small"
                label="Dirección de entrega"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                fullWidth
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Método de pago</InputLabel>
                <Select value={metodo} label="Método de pago" onChange={(e) => setMetodo(e.target.value)}>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleConfirmar}
                  disabled={confirming || !direccion.trim()}
                  startIcon={confirming ? <CircularProgress size={16} /> : undefined}
                >
                  {confirming ? 'Procesando…' : 'Confirmar pedido'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleVaciar}
                  startIcon={<DeleteIcon />}
                >
                  Vaciar carrito
                </Button>
              </Box>
              {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
