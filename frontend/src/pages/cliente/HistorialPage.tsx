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
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
} from '@mui/material';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Pedido, PedidosResponse } from '../../types';

const badgeStyles: Record<string, any> = {
  registrado: { bgcolor: '#E3F2FD', color: '#1565C0' },
  en_preparacion: { bgcolor: '#FFF3E0', color: '#E65100' },
  listo_para_despacho: { bgcolor: '#E8F5E9', color: '#2E7D32' },
  despachado: { bgcolor: '#EDE7F6', color: '#4527A0' },
};

export default function HistorialPage() {
  const { usuario } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Pedido | null>(null);

  const load = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    try {
      const data: PedidosResponse = await api.getHistorial(usuario._id, { limit: 10 });
      setPedidos(data.pedidos || []);
      setCursor(data.siguiente_cursor);
      setHasMore(!!data.siguiente_cursor);
    } catch { setPedidos([]); } finally { setLoading(false); }
  }, [usuario]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!usuario || !cursor) return;
    setLoadingMore(true);
    try {
      const data: PedidosResponse = await api.getHistorial(usuario._id, { limit: 10, before: cursor });
      setPedidos((prev) => [...prev, ...(data.pedidos || [])]);
      setCursor(data.siguiente_cursor);
      setHasMore(!!data.siguiente_cursor);
    } catch {} finally { setLoadingMore(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Historial de Compras</Typography>
        <Button size="small" variant="outlined" onClick={load}>Actualizar</Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Productos</TableCell>
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
                ) : pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>
                      Sin pedidos aún. ¡Agrega productos al carrito y confirma tu primer pedido!
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((p) => {
                    const fecha = new Date(p.fecha_creacion).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
                    return (
                      <TableRow key={p._id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fecha}</TableCell>
                        <TableCell>
                          <Chip label={p.estado} size="small" sx={{ fontWeight: 600, fontSize: 11, ...badgeStyles[p.estado] }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
                          S/ {p.total.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ color: '#5A6577' }}>
                          {p.productos?.map((x) => x.nombre).join(', ')}
                        </TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => setSelected(p)}>Ver</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {hasMore && !loading && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Button variant="outlined" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>Detalle del Pedido</DialogTitle>
        <DialogContent>
          {selected && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                  <Typography variant="h6" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>S/ {selected.total.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Estado</Typography>
                  <Box><Chip label={selected.estado} size="small" sx={{ fontWeight: 600, ...badgeStyles[selected.estado] }} /></Box>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">Dirección de entrega</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>{selected.direccion_entrega}</Typography>
              <Typography variant="caption" color="text.secondary">Método de pago</Typography>
              <Typography variant="body2" sx={{ mb: 2, textTransform: 'capitalize' }}>{selected.metodo_pago}</Typography>
              <Typography variant="subtitle2" sx={{ mb: 1, mt: 1 }}>Productos</Typography>
              <List dense disablePadding>
                {selected.productos?.map((prod) => (
                  <ListItem key={prod.producto_id} sx={{ px: 0, display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2">{prod.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">Pasillo: {prod.pasillo_nombre}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>×{prod.cantidad}</Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
