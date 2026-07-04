export interface Usuario {
  _id: string;
  nombre: string;
  email: string;
  rol: 'cliente' | 'trabajador';
  direccion?: string;
  telefono?: string;
}

export interface Producto {
  _id: string;
  nombre: string;
  precio: number;
  stock: number;
  pasillo_id: string;
  pasillo_nombre: string;
  departamento_id: string;
  departamento_nombre: string;
}

export interface CarritoItem {
  producto_id: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  pasillo_nombre: string;
}

export interface PedidoProducto {
  producto_id: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  pasillo_id: string;
  pasillo_nombre: string;
  departamento_nombre?: string;
  estado_pasillo?: 'pendiente' | 'en_pasillo' | 'listo';
}

export interface Pedido {
  _id: string;
  usuario_id: string;
  estado: string;
  fecha_creacion: string;
  total: number;
  productos: PedidoProducto[];
  direccion_entrega: string;
  metodo_pago: string;
  estado_redis?: string;
}

export interface PedidosResponse {
  pedidos: Pedido[];
  siguiente_cursor?: string;
}

export interface ColaItem {
  _id: string;
  fecha_creacion: string;
  estado: string;
  total: number;
  num_productos: number;
  direccion_entrega?: string;
}

export interface PasilloPendiente {
  pasillo_id: string;
  pasillo_nombre: string;
  departamento_nombre?: string;
  zona_almacen?: string;
  encargado_area?: string;
  productos: {
    producto_id: string;
    nombre: string;
    cantidad_total: number;
  }[];
}

export interface MongoMember {
  id: number;
  name: string;
  state: string;
  health: number;
  optimeDate: string;
  lag_segundos: number | null;
}

export interface MongoReplicaSet {
  replica_set: string;
  read_preference: string;
  members: MongoMember[];
}

export interface IndiceInfo {
  nombre: string;
  campos: [string, number][];
  unique: boolean;
  sparse: boolean;
  text: boolean;
}

export interface RedisInfo {
  master: Record<string, any>;
  replica: Record<string, any> | null;
}

export interface RedisClave {
  clave: string;
  tipo: string;
  ttl_segundos: number;
  valor_resumen: string;
}
