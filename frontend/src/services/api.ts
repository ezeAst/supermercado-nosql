import type { Usuario } from '../types';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<Usuario>('/auth/me'),

  listUsuarios: (rol: string) => request<Usuario[]>(`/auth/usuarios?rol=${rol}`),

  // Productos
  getProductos: (params?: { pasillo_id?: string; search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.pasillo_id) q.set('pasillo_id', params.pasillo_id);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<any>(`/productos${qs ? `?${qs}` : ''}`);
  },

  // Carrito
  getCarrito: (usuarioId: string) =>
    request<any[]>(`/carritos/${usuarioId}`),

  agregarAlCarrito: (usuarioId: string, productoId: string, cantidad = 1) =>
    request(`/carritos/${usuarioId}/productos`, {
      method: 'POST',
      body: JSON.stringify({ producto_id: productoId, cantidad }),
    }),

  actualizarCantidadCarrito: (usuarioId: string, productoId: string, cantidad: number) =>
    request(`/carritos/${usuarioId}/productos/${productoId}`, {
      method: 'PUT',
      body: JSON.stringify({ cantidad }),
    }),

  eliminarProductoCarrito: (usuarioId: string, productoId: string) =>
    request(`/carritos/${usuarioId}/productos/${productoId}`, { method: 'DELETE' }),

  vaciarCarrito: (usuarioId: string) =>
    request(`/carritos/${usuarioId}`, { method: 'DELETE' }),

  confirmarPedido: (
    usuarioId: string,
    direccion_entrega: string,
    metodo_pago: string,
    idempotency_key: string,
  ) =>
    request<any>(`/carritos/${usuarioId}/confirmar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotency_key,
      },
      body: JSON.stringify({ direccion_entrega, metodo_pago }),
    }),

  // Pedidos / Historial
  getHistorial: (usuarioId: string, params?: { limit?: number; before?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.before) q.set('before', params.before);
    const qs = q.toString();
    return request<{
      pedidos: any[];
      siguiente_cursor?: string;
    }>(`/usuarios/${usuarioId}/pedidos${qs ? `?${qs}` : ''}`);
  },

  // Almacén
  getCola: (estado?: string) => {
    const q = estado ? `?estado=${estado}` : '';
    return request<any[]>(`/almacen/pedidos${q}`);
  },

  getPendientes: () => request<any[]>('/almacen/pedidos/pendientes'),

  getPedidoDetalle: (pedidoId: string) =>
    request<any>(`/almacen/pedidos/${pedidoId}`),

  cambiarEstadoPedido: (pedidoId: string, estado: string) =>
    request<any>(`/almacen/pedidos/${pedidoId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),

  cambiarEstadoProducto: (pedidoId: string, productoId: string, estado: string) =>
    request<any>(`/almacen/pedidos/${pedidoId}/productos/${productoId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),

  // Infraestructura
  getReplicaSet: () => request<any>('/infra/mongo/replica-set'),
  getIndices: () => request<any>('/infra/mongo/indices'),
  getShardOps: () => request<any[]>('/infra/mongo/shard-ops'),
  getShardForUser: (usuarioId: string) => request<any>(`/infra/mongo/shard-for-user/${usuarioId}`),
  deleteRedisClave: (clave: string) =>
    request<any>(`/infra/redis/claves/${encodeURIComponent(clave)}`, { method: 'DELETE' }),
  getRedisInfo: () => request<any>('/infra/redis/info'),
  getRedisClaves: () => request<any[]>('/infra/redis/claves'),
};
