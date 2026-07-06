import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Producto } from '../../types';

export default function ProductosPage() {
  const { usuario } = useAuth();
  const [items, setItems] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [pasillos, setPasillos] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [pasilloId, setPasilloId] = useState('');
  const [deptoId, setDeptoId] = useState('');

  useEffect(() => {
    api.getPasillos().then(setPasillos).catch(() => {});
    api.getDepartamentos().then(setDepartamentos).catch(() => {});
  }, []);

  const load = async (p: number, limit: number, search: string, pid: string, did: string) => {
    setLoading(true);
    try {
      const data = await api.getProductos({
        search: search || undefined,
        pasillo_id: pid || undefined,
        departamento_id: did || undefined,
        page: p,
        limit,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page + 1, rowsPerPage, searchTerm, pasilloId, deptoId);
  }, [page, rowsPerPage, searchTerm, pasilloId, deptoId]);

  const handleAgregar = async (id: string) => {
    if (!usuario) return;
    try {
      await api.agregarAlCarrito(usuario._id, id);
    } catch {}
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Productos</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Pasillo</InputLabel>
            <Select value={pasilloId} label="Pasillo" onChange={(e) => { setPasilloId(e.target.value); setPage(0); }}>
              <MenuItem value="">Todos</MenuItem>
              {pasillos.map((p) => (
                <MenuItem key={p._id} value={p._id}>{p.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Departamento</InputLabel>
            <Select value={deptoId} label="Departamento" onChange={(e) => { setDeptoId(e.target.value); setPage(0); }}>
              <MenuItem value="">Todos</MenuItem>
              {departamentos.map((d) => (
                <MenuItem key={d._id} value={d._id}>{d.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Buscar…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearchTerm(filtro); setPage(0); } }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              },
            }}
            sx={{ width: 200 }}
          />
        </Box>
      </Box>

      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 240px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Pasillo</TableCell>
                  <TableCell>Departamento</TableCell>
                  <TableCell align="right">Precio</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell width={80}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>Cargando…</TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 4 }}>Sin resultados.</TableCell>
                  </TableRow>
                ) : (
                  items.map((p: Producto) => (
                    <TableRow key={p._id} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{p.nombre}</TableCell>
                      <TableCell sx={{ color: '#5A6577' }}>{p.pasillo_nombre}</TableCell>
                      <TableCell sx={{ color: '#5A6577' }}>{p.departamento_nombre}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
                        S/ {p.precio.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">{p.stock}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="primary" onClick={() => handleAgregar(p._id)} title="Agregar al carrito">
                          <AddShoppingCartIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={total === 0 ? 0 : page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Filas por página"
          />
        </CardContent>
      </Card>
    </Box>
  );
}
