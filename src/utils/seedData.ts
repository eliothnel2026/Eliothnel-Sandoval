import { Insumo, Receta, Movimiento, Usuario } from '../types';

export const DEFAULT_USERS: Usuario[] = [
  { id: 'usr-1', nombre: 'Carlos Mendoza', rol: 'Administrador', activo: true },
  { id: 'usr-2', nombre: 'Elena Rostova', rol: 'Gerente', activo: true },
  { id: 'usr-3', nombre: 'Juan Pérez', rol: 'Operador', activo: true }
];

export const DEFAULT_INSUMOS: Insumo[] = [
  {
    id: 'ins-1',
    nombre: 'Carne de Res (Sirloin)',
    categoria: 'Carnes',
    proveedorPrincipal: 'Distribuidora Carnes Express',
    unidad: 'lb',
    costoActual: 5.80,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  },
  {
    id: 'ins-2',
    nombre: 'Tortilla de Maíz Blanco',
    categoria: 'Tortillería',
    proveedorPrincipal: 'El Milagro S.A.',
    unidad: 'Und',
    costoActual: 0.08,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  },
  {
    id: 'ins-3',
    nombre: 'Cebolla Blanca',
    categoria: 'Verduras',
    proveedorPrincipal: 'Frutas y Verduras del Centro',
    unidad: 'lb',
    costoActual: 1.20,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  },
  {
    id: 'ins-4',
    nombre: 'Cilantro Fresco',
    categoria: 'Verduras',
    proveedorPrincipal: 'Frutas y Verduras del Centro',
    unidad: 'lb',
    costoActual: 2.15,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  },
  {
    id: 'ins-5',
    nombre: 'Chile Guajillo',
    categoria: 'Despensa',
    proveedorPrincipal: 'Especias San Juan',
    unidad: 'lb',
    costoActual: 4.30,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  },
  {
    id: 'ins-6',
    nombre: 'Soda Uva 12oz',
    categoria: 'Bebidas',
    proveedorPrincipal: 'Distribuidora del Norte',
    unidad: 'Und',
    costoActual: 0.45,
    activo: true,
    permitirCompras: true,
    permitirProduccion: false
  }
];

export const DEFAULT_RECETAS: Receta[] = [
  {
    id: 'rec-1',
    nombre: 'Birria (SubReceta)',
    activa: true,
    descripcion: 'Preparación base de carne sazonada con chiles para tacos y caldos',
    ingredientes: [
      { tipo: 'insumo', targetId: 'ins-1', cantidad: 1.2 }, // 1.2 lb de carne para 1 lb de birria cocida
      { tipo: 'insumo', targetId: 'ins-5', cantidad: 0.1 }  // 0.1 lb de chile guajillo
    ]
  },
  {
    id: 'rec-2',
    nombre: 'Taco de Birria',
    activa: true,
    descripcion: 'Taco de birria tradicional con cebolla, cilantro y tortilla',
    ingredientes: [
      { tipo: 'receta', targetId: 'rec-1', cantidad: 0.2 }, // Requiere 0.2 lb de Birria cocida
      { tipo: 'insumo', targetId: 'ins-2', cantidad: 1.0 }, // 1 Tortilla
      { tipo: 'insumo', targetId: 'ins-3', cantidad: 0.05 }, // 0.05 lb cebolla
      { tipo: 'insumo', targetId: 'ins-4', cantidad: 0.02 }  // 0.02 lb cilantro
    ]
  }
];

// Compras y consumos iniciales para arrancar con un estado idéntico al mockup pero realista
export const DEFAULT_MOVIMIENTOS: Movimiento[] = [
  {
    id: 'mov-1',
    fecha: '2026-07-19',
    hora: '08:00:00',
    usuarioId: 'usr-1',
    usuarioNombre: 'Carlos Mendoza',
    tipo: 'Compra',
    observaciones: 'Compra de abastecimiento inicial - Factura F-551',
    detalles: [
      { insumoId: 'ins-1', cantidad: 100, costoUnitario: 5.80 },
      { insumoId: 'ins-2', cantidad: 500, costoUnitario: 0.08 },
      { insumoId: 'ins-3', cantidad: 50, costoUnitario: 1.20 },
      { insumoId: 'ins-4', cantidad: 15, costoUnitario: 2.15 },
      { insumoId: 'ins-5', cantidad: 20, costoUnitario: 4.30 },
      { insumoId: 'ins-6', cantidad: 200, costoUnitario: 0.45 }
    ]
  },
  {
    id: 'mov-2',
    fecha: '2026-07-20',
    hora: '11:15:00',
    usuarioId: 'usr-2',
    usuarioNombre: 'Elena Rostova',
    tipo: 'Consumo por Receta',
    observaciones: 'Despacho almuerzos - 40 Tacos de Birria',
    referenciaId: 'rec-2',
    referenciaNombre: 'Taco de Birria',
    referenciaCantidad: 40,
    detalles: [
      // 40 tacos requiere:
      // Birria: 40 * 0.2 = 8 lb.
      // Birria requiere:
      //   - Carne: 8 * 1.2 = 9.6 lb
      //   - Chile Guajillo: 8 * 0.1 = 0.8 lb
      // Tortilla: 40 * 1 = 40 Und
      // Cebolla: 40 * 0.05 = 2.0 lb
      // Cilantro: 40 * 0.02 = 0.8 lb
      { insumoId: 'ins-1', cantidad: -9.6, costoUnitario: 5.80 },
      { insumoId: 'ins-5', cantidad: -0.8, costoUnitario: 4.30 },
      { insumoId: 'ins-2', cantidad: -40.0, costoUnitario: 0.08 },
      { insumoId: 'ins-3', cantidad: -2.0, costoUnitario: 1.20 },
      { insumoId: 'ins-4', cantidad: -0.8, costoUnitario: 2.15 }
    ]
  },
  {
    id: 'mov-3',
    fecha: '2026-07-20',
    hora: '12:30:00',
    usuarioId: 'usr-3',
    usuarioNombre: 'Juan Pérez',
    tipo: 'Consumo Directo',
    observaciones: 'Consumo directo de bebidas en barra de atención',
    detalles: [
      { insumoId: 'ins-6', cantidad: -15, costoUnitario: 0.45 }
    ]
  },
  {
    id: 'mov-4',
    fecha: '2026-07-20',
    hora: '13:40:00',
    usuarioId: 'usr-1',
    usuarioNombre: 'Carlos Mendoza',
    tipo: 'Ajuste',
    observaciones: 'Merma por cebolla en mal estado detectada en cámara',
    detalles: [
      { insumoId: 'ins-3', cantidad: -1.2, costoUnitario: 1.20 }
    ]
  }
];

export function getInitialState() {
  const users = localStorage.getItem('kc_users');
  const insumos = localStorage.getItem('kc_insumos');
  const recetas = localStorage.getItem('kc_recetas');
  const movimientos = localStorage.getItem('kc_movimientos');
  const activeUser = localStorage.getItem('kc_active_user');

  return {
    users: users ? JSON.parse(users) : DEFAULT_USERS,
    insumos: insumos ? JSON.parse(insumos) : DEFAULT_INSUMOS,
    recetas: recetas ? JSON.parse(recetas) : DEFAULT_RECETAS,
    movimientos: movimientos ? JSON.parse(movimientos) : DEFAULT_MOVIMIENTOS,
    activeUser: activeUser ? JSON.parse(activeUser) : DEFAULT_USERS[0]
  };
}

export function saveState(
  users: Usuario[],
  insumos: Insumo[],
  recetas: Receta[],
  movimientos: Movimiento[],
  activeUser: Usuario
) {
  localStorage.setItem('kc_users', JSON.stringify(users));
  localStorage.setItem('kc_insumos', JSON.stringify(insumos));
  localStorage.setItem('kc_recetas', JSON.stringify(recetas));
  localStorage.setItem('kc_movimientos', JSON.stringify(movimientos));
  localStorage.setItem('kc_active_user', JSON.stringify(activeUser));
}
