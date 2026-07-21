import { Insumo, Receta, Movimiento, MovimientoDetalle, RecetaIngrediente, Usuario, RolUsuario } from '../types';

export interface RecipeTreeNode {
  id: string;
  nombre: string;
  tipo: 'insumo' | 'receta';
  cantidad: number; // Por porción de receta padre
  unidad: string;
  costoUnitario: number;
  costoTotal: number;
  children?: RecipeTreeNode[];
}

/**
 * EXCEPCIÓN UNIFORME DE INVENTARIO
 * Encapsula errores de reglas de negocio con códigos unificados (p. ej. RN-02, RN-06).
 */
export class InventoryException extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InventoryException';
  }
}

/**
 * DTOs (Data Transfer Objects) para las transacciones del Motor de Inventario
 */
export interface RegisterCompraDTO {
  fecha: string;
  proveedor: string;
  documento: string;
  insumoId: string;
  cantidad: number;
  precioTotal: number;
}

export interface RegisterConsumoDirectoDTO {
  fecha: string;
  insumoId: string;
  cantidad: number;
  observaciones: string;
}

export interface RegisterConsumoRecetaDTO {
  fecha: string;
  recetaId: string;
  cantidad: number;
  observaciones: string;
}

export interface RegisterAjusteDTO {
  fecha: string;
  insumoId: string;
  cantidad: number; // Positivo para sobrante, negativo para merma
  observaciones: string;
}

/**
 * INTERFAZ CONTRATO PARA EL MOTOR DE INVENTARIO
 * Sigue los principios SOLID de segregación de interfaces e inversión de dependencias.
 */
export interface IInventoryEngine {
  calculateStocks(insumos: Insumo[], movimientos: Movimiento[]): Record<string, number>;
  processCompra(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterCompraDTO
  ): { insumos: Insumo[]; movimientos: Movimiento[] };
  processConsumoDirecto(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterConsumoDirectoDTO
  ): { movimientos: Movimiento[] };
  processConsumoReceta(
    state: { insumos: Insumo[]; recetas: Receta[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterConsumoRecetaDTO
  ): { movimientos: Movimiento[] };
  processAjuste(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterAjusteDTO
  ): { movimientos: Movimiento[] };
}

/**
 * Calcula las existencias actuales de todos los insumos basándose en el historial de movimientos (Ledger)
 */
export function calculateStocks(
  insumos: Insumo[],
  movimientos: Movimiento[]
): Record<string, number> {
  const stocks: Record<string, number> = {};
  
  // Inicializar todo a cero
  insumos.forEach((insumo) => {
    stocks[insumo.id] = 0;
  });

  // Agregar todos los movimientos históricos
  movimientos.forEach((mov) => {
    mov.detalles.forEach((det) => {
      if (stocks[det.insumoId] !== undefined) {
        stocks[det.insumoId] += det.cantidad;
      } else {
        stocks[det.insumoId] = det.cantidad;
      }
    });
  });

  return stocks;
}

/**
 * Verifica si hay ciclos de dependencia en una receta. Retorna true si hay ciclo.
 */
export function hasCircularDependency(
  recipeId: string,
  targetRecipeId: string,
  allRecipes: Receta[],
  visited: string[] = []
): boolean {
  if (recipeId === targetRecipeId) return true;
  if (visited.includes(recipeId)) return false;

  const currentRecipe = allRecipes.find((r) => r.id === recipeId);
  if (!currentRecipe) return false;

  const newVisited = [...visited, recipeId];

  for (const ing of currentRecipe.ingredientes) {
    if (ing.tipo === 'receta') {
      if (ing.targetId === targetRecipeId) return true;
      if (hasCircularDependency(ing.targetId, targetRecipeId, allRecipes, newVisited)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcula recursivamente el costo unitario de una receta basándose en el costo actual de sus insumos primarios.
 */
export function calculateRecipeCost(
  recipeId: string,
  allRecipes: Receta[],
  allInsumos: Insumo[],
  visited: string[] = []
): number {
  if (visited.includes(recipeId)) {
    return 0;
  }

  const recipe = allRecipes.find((r) => r.id === recipeId);
  if (!recipe) return 0;

  const currentVisited = [...visited, recipeId];
  let totalCost = 0;

  for (const ing of recipe.ingredientes) {
    if (ing.tipo === 'insumo') {
      const insumo = allInsumos.find((i) => i.id === ing.targetId);
      if (insumo) {
        totalCost += ing.cantidad * insumo.costoActual;
      }
    } else if (ing.tipo === 'receta') {
      const subCost = calculateRecipeCost(ing.targetId, allRecipes, allInsumos, currentVisited);
      totalCost += ing.cantidad * subCost;
    }
  }

  return totalCost;
}

/**
 * Resuelve una receta de forma recursiva hasta llegar a los insumos primarios,
 * multiplicando por la cantidad deseada. Devuelve un mapa de insumoId -> cantidad acumulada.
 */
export function resolveRecipeToInsumos(
  recipeId: string,
  multiplier: number,
  allRecipes: Receta[],
  allInsumos: Insumo[],
  visited: string[] = []
): Record<string, number> {
  if (visited.includes(recipeId)) {
    throw new InventoryException('RN-05', `Dependencia circular detectada al procesar receta: ${recipeId}`);
  }

  const recipe = allRecipes.find((r) => r.id === recipeId);
  if (!recipe) {
    throw new InventoryException('RN-05', `Receta no encontrada: ${recipeId}`);
  }

  const currentVisited = [...visited, recipeId];
  const requiredInsumos: Record<string, number> = {};

  for (const ing of recipe.ingredientes) {
    const totalQty = ing.cantidad * multiplier;
    if (ing.tipo === 'insumo') {
      requiredInsumos[ing.targetId] = (requiredInsumos[ing.targetId] || 0) + totalQty;
    } else if (ing.tipo === 'receta') {
      const subInsumos = resolveRecipeToInsumos(ing.targetId, totalQty, allRecipes, allInsumos, currentVisited);
      for (const [insumoId, qty] of Object.entries(subInsumos)) {
        requiredInsumos[insumoId] = (requiredInsumos[insumoId] || 0) + qty;
      }
    }
  }

  return requiredInsumos;
}

/**
 * Genera la estructura de árbol para la vista de exploración de recetas de forma recursiva
 */
export function buildRecipeTree(
  recipeId: string,
  qtyMultiplier: number,
  allRecipes: Receta[],
  allInsumos: Insumo[],
  visited: string[] = []
): RecipeTreeNode | null {
  const recipe = allRecipes.find((r) => r.id === recipeId);
  if (!recipe) return null;

  if (visited.includes(recipeId)) {
    return {
      id: recipeId,
      nombre: `${recipe.nombre} [¡Bucle Circular Detectado!]`,
      tipo: 'receta',
      cantidad: qtyMultiplier,
      unidad: 'Und',
      costoUnitario: 0,
      costoTotal: 0,
      children: []
    };
  }

  const cost = calculateRecipeCost(recipeId, allRecipes, allInsumos, visited);
  const node: RecipeTreeNode = {
    id: recipeId,
    nombre: recipe.nombre,
    tipo: 'receta',
    cantidad: qtyMultiplier,
    unidad: 'Und',
    costoUnitario: cost,
    costoTotal: cost * qtyMultiplier,
    children: []
  };

  const nextVisited = [...visited, recipeId];

  for (const ing of recipe.ingredientes) {
    if (ing.tipo === 'insumo') {
      const insumo = allInsumos.find((i) => i.id === ing.targetId);
      if (insumo) {
        node.children?.push({
          id: insumo.id,
          nombre: insumo.nombre,
          tipo: 'insumo',
          cantidad: ing.cantidad * qtyMultiplier,
          unidad: insumo.unidad,
          costoUnitario: insumo.costoActual,
          costoTotal: ing.cantidad * qtyMultiplier * insumo.costoActual
        });
      }
    } else if (ing.tipo === 'receta') {
      const subNode = buildRecipeTree(ing.targetId, ing.cantidad * qtyMultiplier, allRecipes, allInsumos, nextVisited);
      if (subNode) {
        node.children?.push(subNode);
      }
    }
  }

  return node;
}

/**
 * CLASE IMPLEMENTACIÓN DEL MOTOR DE INVENTARIO (INVENTORY ENGINE SERVICE)
 * 
 * Es la única clase autorizada para modificar existencias, registrar compras,
 * consumos y ajustes. Valida de manera transaccional e inmutable las reglas de negocio.
 */
export class InventoryEngineService implements IInventoryEngine {
  
  /**
   * Delegar obtención de stocks
   */
  public calculateStocks(insumos: Insumo[], movimientos: Movimiento[]): Record<string, number> {
    return calculateStocks(insumos, movimientos);
  }

  /**
   * Registra una compra y actualiza el costo promedio ponderado (CPP)
   */
  public processCompra(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterCompraDTO
  ): { insumos: Insumo[]; movimientos: Movimiento[] } {
    const { insumos, movimientos, activeUser } = state;
    const insumo = insumos.find((i) => i.id === dto.insumoId);

    if (!insumo) {
      throw new InventoryException('RN-01', `El insumo con ID '${dto.insumoId}' no existe en la base de datos.`);
    }

    if (!insumo.activo) {
      throw new InventoryException('RN-01', `El insumo '${insumo.nombre}' se encuentra inactivo y no puede recibir compras.`);
    }

    if (!insumo.permitirCompras) {
      throw new InventoryException('RN-01', `El insumo '${insumo.nombre}' tiene deshabilitada la recepción de compras.`);
    }

    if (dto.cantidad <= 0) {
      throw new InventoryException('RN-03', 'La cantidad comprada debe ser estrictamente mayor a cero.');
    }

    if (dto.precioTotal < 0) {
      throw new InventoryException('RN-03', 'El precio total pagado no puede ser un valor negativo.');
    }

    const unitCost = dto.precioTotal / dto.cantidad;

    // Calcular Costo Promedio Ponderado (CPP)
    const stocks = this.calculateStocks(insumos, movimientos);
    const currentStock = stocks[dto.insumoId] || 0;
    const currentCost = insumo.costoActual;
    let newCostoActual = unitCost;

    if (currentStock > 0) {
      newCostoActual = ((currentStock * currentCost) + dto.precioTotal) / (currentStock + dto.cantidad);
    }

    // Clonar e inmutabilizar insumos actualizados
    const updatedInsumos = insumos.map((i) =>
      i.id === dto.insumoId ? { ...i, costoActual: newCostoActual } : i
    );

    // Crear registro inmutable en el libro diario (Ledger)
    const movId = `mov-${Date.now()}`;
    const newMovement: Movimiento = {
      id: movId,
      fecha: dto.fecha,
      hora: new Date().toTimeString().split(' ')[0],
      usuarioId: activeUser.id,
      usuarioNombre: activeUser.nombre,
      tipo: 'Compra',
      observaciones: `Abastecimiento de stock de proveedor. Proveedor: ${dto.proveedor}. Documento: ${dto.documento}`,
      detalles: [
        {
          insumoId: dto.insumoId,
          cantidad: dto.cantidad,
          costoUnitario: unitCost
        }
      ]
    };

    return {
      insumos: updatedInsumos,
      movimientos: [...movimientos, newMovement]
    };
  }

  /**
   * Registra una salida directa de insumo por merma, robo o desperdicio
   */
  public processConsumoDirecto(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterConsumoDirectoDTO
  ): { movimientos: Movimiento[] } {
    const { insumos, movimientos, activeUser } = state;
    const insumo = insumos.find((i) => i.id === dto.insumoId);

    if (!insumo) {
      throw new InventoryException('RN-01', `Insumo no encontrado.`);
    }

    if (!insumo.activo) {
      throw new InventoryException('RN-01', `El insumo '${insumo.nombre}' está inactivo y no puede registrar consumos.`);
    }

    if (dto.cantidad <= 0) {
      throw new InventoryException('RN-03', 'La cantidad del consumo directo debe ser mayor que cero.');
    }

    if (!dto.observaciones.trim()) {
      throw new InventoryException('RN-03', 'Debe especificar el motivo u observaciones de la salida directa.');
    }

    // Validar stock negativo
    const stocks = this.calculateStocks(insumos, movimientos);
    const currentStock = stocks[dto.insumoId] || 0;
    const futureStock = currentStock - dto.cantidad;

    if (futureStock < 0) {
      throw new InventoryException(
        'RN-02',
        `No se puede realizar el consumo. El insumo '${insumo.nombre}' quedaría con existencias negativas (${futureStock.toFixed(2)} ${insumo.unidad}). Stock actual: ${currentStock.toFixed(2)} ${insumo.unidad}, solicitado: ${dto.cantidad.toFixed(2)} ${insumo.unidad}.`
      );
    }

    const newMovement: Movimiento = {
      id: `mov-${Date.now()}`,
      fecha: dto.fecha,
      hora: new Date().toTimeString().split(' ')[0],
      usuarioId: activeUser.id,
      usuarioNombre: activeUser.nombre,
      tipo: 'Consumo Directo',
      observaciones: dto.observaciones.trim(),
      detalles: [
        {
          insumoId: dto.insumoId,
          cantidad: -dto.cantidad,
          costoUnitario: insumo.costoActual
        }
      ]
    };

    return {
      movimientos: [...movimientos, newMovement]
    };
  }

  /**
   * Registra el consumo y explosión recursiva de insumos basada en una receta y porciones preparadas
   */
  public processConsumoReceta(
    state: { insumos: Insumo[]; recetas: Receta[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterConsumoRecetaDTO
  ): { movimientos: Movimiento[] } {
    const { insumos, recetas, movimientos, activeUser } = state;
    const receta = recetas.find((r) => r.id === dto.recetaId);

    if (!receta) {
      throw new InventoryException('RN-05', `La receta con ID '${dto.recetaId}' no existe.`);
    }

    if (!receta.activa) {
      throw new InventoryException('RN-05', `La receta '${receta.nombre}' se encuentra inactiva.`);
    }

    if (dto.cantidad <= 0) {
      throw new InventoryException('RN-03', 'La cantidad de porciones a preparar debe ser mayor que cero.');
    }

    // Resolver desglose recursivo a insumos básicos
    const resolvedInsumos = resolveRecipeToInsumos(dto.recetaId, dto.cantidad, recetas, insumos);

    // Validar existencias de todos los insumos desglosados en una sola transacción simulada
    const stocks = this.calculateStocks(insumos, movimientos);
    const detalles: MovimientoDetalle[] = [];

    for (const [insumoId, requiredQty] of Object.entries(resolvedInsumos)) {
      const ins = insumos.find((i) => i.id === insumoId);
      if (!ins) {
        throw new InventoryException('RN-01', `Insumo ingrediente con ID '${insumoId}' no existe.`);
      }

      const currentStock = stocks[insumoId] || 0;
      const futureStock = currentStock - requiredQty;

      if (futureStock < 0) {
        throw new InventoryException(
          'RN-02',
          `Transacción abortada: Existencias insuficientes para preparar la receta '${receta.nombre}'. El ingrediente '${ins.nombre}' quedaría con stock negativo (${futureStock.toFixed(2)} ${ins.unidad}). Stock actual: ${currentStock.toFixed(2)} ${ins.unidad}, requerido: ${requiredQty.toFixed(2)} ${ins.unidad}.`
        );
      }

      detalles.push({
        insumoId,
        cantidad: -requiredQty,
        costoUnitario: ins.costoActual
      });
    }

    // Agregar registro global al ledger
    const newMovement: Movimiento = {
      id: `mov-${Date.now()}`,
      fecha: dto.fecha,
      hora: new Date().toTimeString().split(' ')[0],
      usuarioId: activeUser.id,
      usuarioNombre: activeUser.nombre,
      tipo: 'Consumo por Receta',
      observaciones: dto.observaciones.trim(),
      referenciaId: dto.recetaId,
      referenciaNombre: receta.nombre,
      referenciaCantidad: dto.cantidad,
      detalles
    };

    return {
      movimientos: [...movimientos, newMovement]
    };
  }

  /**
   * Registra un ajuste de inventario (auditable, requiere privilegios Administrador/Gerente)
   */
  public processAjuste(
    state: { insumos: Insumo[]; movimientos: Movimiento[]; activeUser: Usuario },
    dto: RegisterAjusteDTO
  ): { movimientos: Movimiento[] } {
    const { insumos, movimientos, activeUser } = state;

    // Validación de privilegios de usuario (RBAC)
    if (activeUser.rol !== 'Administrador' && activeUser.rol !== 'Gerente') {
      throw new InventoryException(
        'RN-06',
        `Permiso denegado: El rol '${activeUser.rol}' no tiene autorización para realizar ajustes manuales de stock.`
      );
    }

    const insumo = insumos.find((i) => i.id === dto.insumoId);
    if (!insumo) {
      throw new InventoryException('RN-01', 'Insumo no encontrado.');
    }

    if (dto.cantidad === 0) {
      throw new InventoryException('RN-03', 'El valor de ajuste debe ser un número positivo o negativo diferente de cero.');
    }

    if (!dto.observaciones.trim()) {
      throw new InventoryException('RN-03', 'La justificación detallada del ajuste es obligatoria por motivos de auditoría.');
    }

    // Validar si el ajuste produce stock negativo
    const stocks = this.calculateStocks(insumos, movimientos);
    const currentStock = stocks[dto.insumoId] || 0;
    const futureStock = currentStock + dto.cantidad;

    if (futureStock < 0) {
      throw new InventoryException(
        'RN-02',
        `Ajuste inválido: El insumo '${insumo.nombre}' quedaría con existencias negativas (${futureStock.toFixed(2)} ${insumo.unidad}). Stock actual: ${currentStock.toFixed(2)} ${insumo.unidad}, ajuste solicitado: ${dto.cantidad.toFixed(2)} ${insumo.unidad}.`
      );
    }

    const newMovement: Movimiento = {
      id: `mov-${Date.now()}`,
      fecha: dto.fecha,
      hora: new Date().toTimeString().split(' ')[0],
      usuarioId: activeUser.id,
      usuarioNombre: activeUser.nombre,
      tipo: 'Ajuste',
      observaciones: dto.observaciones.trim(),
      detalles: [
        {
          insumoId: dto.insumoId,
          cantidad: dto.cantidad,
          costoUnitario: insumo.costoActual
        }
      ]
    };

    return {
      movimientos: [...movimientos, newMovement]
    };
  }
}

/**
 * INSTANCIA DEL MOTOR DE INVENTARIO PARA INYECCIÓN DE DEPENDENCIAS (ID)
 * Puede ser inyectado o referenciado a través de este export único.
 */
export const inventoryEngineInstance = new InventoryEngineService();
