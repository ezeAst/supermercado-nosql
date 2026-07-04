import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { api } from '../../services/api';
import type { Pedido, PedidoProducto } from '../../types';

const badgeStyles: Record<string, any> = {
  registrado: { bgcolor: '#E3F2FD', color: '#1565C0' },
  en_preparacion: { bgcolor: '#FFF3E0', color: '#E65100' },
  listo_para_despacho: { bgcolor: '#E8F5E9', color: '#2E7D32' },
  despachado: { bgcolor: '#EDE7F6', color: '#4527A0' },
};

const prodBadgeStyles: Record<string, any> = {
  pendiente: { bgcolor: '#F5F5F5', color: '#9E9E9E', cursor: 'pointer' },
  en_pasillo: { bgcolor: '#FFF3E0', color: '#E65100', cursor: 'pointer' },
  listo: { bgcolor: '#E8F5E9', color: '#2E7D32', cursor: 'pointer' },
};

const ORDER_FLOW = ['registrado', 'en_preparacion', 'listo_para_despacho', 'despachado'];

interface Props {
  pedidoId: string;
  onBack: () => void;
}

export default function DetallePedidoPage({ pedidoId, onBack }: Props) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [changingState, setChangingState] = useState(false);
  const [confirmDespachar, setConfirmDespachar] = useState(false);
  const [confirmListoForzar, setConfirmListoForzar] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getPedidoDetalle(pedidoId)
      .then(setPedido)
      .catch(() => setPedido(null))
      .finally(() => setLoading(false));
  }, [pedidoId]);

  const handleToggleProducto = async (prod: PedidoProducto) => {
    setToggling(prod.producto_id);
    const nuevoEstado = prod.estado_pasillo === 'listo' ? 'en_pasillo' : 'listo';
    try {
      const updated = await api.cambiarEstadoProducto(pedidoId, prod.producto_id, nuevoEstado);
      setPedido((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          productos: prev.productos.map((p) =>
            p.producto_id === prod.producto_id ? { ...p, estado_pasillo: nuevoEstado as any } : p,
          ),
          estado: updated.order_estado || prev.estado,
        };
      });
    } catch {}
    setToggling(null);
  };

  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (nuevoEstado === 'despachado') {
      setConfirmDespachar(true);
      return;
    }
    if (nuevoEstado === 'listo_para_despacho' && !todosListos) {
      setConfirmListoForzar(true);
      return;
    }
    setChangingState(true);
    try {
      await api.cambiarEstadoPedido(pedidoId, nuevoEstado);
      setPedido((prev) => prev ? { ...prev, estado: nuevoEstado } : prev);
    } catch {}
    setChangingState(false);
  };

  const handleConfirmDespachar = async () => {
    setConfirmDespachar(false);
    setChangingState(true);
    try {
      await api.cambiarEstadoPedido(pedidoId, 'despachado');
      setPedido((prev) => prev ? { ...prev, estado: 'despachado' } : prev);
    } catch {}
    setChangingState(false);
  };

  const handleConfirmListoForzar = async () => {
    setConfirmListoForzar(false);
    setChangingState(true);
    try {
      await api.cambiarEstadoPedido(pedidoId, 'listo_para_despacho');
      setPedido((prev) => prev ? { ...prev, estado: 'listo_para_despacho' } : prev);
    } catch {}
    setChangingState(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pedido) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>Volver</Button>
        <Typography color="error">Pedido no encontrado.</Typography>
      </Box>
    );
  }

  const fecha = new Date(pedido.fecha_creacion).toLocaleString('es-PE', {
    dateStyle: 'full', timeStyle: 'short',
  });

  const todosListos = pedido.productos.every((p) => p.estado_pasillo === 'listo');
  const estadoIdx = ORDER_FLOW.indexOf(pedido.estado);

  const canGoForward = (target: string) => {
    const targetIdx = ORDER_FLOW.indexOf(target);
    return targetIdx === estadoIdx + 1;
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2, color: '#5A6577' }}>
        Volver a la cola
      </Button>

      <Typography variant="h5" sx={{ mb: 4 }}>
        Pedido <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 16 }}>#{pedidoId.slice(-8)}</span>
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Box sx={{ flex: '1 1 180px', minWidth: 160, display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Total</Typography>
              <Typography variant="h5" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                S/ {pedido.total.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: 160, display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Estado</Typography>
              <Box>
                <Chip
                  label={pedido.estado}
                  size="small"
                  sx={{ fontWeight: 600, ...badgeStyles[pedido.estado] }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 180px', minWidth: 160, display: 'flex' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Productos</Typography>
              <Typography variant="h5" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                {pedido.productos.length}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Change order state */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            Cambiar estado del pedido
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {ORDER_FLOW.map((est) => {
              const targetIdx = ORDER_FLOW.indexOf(est);
              const isCurrent = est === pedido.estado;
              const isBackward = targetIdx < estadoIdx;
              const isForwardOne = targetIdx === estadoIdx + 1;
              const isForwardMore = targetIdx > estadoIdx + 1;

              return (
                <Button
                  key={est}
                  size="small"
                  variant={isCurrent ? 'contained' : 'outlined'}
                  disabled={isForwardMore || changingState}
                  onClick={() => handleCambiarEstado(est)}
                  sx={{
                    fontSize: 12,
                    ...(isCurrent && badgeStyles[est]),
                    opacity: isForwardMore ? 0.3 : 1,
                  }}
                >
                  {est.replace(/_/g, ' ')}
                </Button>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary">Fecha de creación</Typography>
          <Typography variant="body2">{fecha}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Dirección de entrega
          </Typography>
          <Typography variant="body2">{pedido.direccion_entrega}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Método de pago
          </Typography>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{pedido.metodo_pago}</Typography>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Productos del pedido
      </Typography>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Pasillo</TableCell>
                  <TableCell align="center">Cant.</TableCell>
                  <TableCell align="right">Precio Unit.</TableCell>
                  <TableCell align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pedido.productos.map((prod) => (
                  <TableRow key={prod.producto_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{prod.nombre}</TableCell>
                    <TableCell sx={{ color: '#5A6577' }}>{prod.pasillo_nombre}</TableCell>
                    <TableCell align="center">{prod.cantidad}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      S/ {prod.precio_unitario.toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={prod.estado_pasillo || 'pendiente'}
                        size="small"
                        onClick={() => handleToggleProducto(prod)}
                        disabled={toggling === prod.producto_id}
                        sx={{
                          fontWeight: 600, fontSize: 11,
                          cursor: 'pointer',
                          ...prodBadgeStyles[prod.estado_pasillo || 'pendiente'],
                          '&:hover': { opacity: 0.8 },
                        }}
                        icon={
                          toggling === prod.producto_id ? (
                            <CircularProgress size={14} />
                          ) : prod.estado_pasillo === 'listo' ? (
                            <CheckCircleIcon sx={{ fontSize: 14 }} />
                          ) : (
                            <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {todosListos && pedido.estado === 'listo_para_despacho' && (
        <Box sx={{ mt: 2, p: 2, bgcolor: '#E8F5E9', borderRadius: 2, border: '1px solid #A5D6A7' }}>
          <Typography variant="body2" color="#2E7D32" fontWeight={600}>
            ✅ Todos los productos están listos. El pedido se ha promovido a "listo_para_despacho" automáticamente.
          </Typography>
        </Box>
      )}

      <Dialog open={confirmDespachar} onClose={() => setConfirmDespachar(false)}>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          Confirmar despacho
        </DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de marcar el pedido <strong>#{pedidoId.slice(-8)}</strong> como <strong>despachado</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDespachar(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleConfirmDespachar}>
            Confirmar despacho
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmListoForzar} onClose={() => setConfirmListoForzar(false)}>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          Productos pendientes
        </DialogTitle>
        <DialogContent>
          <Typography>
            No todos los productos están marcados como <strong>"listo"</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            ¿Estás seguro de querer pasar el pedido a <strong>listo para despacho</strong> sin haber recogido todos los productos?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmListoForzar(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleConfirmListoForzar}>
            Forzar cambio
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
