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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import { api } from '../services/api';
import type { MongoReplicaSet, IndiceInfo, RedisInfo, RedisClave } from '../types';

interface Props {
  onBack: () => void;
}

export default function InfraPage({ onBack }: Props) {
  const [rs, setRs] = useState<MongoReplicaSet | null>(null);
  const [indices, setIndices] = useState<Record<string, IndiceInfo[]>>({});
  const [redisInfo, setRedisInfo] = useState<RedisInfo | null>(null);
  const [claves, setClaves] = useState<RedisClave[]>([]);
  const [ts, setTs] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    setTs('Actualizando…');
    await Promise.all([
      api.getReplicaSet().then(setRs).catch(() => setRs(null)),
      api.getIndices().then(setIndices).catch(() => setIndices({})),
      api.getRedisInfo().then(setRedisInfo).catch(() => setRedisInfo(null)),
      api.getRedisClaves().then(setClaves).catch(() => setClaves([])),
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

  return (
    <Box sx={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <AppBar position="static" sx={{ background: '#1B4332' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={onBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <ScienceIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Playfair Display", serif', flexGrow: 1 }}>
            Infraestructura NoSQL
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            MongoDB + Redis
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

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            MongoDB — Replica Set
          </Typography>
          {rs ? (
            <>
              <Box sx={{ mb: 1.5 }}>
                <Chip
                  label={`readPreference = ${rs.read_preference}`}
                  size="small"
                  sx={{ background: '#1B4332', color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Las lecturas de catálogo e historial se dirigen a nodos SECONDARY.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {rs.members.map((m) => (
                  <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined" sx={{
                      borderColor: m.state === 'PRIMARY' ? '#1B4332' : undefined,
                      background: m.state === 'PRIMARY' ? '#E8F5E9' : undefined,
                    }}>
                      <CardContent>
                        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: m.state === 'PRIMARY' ? '#1B4332' : '#888' }}>
                          {m.state}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-all', mt: 0.5, mb: 0.5 }}>
                          {m.name}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Health: {m.health === 1 ? '✅ Up' : '❌ Down'}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          optime: {m.optimeDate ? new Date(m.optimeDate).toLocaleTimeString('es-PE') : '—'}
                        </Typography>
                        {m.lag_segundos !== null && m.lag_segundos !== undefined && (
                          <Typography variant="caption" display="block" sx={{ color: '#E65100', mt: 0.5 }}>
                            Lag replicación: {m.lag_segundos}s
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Cargando…</Typography>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            Redis — Replicación Master / Réplica
          </Typography>
          <Grid container spacing={2}>
            {redisInfo?.master && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderColor: '#1B4332', background: '#E8F5E9' }}>
                  <CardContent>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#1B4332' }}>MASTER</Typography>
                    <Typography variant="body2">Role: <strong>{redisInfo.master.role}</strong></Typography>
                    <Typography variant="body2">Slaves conectados: {redisInfo.master.connected_slaves}</Typography>
                    <Typography variant="body2">Repl offset: {redisInfo.master.master_repl_offset}</Typography>
                    <Typography variant="caption" display="block" sx={{ wordBreak: 'break-all' }}>
                      Repl ID: <code>{(redisInfo.master.master_replid || '').slice(0, 16)}…</code>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888' }}>RÉPLICA</Typography>
                  {!redisInfo?.replica ? (
                    <Typography variant="body2" color="text.secondary">No configurada (añadir REDIS_REPLICA_HOST al .env)</Typography>
                  ) : redisInfo.replica ? (
                    <>
                      <Typography variant="body2">Role: <strong>{redisInfo.replica.role}</strong></Typography>
                      <Typography variant="body2">Master: {redisInfo.replica.master_host}:{redisInfo.replica.master_port}</Typography>
                      <Typography variant="body2">Link: {redisInfo.replica.master_link_status}</Typography>
                      <Typography variant="body2">Offset: {redisInfo.replica.slave_repl_offset}</Typography>
                      <Typography variant="caption" display="block" sx={{ color: '#E65100', mt: 0.5 }}>Lag master: {redisInfo.replica.lag ?? '—'}s</Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="error">Error conectando a la réplica</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
            MongoDB — Índices activos
          </Typography>
          {Object.keys(indices).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Cargando…</Typography>
          ) : (
            Object.entries(indices).map(([col, idxs]) => (
              <Box key={col} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  📋 {col}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    ({idxs.length} índice{idxs.length !== 1 ? 's' : ''})
                  </Typography>
                </Typography>
                <List dense disablePadding>
                  {idxs.map((idx) => {
                    const campos = idx.campos.map(([f, v]) => `${f}:${v}`).join(', ');
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
                          secondaryTypographyProps={{ variant: 'caption', color: '#777' }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))
          )}
        </Box>

        <Box>
          <Typography variant="h6" sx={{ color: '#1B4332', borderBottom: '2px solid #A5D6A7', pb: 0.5, mb: 1.5 }}>
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
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ color: '#888', fontStyle: 'italic' }}>Sin claves activas.</TableCell>
                  </TableRow>
                ) : (
                  claves.map((c) => {
                    const ttlStyle = c.ttl_segundos > 0 && c.ttl_segundos < 300
                      ? { color: '#C62828', fontWeight: 700 } : c.ttl_segundos > 0 ? { color: '#2E7D32' } : {};
                    const ttlText = c.ttl_segundos === -1 ? '∞' : c.ttl_segundos === -2 ? '(expirada)' : String(c.ttl_segundos);
                    return (
                      <TableRow key={c.clave}>
                        <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{c.clave}</TableCell>
                        <TableCell>{c.tipo}</TableCell>
                        <TableCell align="right" sx={ttlStyle}>{ttlText}</TableCell>
                        <TableCell sx={{ color: '#555', maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.valor_resumen || ''}>
                          {c.valor_resumen || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
}
