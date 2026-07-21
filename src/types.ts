export type UnidadMedida = 'lb' | 'Und';

export type RolUsuario = 'Administrador' | 'Gerente' | 'Operador';

export interface Usuario {
  id: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
}

export interface Insumo {
  id: string;
  nombre: string;
  categoria: string;
  proveedorPrincipal: string;
  unidad: UnidadMedida;
  costoActual: number;
  activo: boolean;
  permitirCompras: boolean;
  permitirProduccion: boolean;
}

export interface Compra {
  id: string;
  fecha: string;
  proveedor: string;
  documento: string;
  insumoId: string;
  cantidad: number;
  precioTotal: number;
  costoUnitario: number;
}

export interface RecetaIngrediente {
  tipo: 'insumo' | 'receta';
  targetId: string; // ID del Insumo o de otra Receta
  cantidad: number; // Cantidad requerida para producir 1 unidad o 1 libra de esta receta
}

export interface Receta {
  id: string;
  nombre: string;
  activa: boolean;
  descripcion?: string;
  ingredientes: RecetaIngrediente[];
}

export type TipoMovimiento = 'Compra' | 'Consumo Directo' | 'Consumo por Receta' | 'Ajuste';

export interface MovimientoDetalle {
  insumoId: string;
  cantidad: number; // Negativo para salidas, positivo para entradas
  costoUnitario: number;
}

export interface Movimiento {
  id: string;
  fecha: string;
  hora: string;
  usuarioId: string;
  usuarioNombre: string;
  tipo: TipoMovimiento;
  observaciones: string;
  detalles: MovimientoDetalle[];
  // Información contextual extra si aplica
  referenciaId?: string; // ID de la compra o receta asociada
  referenciaNombre?: string; // Nombre de la receta o documento
  referenciaCantidad?: number; // Cantidad producida de la receta
}

export interface HistorialCosto {
  fecha: string;
  costo: number;
}
