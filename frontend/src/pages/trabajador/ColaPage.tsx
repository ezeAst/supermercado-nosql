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
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { api } from '../../services/api';
import type { ColaItem } from '../../types';

const estados = ['registrado', 'en_preparacion', 'listo_para_despacho', 'despachado'];

const badgeStyles: Record<string, any> = {
  registrado: { bgcolor: '#E3F2FD', color: '#1565C0' },
  en_preparacion: { bgcolor: '#FFF3E0', color: '#E65100' },
  listo_para_despacho: { bgcolor: '#E8F5E9', color: '#2E7D32' },
  despachado: { bgcolor: '#EDE7F6', color: '#4527A0' },
};

interface Props {
  onSelectPedido: (id: string) => void;
}

export default function ColaPage({ onSelectPedido }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCola(filtroEstado || undefined);
      setCola(Array.isArray(data) ? data : []);
    } catch { setCola([]); } finally { setLoading(false); }
  }, [filtroEstado]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Cola de Pedidos</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={filtroEstado}
            exclusive
            onChange={(_, v) => setFiltroEstado(v || '')}
          >
            <ToggleButton value="" sx={{ fontSize: 12, px: 1.5 }}>Todos</ToggleButton>
            {estados.map((e) => (
              <ToggleButton key={e} value={e} sx={{ fontSize: 12, px: 1.5 }}>
                {e.replace('_', ' ')}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button size="small" variant="outlined" onClick={load}>↺</Button>
        </Box>
      </Box>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell align="center">Productos</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell width={80}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>
                        Cargando…
                      </TableCell>
                  </TableRow>
                ) : cola.length === 0 ? (
                  <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>
                    No hay pedidos{ filtroEstado ? ` en estado "${filtroEstado}"` : ' pendientes' }.
                  </TableCell>
                  </TableRow>
                ) : (
                  cola.map((p) => {
                    const fecha = new Date(p.fecha_creacion).toLocaleString('es-PE', {
                      dateStyle: 'short', timeStyle: 'short',
                    });
                    return (
                      <TableRow key={p._id} hover>
                        <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                          {p._id.slice(-8)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fecha}</TableCell>
                        <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
                          {p.usuario_id?.slice(-8)}
                        </TableCell>
                        <TableCell align="center">{p.num_productos}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
                          S/ {p.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.estado}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: 11, ...badgeStyles[p.estado] }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            color="info"
                            startIcon={<VisibilityIcon />}
                            onClick={() => onSelectPedido(p._id)}
                            sx={{ fontSize: 11 }}
                          >
                            Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
