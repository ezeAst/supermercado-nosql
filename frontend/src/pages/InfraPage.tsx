import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function InfraPage() {
  const navigate = useNavigate();
  const [shards, setShards] = useState<any[]>([]);
  const [indices, setIndices] = useState<Record<string, any[]>>({});
  const [redisInfo, setRedisInfo] = useState<any>(null);
  const [claves, setClaves] = useState<any[]>([]);
  const [shardOps, setShardOps] = useState<any[]>([]);
  const [ts, setTs] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [ruteoInput, setRuteoInput] = useState('');
  const [ruteoResult, setRuteoResult] = useState<number | null>(null);
  const [ruteoLoading, setRuteoLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    setTs('Actualizando…');
    await Promise.all([
      api.getReplicaSet().then((data) => setShards(data.shards || [])).catch(() => {}),
      api.getIndices().then(setIndices).catch(() => {}),
      api.getRedisInfo().then(setRedisInfo).catch(() => {}),
      api.getRedisClaves().then(setClaves).catch(() => []),
      api.getShardOps().then(setShardOps).catch(() => []),
    ]);
    setTs(new Date().toLocaleTimeString('es-PE'));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(loadAll, 5000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, loadAll]);

  const handleCalcularRuteo = async () => {
    if (!ruteoInput.trim()) return;
    setRuteoLoading(true);
    try {
      const data = await api.getShardForUser(ruteoInput.trim());
      setRuteoResult(data.shard);
    } catch { setRuteoResult(null); }
    setRuteoLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <AppBar position="static" sx={{ background: '#1B4332' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => navigate('/')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <ScienceIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Playfair Display", serif', flexGrow: 1 }}>
            Infraestructura NoSQL
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Sharding: md5(id) % 2
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={loadAll}>↺ Actualizar todo</Button>
          {ts && <Typography variant="caption" color="text.secondary">Último refresh: {ts}</Typography>}
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
            label="Auto-refresh cada 5s"
          />
        </Box>

        {/* Shards */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            MongoDB — Shards
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {shards.map((shard: any) => (
              <Grid key={shard.shard_id} size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderColor: shard.error ? '#E65100' : '#1B4332' }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1B4332' }}>
                      Shard {shard.shard_id}
                    </Typography>
                    {shard.error ? (
                      <Typography color="error" variant="body2">Error: {shard.error}</Typography>
                    ) : (
                      <>
                        <Typography variant="body2" fontWeight={600}>Replica set: {shard.replica_set}</Typography>
                        <Typography variant="body2">Pedidos: <strong>{shard.total_pedidos}</strong></Typography>
                        <Box sx={{ mt: 1 }}>
                          {shard.members?.map((m: any) => (
                            <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                              <Chip label={m.state} size="small" sx={{
                                fontWeight: 700, fontSize: 10,
                                bgcolor: m.state === 'PRIMARY' ? '#1B4332' : '#E0E0E0',
                                color: m.state === 'PRIMARY' ? '#fff' : '#424242',
                              }} />
                              <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                {m.name}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" fontWeight={600}>Calcular ruteo:</Typography>
              <TextField
                size="small"
                placeholder="Pega un usuario_id"
                value={ruteoInput}
                onChange={(e) => setRuteoInput(e.target.value)}
                sx={{ width: 300 }}
              />
              <Button size="small" variant="contained" onClick={handleCalcularRuteo}>Calcular</Button>
              {ruteoResult !== null && (
                <Chip label={`→ Shard ${ruteoResult}`} color={ruteoResult === 0 ? 'primary' : 'secondary'} />
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Shard Ops Log */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            Log de operaciones por shard
          </Typography>
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Timestamp</TableCell>
                      <TableCell>Shard</TableCell>
                      <TableCell>Op</TableCell>
                      <TableCell>Colección</TableCell>
                      <TableCell>Detalle</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shardOps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ color: '#888', fontStyle: 'italic', py: 3 }}>
                          Sin operaciones aún. Confirma un pedido para ver el ruteo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      shardOps.map((op: any, i: number) => {
                        const ts = op.ts ? new Date(op.ts).toLocaleTimeString('es-PE') : '—';
                        return (
                          <TableRow key={i}>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{ts}</TableCell>
                            <TableCell>
                              <Chip label={`Shard ${op.shard}`} size="small" sx={{
                                fontWeight: 600, fontSize: 11,
                                bgcolor: op.shard === 0 ? '#E3F2FD' : '#FFF3E0',
                                color: op.shard === 0 ? '#1565C0' : '#E65100',
                              }} />
                            </TableCell>
                            <TableCell>
                              <Chip label={op.op} size="small" sx={{
                                fontWeight: 600, fontSize: 11,
                                bgcolor: op.op === 'write' ? '#E8F5E9' : '#F3E5F5',
                                color: op.op === 'write' ? '#2E7D32' : '#6A1B9A',
                              }} />
                            </TableCell>
                            <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{op.collection}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{op.detail}</TableCell>
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

        {/* Redis info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#00897B', borderBottom: '2px solid #B2DFDB', pb: 0.5, mb: 1.5 }}>
            Redis — Replicación Master / Réplica
          </Typography>
          <Grid container spacing={2}>
            {redisInfo?.master && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderColor: '#00897B', background: '#E0F2F1' }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#00897B' }}>MASTER</Typography>
                    <Typography variant="body2">Role: <strong>{redisInfo.master.role}</strong></Typography>
                    <Typography variant="body2">Slaves conectados: {redisInfo.master.connected_slaves}</Typography>
                    <Typography variant="body2">Repl offset: {redisInfo.master.master_repl_offset}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888' }}>RÉPLICA</Typography>
                  {!redisInfo?.replica ? (
                    <Typography variant="body2" color="text.secondary">No conectada</Typography>
                  ) : (
                    <>
                      <Typography variant="body2">Link: {redisInfo.replica.master_link_status}</Typography>
                      <Typography variant="body2">Offset: {redisInfo.replica.slave_repl_offset}</Typography>
                      <Typography variant="caption" sx={{ color: '#E65100', mt: 0.5 }}>Lag: {redisInfo.replica.lag ?? '—'}s</Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* MongoDB Indices */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            MongoDB — Índices activos
          </Typography>
          {Object.keys(indices).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Cargando…</Typography>
          ) : (
            Object.entries(indices).map(([col, idxs]: [string, any[]]) => (
              <Box key={col} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  📋 {col}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({idxs.length} índice{idxs.length !== 1 ? 's' : ''})</Typography>
                </Typography>
                <List dense disablePadding>
                  {idxs.map((idx: any) => {
                    const campos = idx.campos?.map(([f, v]: [string, number]) => `${f}:${v}`).join(', ');
                    return (
                      <ListItem key={idx.nombre} sx={{ border: '1px solid #eee', borderRadius: 1, mb: 0.5, py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#1B4332' }}>{idx.nombre}</Typography>
                              {idx.unique && <Chip label="UNIQUE" size="small" sx={{ background: '#E3F2FD', color: '#1565C0', fontWeight: 700, fontSize: 10 }} />}
                              {idx.sparse && <Chip label="SPARSE" size="small" sx={{ background: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 10 }} />}
                              {idx.text && <Chip label="TEXT" size="small" sx={{ background: '#F3E5F5', color: '#6A1B9A', fontWeight: 700, fontSize: 10 }} />}
                            </Box>
                          }
                          secondary={`[${campos}]`}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))
          )}
        </Box>

        {/* Redis claves */}
        <Box>
          <Typography variant="h6" sx={{ color: '#00897B', borderBottom: '2px solid #B2DFDB', pb: 0.5, mb: 1.5 }}>
            Redis — Claves activas
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Clave</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">TTL (s)</TableCell>
                  <TableCell>Valor resumido</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claves.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ color: '#888', fontStyle: 'italic' }}>Sin claves activas.</TableCell></TableRow>
                ) : (
                  claves.map((c) => (
                    <TableRow key={c.clave}>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{c.clave}</TableCell>
                      <TableCell>{c.tipo}</TableCell>
                      <TableCell align="right" sx={c.ttl_segundos > 0 && c.ttl_segundos < 300 ? { color: '#C62828', fontWeight: 700 } : {}}>
                        {c.ttl_segundos === -1 ? '∞' : c.ttl_segundos === -2 ? '(expirada)' : c.ttl_segundos}
                      </TableCell>
                      <TableCell sx={{ color: '#555', maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.valor_resumen || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
}
