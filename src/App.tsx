import React, { useState, useMemo, useEffect } from 'react';
import { Insumo, Receta, Movimiento, Compra, Usuario, TipoMovimiento } from './types';
import { getInitialState, saveState } from './utils/seedData';
import { calculateStocks, buildRecipeTree, RecipeTreeNode, calculateRecipeCost, inventoryEngineInstance, InventoryException } from './utils/inventoryEngine';
import InsumosPanel from './components/InsumosPanel';
import ComprasPanel from './components/ComprasPanel';
import InventarioPanel from './components/InventarioPanel';
import RecetasPanel from './components/RecetasPanel';
import MovimientosPanel from './components/MovimientosPanel';
import ReportesPanel from './components/ReportesPanel';
import UsuariosPanel from './components/UsuariosPanel';
import SyncSimulatorPanel from './components/SyncSimulatorPanel';
import AppSheetIntegrationPanel from './components/AppSheetIntegrationPanel';
import { ShieldCheck, Database, RefreshCw, AlertCircle, Layout, ChefHat, Layers, ShoppingBag, User, FileSpreadsheet } from 'lucide-react';
import {
  syncLocalWithCentral,
  getNetworkStatus,
  addToOfflineQueue,
  addSyncLog,
  getCentralDB,
  getDeviceID
} from './utils/firebaseSync';
import { getSheetsConfig, pushDataToGoogleSheets, addLocalGoogleLog } from './utils/googleSheetsSync';

export default function App() {
  // Load state from localStorage / seeds
  const [state, setState] = useState(() => getInitialState());
  const [activeTab, setActiveTab] = useState<'insumos' | 'compras' | 'inventario' | 'recetas' | 'movimientos' | 'reportes' | 'usuarios' | 'appsheet'>('inventario');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>('rec-2'); // Pre-select Taco de Birria for nice UI

  const { insumos, recetas, movimientos, users, activeUser } = state;

  // Synchronization status state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Sync state back to local storage on any state change helper
  const updateStateAndPersist = (updates: Partial<typeof state>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      saveState(next.users, next.insumos, next.recetas, next.movimientos, next.activeUser);
      return next;
    });
  };

  /**
   * Sincronizador Centralizado
   */
  const triggerSync = async (currentState = state) => {
    setIsSyncing(true);
    try {
      const res = await syncLocalWithCentral(
        currentState.insumos,
        currentState.recetas,
        currentState.movimientos,
        currentState.users
      );
      if (res.success) {
        setState((prev) => {
          const updated = {
            ...prev,
            insumos: res.insumos,
            recetas: res.recetas,
            movimientos: res.movimientos,
            users: res.users
          };
          saveState(updated.users, updated.insumos, updated.recetas, updated.movimientos, updated.activeUser);
          return updated;
        });
        setLastSyncTime(new Date().toLocaleTimeString());

        // AUTOMATED GOOGLE SHEETS SYNC IN REAL TIME
        const sheetsConf = getSheetsConfig();
        if (sheetsConf.isConnected && sheetsConf.spreadsheetId && getNetworkStatus() === 'Online') {
          try {
            await pushDataToGoogleSheets(
              'mock-token',
              sheetsConf.spreadsheetId,
              { insumos: res.insumos, recetas: res.recetas, movimientos: res.movimientos },
              sheetsConf.mode
            );
            
            addLocalGoogleLog({
              user: currentState.activeUser.nombre,
              device: `Dispositivo Android (${getDeviceID()})`,
              operation: 'Sincronización Automática (Push)',
              affectedRecord: `${res.insumos.length} insumos, ${res.recetas.length} recetas`,
              source: 'Android',
              destination: 'Sheets',
              status: 'SINCRONIZADO',
              result: `Sincronización en tiempo real automática exitosa.`
            });
          } catch (sheetsErr: any) {
            console.warn('Automatic Google Sheets Sync error:', sheetsErr);
            addLocalGoogleLog({
              user: currentState.activeUser.nombre,
              device: `Dispositivo Android (${getDeviceID()})`,
              operation: 'Sincronización Automática (Push)',
              affectedRecord: 'Lote completo',
              source: 'Android',
              destination: 'Sheets',
              status: 'ERROR',
              errorMessage: sheetsErr.message || 'Error de conexión',
              result: 'No se pudo exportar automáticamente a Google Sheets.'
            });
          }
        }
      }
    } catch (err) {
      console.error("Error durando la sincronización central:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronizar en el montaje del componente
  useEffect(() => {
    triggerSync();
  }, []);

  // 1. Calculate stocks ledger on the fly
  const stocks = useMemo(() => {
    return calculateStocks(insumos, movimientos);
  }, [insumos, movimientos]);

  // Total Statistics Row calculation
  const totalStocksWeight = useMemo(() => {
    return Object.keys(stocks).reduce((acc, key) => {
      const curr = stocks[key] || 0;
      return acc + (curr > 0 ? curr : 0);
    }, 0);
  }, [stocks]);

  const totalStockValue = useMemo(() => {
    return insumos.reduce((acc, curr) => {
      const stock = stocks[curr.id] || 0;
      return acc + (stock > 0 ? stock * curr.costoActual : 0);
    }, 0);
  }, [insumos, stocks]);

  const totalMovements24h = useMemo(() => {
    // Just count total movements for simplicity
    return movimientos.length;
  }, [movimientos]);

  const totalActiveRecipes = useMemo(() => {
    return recetas.filter(r => r.activa).length;
  }, [recetas]);

  // Extract all Compras from the movements ledger to display in Compras tab
  const purchasesList = useMemo(() => {
    const list: Compra[] = [];
    movimientos.forEach((mov) => {
      if (mov.tipo === 'Compra') {
        mov.detalles.forEach((det) => {
          list.push({
            id: `${mov.id}-${det.insumoId}`,
            fecha: mov.fecha,
            proveedor: mov.observaciones.split('Proveedor: ')[1]?.split('. Documento')[0] || 'Proveedor Desconocido',
            documento: mov.observaciones.split('Documento: ')[1] || 'F-S/N',
            insumoId: det.insumoId,
            cantidad: det.cantidad,
            precioTotal: det.cantidad * det.costoUnitario,
            costoUnitario: det.costoUnitario
          });
        });
      }
    });
    return list;
  }, [movimientos]);

  // UTILITIES / HANDLERS

  const handleSelectUser = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (user) {
      updateStateAndPersist({ activeUser: user });
    }
  };

  const hasMovements = (insumoId: string): boolean => {
    return movimientos.some((mov) => mov.detalles.some((det) => det.insumoId === insumoId));
  };

  const isRecipeUsedInSubrecetas = (recipeId: string): boolean => {
    return recetas.some((r) => r.ingredientes.some((ing) => ing.tipo === 'receta' && ing.targetId === recipeId));
  };

  const isRecipeUsedInMovements = (recipeId: string): boolean => {
    return movimientos.some((m) => m.referenciaId === recipeId);
  };

  // DB HANDLERS

  const handleAddInsumo = (newInsumo: Omit<Insumo, 'id'>): { success: boolean; error?: string } => {
    const exists = insumos.some((i) => i.nombre.toLowerCase() === newInsumo.nombre.trim().toLowerCase());
    if (exists) {
      return {
        success: false,
        error: `Restricción de Unicidad: Ya existe un insumo registrado con el nombre "${newInsumo.nombre}".`
      };
    }
    const id = `ins-${Date.now()}`;
    const created: Insumo = { id, ...newInsumo };
    const nextInsumos = [...insumos, created];
    updateStateAndPersist({ insumos: nextInsumos });

    // Firebase Sync integration
    if (getNetworkStatus() === 'Offline') {
      addToOfflineQueue('ADD_INSUMO', created);
    } else {
      triggerSync({ ...state, insumos: nextInsumos });
    }

    return { success: true };
  };

  const handleEditInsumo = (id: string, updated: Partial<Insumo>): { success: boolean; error?: string } => {
    if (updated.nombre) {
      const exists = insumos.some((i) => i.id !== id && i.nombre.toLowerCase() === updated.nombre!.trim().toLowerCase());
      if (exists) {
        return {
          success: false,
          error: `Restricción de Unicidad: Ya existe otro insumo registrado con el nombre "${updated.nombre}".`
        };
      }
    }
    if (updated.unidad) {
      const currentInsumo = insumos.find((i) => i.id === id);
      if (currentInsumo && currentInsumo.unidad !== updated.unidad && hasMovements(id)) {
        return {
          success: false,
          error: 'Restricción de Integridad: No se permite cambiar la unidad de medida de un insumo con movimientos históricos asociados.'
        };
      }
    }
    const list = insumos.map((i) => (i.id === id ? { ...i, ...updated } : i));
    updateStateAndPersist({ insumos: list });

    // Firebase Sync integration
    if (getNetworkStatus() === 'Offline') {
      addToOfflineQueue('EDIT_INSUMO', { id, updated });
    } else {
      triggerSync({ ...state, insumos: list });
    }

    return { success: true };
  };

  const handleDeleteInsumo = (id: string): { success: boolean; error?: string } => {
    if (hasMovements(id)) {
      return {
        success: false,
        error: 'RN-04: No se permite la eliminación física de insumos que tengan al menos un movimiento asociado en su historial.'
      };
    }
    const list = insumos.filter((i) => i.id !== id);
    updateStateAndPersist({ insumos: list });

    // Firebase Sync integration
    if (getNetworkStatus() === 'Offline') {
      addToOfflineQueue('DELETE_INSUMO', { id });
    } else {
      triggerSync({ ...state, insumos: list });
    }

    return { success: true };
  };

  const handleAddCompra = (newCompra: {
    fecha: string;
    proveedor: string;
    documento: string;
    insumoId: string;
    cantidad: number;
    precioTotal: number;
  }): { success: boolean; error?: string } => {
    try {
      const result = inventoryEngineInstance.processCompra(
        { insumos, movimientos, activeUser },
        newCompra
      );
      updateStateAndPersist({
        insumos: result.insumos,
        movimientos: result.movimientos
      });

      // Firebase Sync integration
      const lastCreatedMov = result.movimientos[result.movimientos.length - 1];
      if (getNetworkStatus() === 'Offline') {
        addToOfflineQueue('ADD_MOVIMIENTO', lastCreatedMov);
      } else {
        triggerSync({
          ...state,
          insumos: result.insumos,
          movimientos: result.movimientos
        });
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al procesar la compra.'
      };
    }
  };

  const handleAddMovimiento = (newMov: Omit<Movimiento, 'id' | 'usuarioId' | 'usuarioNombre'>): { success: boolean; error?: string } => {
    try {
      let resultMovimientos: Movimiento[] = [];

      if (newMov.tipo === 'Consumo Directo') {
        const det = newMov.detalles[0];
        const res = inventoryEngineInstance.processConsumoDirecto(
          { insumos, movimientos, activeUser },
          {
            fecha: newMov.fecha,
            insumoId: det.insumoId,
            cantidad: Math.abs(det.cantidad),
            observaciones: newMov.observaciones
          }
        );
        resultMovimientos = res.movimientos;
      } else if (newMov.tipo === 'Consumo por Receta') {
        if (!newMov.referenciaId || newMov.referenciaCantidad === undefined) {
          throw new Error('Datos de receta de referencia faltantes.');
        }
        const res = inventoryEngineInstance.processConsumoReceta(
          { insumos, recetas, movimientos, activeUser },
          {
            fecha: newMov.fecha,
            recetaId: newMov.referenciaId,
            cantidad: newMov.referenciaCantidad,
            observaciones: newMov.observaciones
          }
        );
        resultMovimientos = res.movimientos;
      } else if (newMov.tipo === 'Ajuste') {
        const det = newMov.detalles[0];
        const res = inventoryEngineInstance.processAjuste(
          { insumos, movimientos, activeUser },
          {
            fecha: newMov.fecha,
            insumoId: det.insumoId,
            cantidad: det.cantidad,
            observaciones: newMov.observaciones
          }
        );
        resultMovimientos = res.movimientos;
      } else {
        throw new Error(`Tipo de movimiento no soportado: ${newMov.tipo}`);
      }

      updateStateAndPersist({
        movimientos: resultMovimientos
      });

      // Firebase Sync integration
      const lastCreatedMov = resultMovimientos[resultMovimientos.length - 1];
      if (getNetworkStatus() === 'Offline') {
        addToOfflineQueue('ADD_MOVIMIENTO', lastCreatedMov);
      } else {
        triggerSync({
          ...state,
          movimientos: resultMovimientos
        });
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al procesar el movimiento.'
      };
    }
  };

  const handleAddReceta = (newReceta: Omit<Receta, 'id'>): { success: boolean; error?: string } => {
    const id = `rec-${Date.now()}`;
    const created: Receta = { id, ...newReceta };
    const nextRecetas = [...recetas, created];
    updateStateAndPersist({ recetas: nextRecetas });
    
    if (getNetworkStatus() === 'Online') {
      triggerSync({ ...state, recetas: nextRecetas });
    }
    return { success: true };
  };

  const handleEditReceta = (id: string, updated: Partial<Receta>): { success: boolean; error?: string } => {
    const list = recetas.map((r) => (r.id === id ? { ...r, ...updated } : r));
    updateStateAndPersist({ recetas: list });
    
    if (getNetworkStatus() === 'Online') {
      triggerSync({ ...state, recetas: list });
    }
    return { success: true };
  };

  const handleDeleteReceta = (id: string): { success: boolean; error?: string } => {
    if (isRecipeUsedInSubrecetas(id)) {
      return {
        success: false,
        error: 'RN-05: No se puede eliminar la receta. Se encuentra utilizada como ingrediente/sub-receta en otras formulaciones activas.'
      };
    }
    if (isRecipeUsedInMovements(id)) {
      return {
        success: false,
        error: 'RN-05: No se puede eliminar la receta. Cuenta con registros de consumos históricos guardados en el libro diario.'
      };
    }

    const list = recetas.filter((r) => r.id !== id);
    updateStateAndPersist({ recetas: list });
    
    if (getNetworkStatus() === 'Online') {
      triggerSync({ ...state, recetas: list });
    }
    return { success: true };
  };

  const handleAddUser = (newUser: Omit<Usuario, 'id'>) => {
    const id = `usr-${Date.now()}`;
    const created: Usuario = { id, ...newUser };
    const nextUsers = [...users, created];
    updateStateAndPersist({ users: nextUsers });

    if (getNetworkStatus() === 'Online') {
      triggerSync({ ...state, users: nextUsers });
    }
  };

  const handleToggleUserStatus = (id: string) => {
    const list = users.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u));
    updateStateAndPersist({ users: list });

    if (getNetworkStatus() === 'Online') {
      triggerSync({ ...state, users: list });
    }
  };

  // Build recursive recipe tree representation
  const activeRecipeTree = useMemo(() => {
    if (!selectedRecipeId) return null;
    return buildRecipeTree(selectedRecipeId, 1, recetas, insumos);
  }, [selectedRecipeId, recetas, insumos]);

  // Recursively render nodes in the Recipe Tree explorer panel
  const renderTreeNodes = (node: RecipeTreeNode, depth = 0): React.ReactNode => {
    const paddingLeft = `${depth * 16}px`;
    
    // Icon/tag indicator
    const isRec = node.tipo === 'receta';
    const tagClass = isRec ? 'bg-orange-600' : 'bg-blue-500';
    const tagLetter = isRec ? 'R' : 'I';

    return (
      <div key={node.id} className="flex flex-col">
        <div
          className={`flex items-center justify-between py-1 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 text-[11px] font-mono`}
          style={{ paddingLeft }}
        >
          <div className="flex items-center gap-2 truncate">
            <span className={`text-[9px] px-1 font-bold text-white rounded ${tagClass}`}>
              {tagLetter}
            </span>
            <span className={isRec ? 'font-bold text-gray-900' : 'text-gray-600 font-sans font-medium'}>
              {node.nombre}
            </span>
          </div>
          <div className="shrink-0 text-right text-gray-500 text-[10px]">
            <span>{node.cantidad.toFixed(2)} <span className="text-[8px] uppercase">{node.unidad}</span></span>
            <span className="mx-1 text-gray-300">|</span>
            <span className="font-bold text-orange-700">${node.costoTotal.toFixed(2)}</span>
          </div>
        </div>
        {node.children && node.children.map((child) => renderTreeNodes(child, depth + 1))}
      </div>
    );
  };

  const resetAllData = () => {
    if (confirm('¿Está seguro de que desea restaurar todo el sistema de inventario? Se eliminarán las compras y movimientos personalizados.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8F9FA] font-sans text-[#1A1A1A] overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-auto py-3 lg:h-14 bg-[#1A1A1A] text-white flex flex-col lg:flex-row items-center justify-between px-4 lg:px-6 shrink-0 border-b border-[#333] z-50 gap-3 lg:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-600 flex items-center justify-center font-bold text-lg select-none">K</div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold tracking-widest uppercase">KitchenCore <span className="text-orange-500">|</span> Inventario</h1>
            <span className="text-[9px] font-mono text-gray-400 -mt-0.5 tracking-wider">MÓDULO ARQUITECTURA DE COCINA</span>
          </div>
        </div>

        {/* Quick User Play-Role Swapper (Incredibly interactive!) */}
        <div className="flex items-center gap-3 sm:gap-6 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-gray-500 text-[10px] uppercase">Rendimiento:</span>
            <span className="text-green-400 font-bold flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse"></span> OPERACIONAL
            </span>
          </div>
          
          <div className="flex items-center gap-2 border-l border-gray-700 pl-3 sm:pl-4">
            <span className="text-gray-500 text-[10px] uppercase hidden xs:inline">Perfil:</span>
            <select
              value={activeUser.id}
              onChange={(e) => handleSelectUser(e.target.value)}
              className="bg-[#2D2D2D] text-white border border-[#444] px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-orange-500 cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
            >
              {users.filter(u => u.activo).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Outer Dashboard Content Layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-auto lg:overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-56 bg-[#EDEDED] border-b lg:border-b-0 lg:border-r border-[#D1D1D1] flex flex-col shrink-0">
          <div className="p-3 lg:p-4 flex flex-row lg:flex-col gap-1.5 lg:gap-1 flex-1 overflow-x-auto lg:overflow-x-visible scrollbar-thin min-w-0">
            <div className="hidden lg:block text-[10px] text-gray-500 font-bold uppercase mb-2 tracking-wider shrink-0">Módulos de Control</div>
            
            <button
              onClick={() => setActiveTab('inventario')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'inventario' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <Database size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Inventario Central</span>
            </button>

            <button
              onClick={() => setActiveTab('insumos')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'insumos' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <Layout size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Catálogo de Insumos</span>
            </button>

            <button
              onClick={() => setActiveTab('compras')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'compras' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <ShoppingBag size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Ingreso de Compras</span>
            </button>

            <button
              onClick={() => setActiveTab('recetas')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'recetas' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <ChefHat size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Recetas (Recursivo)</span>
            </button>

            <button
              onClick={() => setActiveTab('movimientos')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'movimientos' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <Layers size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Movimientos Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('reportes')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'reportes' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <ShieldCheck size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Tablero Reportes</span>
            </button>

            <button
              onClick={() => setActiveTab('usuarios')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'usuarios' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-gray-900 border-l-2 lg:border-l-4 border-l-orange-500' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <User size={13} className="text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">Usuarios / Roles</span>
            </button>

            <button
              onClick={() => setActiveTab('appsheet')}
              className={`flex items-center gap-2 px-3 py-1.5 lg:py-2 text-xs font-medium text-left border cursor-pointer transition-all shrink-0 ${activeTab === 'appsheet' ? 'bg-white border-[#D1D1D1] shadow-sm font-bold text-[#107c41] border-l-2 lg:border-l-4 border-l-emerald-600' : 'text-gray-600 border-transparent hover:bg-[#E5E5E5]'}`}
            >
              <FileSpreadsheet size={13} className="text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap font-bold text-emerald-800">Integración AppSheet</span>
            </button>

            <div className="lg:mt-8 border-l lg:border-l-0 lg:border-t border-[#D1D1D1] pl-2 lg:pl-0 lg:pt-3 flex flex-col justify-center shrink-0">
              <button
                onClick={resetAllData}
                className="flex items-center justify-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-mono font-bold border border-red-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                title="Borrar localStorage y restaurar datos semilla"
              >
                <RefreshCw size={11} className="shrink-0" /> <span className="hidden lg:inline">RESTAURAR BD</span><span className="lg:hidden">RESTAURAR</span>
              </button>
            </div>
          </div>
          
          <div className="hidden lg:block p-4 border-t border-[#D1D1D1] bg-[#E5E5E5] text-[9px] font-mono text-gray-500 leading-normal shrink-0">
            SISTEMA DE CONTROL TOTAL<br />V 1.0.4 - ARQUITECTURA MODULAR
          </div>
        </nav>

        {/* Main Workspace Frame Area */}
        <main className="flex-1 flex flex-col p-3 lg:p-5 gap-4 overflow-auto lg:overflow-hidden min-w-0">
          {/* Panel de Sincronización y Simulador */}
          <SyncSimulatorPanel
            onSyncTrigger={() => triggerSync()}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
          />

          {/* Global Summary Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 shrink-0">
            <div className="bg-white border border-[#D1D1D1] p-3 flex flex-col min-w-0">
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider truncate" title="Existencias Totales">Existencias Totales</span>
              <span className="text-sm sm:text-base md:text-xl font-mono font-bold mt-0.5 text-gray-900 truncate">
                {totalStocksWeight.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] md:text-xs font-normal text-gray-400">lb/und</span>
              </span>
            </div>

            <div className="bg-white border border-[#D1D1D1] p-3 border-l-4 border-l-orange-500 flex flex-col min-w-0">
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider truncate" title="Valor del Inventario">Valor del Inventario</span>
              <span className="text-sm sm:text-base md:text-xl font-mono font-bold mt-0.5 text-orange-600 truncate">
                ${totalStockValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-white border border-[#D1D1D1] p-3 flex flex-col min-w-0">
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider truncate" title="Movimientos Ledger (Histórico)">Movimientos Ledger (Histórico)</span>
              <span className="text-sm sm:text-base md:text-xl font-mono font-bold mt-0.5 text-gray-900 truncate">
                {totalMovements24h}
              </span>
            </div>

            <div className="bg-white border border-[#D1D1D1] p-3 flex flex-col min-w-0">
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider truncate" title="Recetas Activas">Recetas Activas</span>
              <span className="text-sm sm:text-base md:text-xl font-mono font-bold mt-0.5 text-gray-900 truncate">
                {totalActiveRecipes}
              </span>
            </div>
          </div>

          {/* Lower Workspace split screen: Active Tab + Sidebar widgets */}
          <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-5 overflow-visible lg:overflow-hidden min-w-0">
            {/* Left: Tab Panel */}
            <div className="flex-[1.8] min-w-0 bg-white border border-[#D1D1D1] flex flex-col h-[550px] lg:h-auto overflow-hidden">
              {activeTab === 'inventario' && (
                <InventarioPanel insumos={insumos} stocks={stocks} />
              )}
              {activeTab === 'insumos' && (
                <InsumosPanel
                  insumos={insumos}
                  activeUser={activeUser}
                  onAddInsumo={handleAddInsumo}
                  onEditInsumo={handleEditInsumo}
                  onDeleteInsumo={handleDeleteInsumo}
                  hasMovements={hasMovements}
                />
              )}
              {activeTab === 'compras' && (
                <ComprasPanel
                  compras={purchasesList}
                  insumos={insumos}
                  activeUser={activeUser}
                  getCurrentStock={(id) => stocks[id] || 0}
                  onAddCompra={handleAddCompra}
                />
              )}
              {activeTab === 'recetas' && (
                <RecetasPanel
                  recetas={recetas}
                  insumos={insumos}
                  activeUser={activeUser}
                  selectedRecipeId={selectedRecipeId}
                  onSelectRecipeId={setSelectedRecipeId}
                  onAddReceta={handleAddReceta}
                  onEditReceta={handleEditReceta}
                  onDeleteReceta={handleDeleteReceta}
                  isRecipeUsedInSubrecetas={isRecipeUsedInSubrecetas}
                  isRecipeUsedInMovements={isRecipeUsedInMovements}
                />
              )}
              {activeTab === 'movimientos' && (
                <MovimientosPanel
                  movimientos={movimientos}
                  insumos={insumos}
                  recetas={recetas}
                  activeUser={activeUser}
                  onAddMovimiento={handleAddMovimiento}
                />
              )}
              {activeTab === 'reportes' && (
                <ReportesPanel
                  insumos={insumos}
                  movimientos={movimientos}
                  compras={purchasesList}
                  stocks={stocks}
                />
              )}
              {activeTab === 'usuarios' && (
                <UsuariosPanel
                  users={users}
                  activeUser={activeUser}
                  onAddUser={handleAddUser}
                  onToggleUserStatus={handleToggleUserStatus}
                />
              )}
              {activeTab === 'appsheet' && (
                <AppSheetIntegrationPanel
                  insumos={insumos}
                  recetas={recetas}
                  movimientos={movimientos}
                  activeUser={activeUser}
                  onUpdateInsumos={(updatedList) => updateStateAndPersist({ insumos: updatedList })}
                  triggerSync={() => triggerSync()}
                />
              )}
            </div>

            {/* Right: Sidebar Widgets */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-visible lg:overflow-hidden h-auto lg:h-auto">
              
              {/* Recursive Recipe Explorer widget */}
              <section className="bg-white border border-[#D1D1D1] flex flex-col p-4 shrink-0 overflow-hidden max-h-none lg:max-h-[45%] min-h-[220px]">
                <div className="flex items-center gap-1.5 border-b border-[#D1D1D1] pb-1.5 mb-2 shrink-0">
                  <Database size={13} className="text-orange-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Explorador de Receta Recursiva</span>
                </div>

                <div className="overflow-auto flex-1 pr-1">
                  {activeRecipeTree ? (
                    <div className="flex flex-col border-l-2 border-orange-500 pl-2">
                      {renderTreeNodes(activeRecipeTree)}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 italic text-center py-6">
                      Seleccione una receta en el panel para visualizar su desglose de ingredientes recursivo en tiempo real.
                    </div>
                  )}
                </div>

                {selectedRecipeId && (
                  <div className="mt-2 shrink-0 bg-orange-50 text-[10px] text-orange-800 p-1.5 font-mono border border-orange-100 leading-normal flex items-start gap-1.5">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>Resolviendo costo recursivo completo: <strong className="font-bold">${calculateRecipeCost(selectedRecipeId, recetas, insumos).toFixed(2)}</strong> por porción.</span>
                  </div>
                )}
              </section>

              {/* Feed de Últimos Movimientos */}
              <section className="bg-white border border-[#D1D1D1] flex-1 flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-2 flex items-center justify-between shrink-0">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Últimos Movimientos</h2>
                  <span className="text-[9px] font-mono text-gray-400">Ledger</span>
                </div>

                <div className="overflow-auto flex-1 p-3">
                  <div className="flex flex-col gap-3">
                    {movimientos.slice(-6).reverse().map((mov) => {
                      let tagColor = 'border-l-blue-500';
                      let label = 'CONSUMO DIRECTO';

                      if (mov.tipo === 'Compra') {
                        tagColor = 'border-l-green-500';
                        label = 'COMPRA DE PROVEEDOR';
                      } else if (mov.tipo === 'Consumo por Receta') {
                        tagColor = 'border-l-orange-500';
                        label = 'CONSUMO DE RECETA';
                      } else if (mov.tipo === 'Ajuste') {
                        const isNeg = mov.detalles.some(d => d.cantidad < 0);
                        tagColor = isNeg ? 'border-l-red-500' : 'border-l-purple-500';
                        label = isNeg ? 'AJUSTE NEGATIVO (MERMA)' : 'AJUSTE POSITIVO';
                      }

                      return (
                        <div key={mov.id} className={`text-[10px] border-l-2 ${tagColor} pl-2 py-0.5`}>
                          <div className="flex justify-between font-bold">
                            <span>{label}</span>
                            <span className="text-gray-400 font-mono font-normal">{mov.hora.slice(0, 5)}</span>
                          </div>
                          <div className="text-gray-500 font-sans truncate" title={mov.observaciones}>
                            {mov.observaciones}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

            </div>
          </div>
        </main>
      </div>

      {/* Footer status bar */}
      <footer className="h-auto py-2 lg:h-8 bg-[#E2E2E2] border-t border-[#CCC] flex flex-col lg:flex-row items-center px-4 lg:px-6 justify-between text-[10px] text-gray-500 shrink-0 font-mono gap-1.5 lg:gap-0">
        <div className="flex flex-wrap justify-center gap-3 lg:gap-6">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> CACHÉ LOCAL: ACTIVA
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${getNetworkStatus() === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            NUBE FIRESTORE: {getNetworkStatus() === 'Online' ? 'CONECTADO' : 'OFFLINE (Sinc. Pendiente)'}
          </span>
          {lastSyncTime && (
            <span className="hidden md:inline">ÚLTIMA SYNC: {lastSyncTime}</span>
          )}
          <span className="hidden sm:inline">LATENCIA RED: {isSyncing ? 'Conectando...' : '800ms (Nube)'}</span>
        </div>
        <div className="font-bold uppercase text-gray-700">
          DISPOSITIVO: {getDeviceID()} | ROL: {activeUser.rol}
        </div>
      </footer>
    </div>
  );
}
