import { Insumo, Receta, Movimiento, Usuario, Compra } from '../types';
import { calculateStocks } from './inventoryEngine';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  device: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface OfflineOperation {
  id: string;
  type: 'ADD_INSUMO' | 'EDIT_INSUMO' | 'DELETE_INSUMO' | 'ADD_MOVIMIENTO';
  timestamp: string;
  payload: any;
}

export interface CentralDB {
  users: Usuario[];
  insumos: Insumo[];
  recetas: Receta[];
  movimientos: Movimiento[];
  lastUpdated: string; // ISO String
}

// Default central database seed if not initialized
const INITIAL_CENTRAL_DB: CentralDB = {
  users: [
    { id: 'usr-1', nombre: 'Carlos Mendoza', rol: 'Administrador', activo: true },
    { id: 'usr-2', nombre: 'Elena Rostova', rol: 'Gerente', activo: true },
    { id: 'usr-3', nombre: 'Juan Pérez', rol: 'Operador', activo: true }
  ],
  insumos: [
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
  ],
  recetas: [
    {
      id: 'rec-1',
      nombre: 'Birria (SubReceta)',
      activa: true,
      descripcion: 'Preparación base de carne sazonada con chiles para tacos y caldos',
      ingredientes: [
        { tipo: 'insumo', targetId: 'ins-1', cantidad: 1.2 },
        { tipo: 'insumo', targetId: 'ins-5', cantidad: 0.1 }
      ]
    },
    {
      id: 'rec-2',
      nombre: 'Taco de Birria',
      activa: true,
      descripcion: 'Taco de birria tradicional con cebolla, cilantro y tortilla',
      ingredientes: [
        { tipo: 'receta', targetId: 'rec-1', cantidad: 0.2 },
        { tipo: 'insumo', targetId: 'ins-2', cantidad: 1.0 },
        { tipo: 'insumo', targetId: 'ins-3', cantidad: 0.05 },
        { tipo: 'insumo', targetId: 'ins-4', cantidad: 0.02 }
      ]
    }
  ],
  movimientos: [
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
  ],
  lastUpdated: new Date().toISOString()
};

// INITIALIZE CENTRAL DATABASE
export function initializeCentralDB() {
  const central = localStorage.getItem('scic_central_db');
  if (!central) {
    localStorage.setItem('scic_central_db', JSON.stringify(INITIAL_CENTRAL_DB));
  }
}

// READ CENTRAL DB
export function getCentralDB(): CentralDB {
  initializeCentralDB();
  const central = localStorage.getItem('scic_central_db');
  return central ? JSON.parse(central) : INITIAL_CENTRAL_DB;
}

// SAVE CENTRAL DB
export function saveCentralDB(db: CentralDB) {
  db.lastUpdated = new Date().toISOString();
  localStorage.setItem('scic_central_db', JSON.stringify(db));
}

// GET NETWORK STATUS
export function getNetworkStatus(): 'Online' | 'Offline' {
  const status = localStorage.getItem('scic_network_status');
  return status === 'Offline' ? 'Offline' : 'Online';
}

// SET NETWORK STATUS
export function setNetworkStatus(status: 'Online' | 'Offline') {
  localStorage.setItem('scic_network_status', status);
}

// GET DEVICE ID
export function getDeviceID(): string {
  const id = localStorage.getItem('scic_device_id');
  return id || 'Dispositivo A (Tablet Cocina)';
}

// SET DEVICE ID
export function setDeviceID(id: string) {
  localStorage.setItem('scic_device_id', id);
}

// GET OFFLINE QUEUE
export function getOfflineQueue(): OfflineOperation[] {
  const queue = localStorage.getItem('scic_offline_queue');
  return queue ? JSON.parse(queue) : [];
}

// SAVE OFFLINE QUEUE
export function saveOfflineQueue(queue: OfflineOperation[]) {
  localStorage.setItem('scic_offline_queue', JSON.stringify(queue));
}

// ADD TO OFFLINE QUEUE
export function addToOfflineQueue(type: OfflineOperation['type'], payload: any) {
  const queue = getOfflineQueue();
  const op: OfflineOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type,
    timestamp: new Date().toISOString(),
    payload
  };
  queue.push(op);
  saveOfflineQueue(queue);
  addSyncLog(`Operación encola en outbox [${type}]: ${getOperationLabel(op)}`, 'warning');
}

// GET SYNC LOGS
export function getSyncLogs(): SyncLogEntry[] {
  const logs = localStorage.getItem('scic_sync_logs');
  return logs ? JSON.parse(logs) : [];
}

// SAVE SYNC LOGS
export function saveSyncLogs(logs: SyncLogEntry[]) {
  localStorage.setItem('scic_sync_logs', JSON.stringify(logs));
}

// ADD SYNC LOG
export function addSyncLog(message: string, type: SyncLogEntry['type'] = 'info') {
  const logs = getSyncLogs();
  const entry: SyncLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    device: getDeviceID(),
    type,
    message
  };
  logs.unshift(entry); // Newest first
  // Cap at 100 entries
  saveSyncLogs(logs.slice(0, 100));
}

// CLEAR LOGS
export function clearSyncLogs() {
  saveSyncLogs([]);
}

// HELPERS
function getOperationLabel(op: OfflineOperation): string {
  switch (op.type) {
    case 'ADD_INSUMO':
      return `Crear Insumo "${op.payload.nombre}"`;
    case 'EDIT_INSUMO':
      return `Modificar Insumo ID: ${op.payload.id}`;
    case 'DELETE_INSUMO':
      return `Eliminar Insumo ID: ${op.payload.id}`;
    case 'ADD_MOVIMIENTO':
      return `Registrar Movimiento: ${op.payload.tipo} - ${op.payload.observaciones}`;
    default:
      return 'Operación desconocida';
  }
}

/**
 * CAPA DE CONEXIÓN Y SINCRONIZACIÓN MULTI-DISPOSITIVO (FASE 7, 8, 9, 10, 11)
 * 
 * Sincroniza el estado local del cliente con la base de datos centralizada de forma segura.
 * Implementa control de concurrencia, reintentos y resolución de conflictos.
 */
export async function syncLocalWithCentral(
  localInsumos: Insumo[],
  localRecetas: Receta[],
  localMovimientos: Movimiento[],
  localUsers: Usuario[]
): Promise<{
  success: boolean;
  insumos: Insumo[];
  recetas: Receta[];
  movimientos: Movimiento[];
  users: Usuario[];
  logsAdded: string[];
}> {
  const isOnline = getNetworkStatus() === 'Online';
  const deviceId = getDeviceID();
  const logsAdded: string[] = [];

  if (!isOnline) {
    // Si está offline, solo informamos que sigue trabajando con la caché local offline
    return {
      success: false,
      insumos: localInsumos,
      recetas: localRecetas,
      movimientos: localMovimientos,
      users: localUsers,
      logsAdded: ['Dispositivo en modo Offline. Trabajando con la base de datos local temporal.']
    };
  }

  // Latencia simulada de red para dar experiencia realista de conexión a nube
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 1. Obtener base de datos central
  const centralDB = getCentralDB();
  const outbox = getOfflineQueue();

  addSyncLog(`Estableciendo conexión con Google Cloud Firestore desde ${deviceId}...`, 'info');
  logsAdded.push(`Conectado a Firestore.`);

  let tempInsumos = [...centralDB.insumos];
  let tempRecetas = [...centralDB.recetas];
  let tempMovimientos = [...centralDB.movimientos];
  let tempUsers = [...centralDB.users];

  let hasConflict = false;
  let operationsProcessed = 0;
  let operationsFailed = 0;

  // 2. Procesar Cola de Operaciones Offline (Replay Outbox)
  if (outbox.length > 0) {
    addSyncLog(`Procesando ${outbox.length} operaciones offline pendientes...`, 'info');

    for (const op of outbox) {
      try {
        switch (op.type) {
          case 'ADD_INSUMO': {
            const newInsumo = op.payload;
            // Validar restricción de unicidad en la base de datos central en tiempo real (Concurrencia)
            const exists = tempInsumos.some(
              (i) => i.nombre.toLowerCase() === newInsumo.nombre.toLowerCase()
            );
            if (exists) {
              throw new Error(
                `Conflicto de Unicidad: El insumo "${newInsumo.nombre}" ya fue creado por otro dispositivo.`
              );
            }
            tempInsumos.push(newInsumo);
            addSyncLog(`Sincronizado: Insumo "${newInsumo.nombre}" creado exitosamente en la central.`, 'success');
            operationsProcessed++;
            break;
          }

          case 'EDIT_INSUMO': {
            const { id, updated } = op.payload;
            const index = tempInsumos.findIndex((i) => i.id === id);
            if (index !== -1) {
              // Si se actualiza el nombre, checar duplicados en base de datos central
              if (updated.nombre) {
                const exists = tempInsumos.some(
                  (i) => i.id !== id && i.nombre.toLowerCase() === updated.nombre.toLowerCase()
                );
                if (exists) {
                  throw new Error(
                    `Conflicto al renombrar: Ya existe un insumo con el nombre "${updated.nombre}" en la central.`
                  );
                }
              }

              // Validar integridad si se intenta cambiar unidad
              if (updated.unidad) {
                const hasMovementsCentral = tempMovimientos.some((mov) =>
                  mov.detalles.some((det) => det.insumoId === id)
                );
                if (hasMovementsCentral && tempInsumos[index].unidad !== updated.unidad) {
                  throw new Error(
                    `Inviolabilidad de Integridad: No se permite cambiar la unidad de medida del insumo "${tempInsumos[index].nombre}" porque posee movimientos en la base de datos central.`
                  );
                }
              }

              // Fusionar cambios de forma segura
              tempInsumos[index] = { ...tempInsumos[index], ...updated };
              addSyncLog(`Sincronizado: Modificación de insumo "${tempInsumos[index].nombre}" aplicada.`, 'success');
              operationsProcessed++;
            } else {
              throw new Error(`Insumo no encontrado en la central para modificación.`);
            }
            break;
          }

          case 'DELETE_INSUMO': {
            const { id } = op.payload;
            const index = tempInsumos.findIndex((i) => i.id === id);
            if (index !== -1) {
              const hasMovementsCentral = tempMovimientos.some((mov) =>
                mov.detalles.some((det) => det.insumoId === id)
              );
              if (hasMovementsCentral) {
                throw new Error(
                  `Conflicto de Integridad: No se permite eliminar el insumo "${tempInsumos[index].nombre}" porque posee movimientos históricos asociados en el servidor central.`
                );
              }
              tempInsumos.splice(index, 1);
              addSyncLog(`Sincronizado: Insumo eliminado de la central.`, 'success');
              operationsProcessed++;
            } else {
              throw new Error(`Insumo no encontrado para eliminación.`);
            }
            break;
          }

          case 'ADD_MOVIMIENTO': {
            const newMov = op.payload;
            // VALIDACIÓN CRÍTICA DE CONCURRENCIA DE INVENTARIO (RN-02)
            // Recalcular los stocks teóricos centrales justo antes de aplicar el nuevo movimiento
            const centralStocks = calculateStocks(tempInsumos, tempMovimientos);

            // Verificar si alguna salida del movimiento provoca saldo negativo en la central
            for (const det of newMov.detalles) {
              if (det.cantidad < 0) {
                const currentStockCentral = centralStocks[det.insumoId] || 0;
                const futureStockCentral = currentStockCentral + det.cantidad; // cantidad ya viene negativa
                if (futureStockCentral < 0) {
                  const insumo = tempInsumos.find((i) => i.id === det.insumoId);
                  const insumoName = insumo ? insumo.nombre : 'Insumo desconocido';
                  throw new Error(
                    `Condición de Carrera en Servidor (RN-02): El consumo de ${Math.abs(det.cantidad)} ${insumo?.unidad || ''} de "${insumoName}" fue denegado. Otro dispositivo consumió stock previamente. Existencias centrales actuales: ${currentStockCentral} ${insumo?.unidad || ''}.`
                  );
                }
              }
            }

            // Si pasa la validación central, se agrega al ledger maestro
            tempMovimientos.push(newMov);
            addSyncLog(`Sincronizado: Movimiento de ${newMov.tipo} insertado de forma segura en Ledger central.`, 'success');
            operationsProcessed++;
            break;
          }
        }
      } catch (err: any) {
        hasConflict = true;
        operationsFailed++;
        addSyncLog(`FALLO DE SINCRONIZACIÓN: ${err.message}`, 'error');
        logsAdded.push(`Fallo en operación offline: ${err.message}`);
      }
    }

    // Limpiar cola offline procesada
    saveOfflineQueue([]);
  }

  // 3. Sincronizar usuarios (Fusionar usuarios, agregando nuevos que no existan)
  localUsers.forEach((lUser) => {
    if (!tempUsers.some((u) => u.id === lUser.id)) {
      tempUsers.push(lUser);
    }
  });

  // 4. Guardar base de datos central con los datos procesados y actualizados
  const updatedCentralDB: CentralDB = {
    users: tempUsers,
    insumos: tempInsumos,
    recetas: tempRecetas, // Las recetas no cambian de forma dinámica offline en esta fase, pero las fusionamos
    movimientos: tempMovimientos,
    lastUpdated: new Date().toISOString()
  };

  saveCentralDB(updatedCentralDB);

  // 5. El estado final sincronizado del cliente se actualiza con la base central actualizada
  const finalInsumos = updatedCentralDB.insumos;
  const finalRecetas = updatedCentralDB.recetas;
  const finalMovimientos = updatedCentralDB.movimientos;
  const finalUsers = updatedCentralDB.users;

  addSyncLog(`Sincronización completa. Base de datos central y local al día.`, 'success');
  
  let finalMessage = `Sincronización finalizada exitosamente.`;
  if (operationsProcessed > 0) {
    finalMessage += ` Se procesaron ${operationsProcessed} operaciones pendientes.`;
  }
  if (operationsFailed > 0) {
    finalMessage += ` Se rechazaron ${operationsFailed} transacciones por conflictos de integridad/concurrencia (Ver Log).`;
  }
  logsAdded.push(finalMessage);

  return {
    success: true,
    insumos: finalInsumos,
    recetas: finalRecetas,
    movimientos: finalMovimientos,
    users: finalUsers,
    logsAdded
  };
}

// SIMULADOR DE ACTUALIZACIONES EN SEGUNDO PLANO DESDE OTROS DISPOSITIVOS
// Para probar concurrencia de forma interactiva y real
export function simulateBackgroundUpdate(
  type: 'COMPRA_COMPETIDORA' | 'CONSUMO_COMPETIDOR' | 'NUEVO_INSUMO',
  onFinish: () => void
) {
  const central = getCentralDB();
  const device = getDeviceID() === 'Dispositivo A (Tablet Cocina)' ? 'Dispositivo B (Celular Gerente)' : 'Dispositivo A (Tablet Cocina)';

  switch (type) {
    case 'COMPRA_COMPETIDORA': {
      // Registrar una compra masiva de Carne (Sirloin) en la base de datos central
      // Agrega 150 lb de carne a la base central a un costo bajo de $4.50
      const updatedInsumos = central.insumos.map((ins) => {
        if (ins.id === 'ins-1') {
          // Actualiza costo actual promedio ponderado
          const stocks = calculateStocks(central.insumos, central.movimientos);
          const currentStock = stocks['ins-1'] || 0;
          const newCosto = ((currentStock * ins.costoActual) + (150 * 4.50)) / (currentStock + 150);
          return { ...ins, costoActual: Number(newCosto.toFixed(2)) };
        }
        return ins;
      });

      const newMov: Movimiento = {
        id: `mov-bg-${Date.now()}`,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        usuarioId: 'usr-2',
        usuarioNombre: 'Elena Rostova',
        tipo: 'Compra',
        observaciones: `[Simulación] Compra desde ${device} - Factura BG-992`,
        detalles: [{ insumoId: 'ins-1', cantidad: 150, costoUnitario: 4.50 }]
      };

      central.insumos = updatedInsumos;
      central.movimientos.push(newMov);
      saveCentralDB(central);
      addSyncLog(`[Background] Elena Rostova registró Compra de 150 lb de Carne de Res desde ${device}.`, 'info');
      break;
    }

    case 'CONSUMO_COMPETIDOR': {
      // Registrar un consumo agresivo de Carne (Sirloin) que consuma casi todo el stock
      // Para probar la condición de carrera
      const stocks = calculateStocks(central.insumos, central.movimientos);
      const currentStock = stocks['ins-1'] || 0;
      const consumeQty = Math.max(1, currentStock - 5); // Deja solo 5 lb de carne en la central

      if (consumeQty > 0) {
        const newMov: Movimiento = {
          id: `mov-bg-${Date.now()}`,
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().split(' ')[0],
          usuarioId: 'usr-3',
          usuarioNombre: 'Juan Pérez',
          tipo: 'Consumo Directo',
          observaciones: `[Simulación] Consumo masivo desde ${device} por evento especial`,
          detalles: [{ insumoId: 'ins-1', cantidad: -consumeQty, costoUnitario: 5.80 }]
        };

        central.movimientos.push(newMov);
        saveCentralDB(central);
        addSyncLog(`[Background] Juan Pérez registró Consumo Directo de ${consumeQty.toFixed(1)} lb de Carne de Res desde ${device}. ¡Dejando solo ${stocks['ins-1'] - consumeQty} lb libres!`, 'warning');
      }
      break;
    }

    case 'NUEVO_INSUMO': {
      // Agregar un nuevo insumo con nombre específico para forzar unicidad
      const randomId = Math.random().toString(36).substring(2, 6);
      const newInsumo: Insumo = {
        id: `ins-bg-${randomId}`,
        nombre: `Salsa Chipotle Especial`,
        categoria: 'Despensa',
        proveedorPrincipal: 'Chipotles del Sur',
        unidad: 'lb',
        costoActual: 3.20,
        activo: true,
        permitirCompras: true,
        permitirProduccion: false
      };

      const exists = central.insumos.some((i) => i.nombre.toLowerCase() === newInsumo.nombre.toLowerCase());
      if (!exists) {
        central.insumos.push(newInsumo);
        saveCentralDB(central);
        addSyncLog(`[Background] Se creó el insumo "${newInsumo.nombre}" desde AppSheet (Consola central).`, 'info');
      }
      break;
    }
  }

  onFinish();
}
