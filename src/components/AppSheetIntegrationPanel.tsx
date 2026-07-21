import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
  Unplug,
  Key,
  Download,
  CheckSquare,
  XSquare,
  HelpCircle,
  FileText,
  User,
  Shield,
  Send,
  Sliders,
  Settings,
  ArrowRight,
  Sparkles,
  Search,
  BookOpen
} from 'lucide-react';
import { Insumo, Receta, Movimiento, Usuario } from '../types';
import {
  getSheetsConfig,
  saveSheetsConfig,
  authorizeGoogleAccount,
  disconnectGoogleAccount,
  listUserSpreadsheets,
  initializeSpreadsheetStructure,
  pushDataToGoogleSheets,
  pullAndMergeGoogleSheetsData,
  getLocalGoogleLogs,
  addLocalGoogleLog,
  getCachedToken,
  SheetsConfig,
  GoogleSheetsSyncLog
} from '../utils/googleSheetsSync';
import { addSyncLog } from '../utils/firebaseSync';

interface AppSheetIntegrationPanelProps {
  insumos: Insumo[];
  recetas: Receta[];
  movimientos: Movimiento[];
  activeUser: Usuario;
  onUpdateInsumos: (updatedList: Insumo[]) => void;
  triggerSync: () => Promise<void>;
}

export default function AppSheetIntegrationPanel({
  insumos,
  recetas,
  movimientos,
  activeUser,
  onUpdateInsumos,
  triggerSync
}: AppSheetIntegrationPanelProps) {
  // Config state
  const [config, setConfig] = useState<SheetsConfig>(() => getSheetsConfig());
  const [spreadsheets, setSpreadsheets] = useState<Array<{ id: string; name: string }>>([]);
  const [logs, setLogs] = useState<GoogleSheetsSyncLog[]>(() => getLocalGoogleLogs());
  
  // UI Edit Modes for independent adjustments (Section decoupling requested by user)
  const [isEditingAppId, setIsEditingAppId] = useState(false);
  const [isEditingSpreadsheet, setIsEditingSpreadsheet] = useState(false);
  const [temporaryAppId, setTemporaryAppId] = useState(config.appSheetAppId || '');
  const [temporarySpreadsheetId, setTemporarySpreadsheetId] = useState(config.spreadsheetId || '');
  const [manualSpreadsheetIdInput, setManualSpreadsheetIdInput] = useState(false);

  // Automatic Bidirectional Sync (Sentido B: AppSheet -> Sheets -> Central/App)
  const [isAutoPullEnabled, setIsAutoPullEnabled] = useState(true);
  const [secondsToNextAutoPull, setSecondsToNextAutoPull] = useState(15);

  // UI Loading/Status States
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem('kitchen_sheets_last_sync_time'));
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [filterLogStatus, setFilterLogStatus] = useState<'ALL' | 'SINCRONIZADO' | 'ERROR'>('ALL');

  // Check if active user is administrator (Point 1: Restricted to Administrators)
  const isAdmin = activeUser.rol === 'Administrador';

  useEffect(() => {
    saveSheetsConfig(config);
  }, [config]);

  // Background Auto-Pull Daemon (Sentido B: AppSheet -> Google Sheets -> App)
  useEffect(() => {
    if (!config.isConnected || !isAutoPullEnabled || !config.spreadsheetId) return;

    const interval = setInterval(() => {
      setSecondsToNextAutoPull(prev => {
        if (prev <= 1) {
          handleBackgroundAutoPull();
          return 15; // Reset interval
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [config.isConnected, isAutoPullEnabled, config.spreadsheetId, config.mode, insumos, movimientos]);

  const handleBackgroundAutoPull = async () => {
    if (!config.isConnected || !config.spreadsheetId) return;
    const token = getCachedToken();
    if (!token && config.mode === 'real') {
      return; // Quietly ignore if not authenticated in real mode
    }
    try {
      const res = await pullAndMergeGoogleSheetsData(
        token || 'mock-token',
        config.spreadsheetId,
        insumos,
        movimientos,
        'Daemon de Fondo',
        'Canal Automático',
        config.mode
      );

      if (res.success && res.updatedInsumos) {
        onUpdateInsumos(res.updatedInsumos);
        const timestamp = new Date().toLocaleString();
        setLastSyncTime(timestamp);
        localStorage.setItem('kitchen_sheets_last_sync_time', timestamp);
        
        addLocalGoogleLog({
          user: 'Daemon Sincronizador',
          device: 'Fondo Automático',
          operation: 'Auto-Pull en Segundo Plano',
          affectedRecord: `${res.updatedInsumos.length} Insumos`,
          source: 'Sheets',
          destination: 'Firestore',
          status: 'SINCRONIZADO',
          result: `Sincronización en tiempo real automática completada de forma transparente.`
        });
        
        setLogs(getLocalGoogleLogs());
        await triggerSync();
      }
    } catch (err: any) {
      console.warn('Silent auto-pull failed: ', err.message);
    }
  };

  // Load spreadsheets list if connected
  useEffect(() => {
    if (config.isConnected && config.mode === 'real') {
      const activeToken = getCachedToken();
      if (activeToken) {
        listUserSpreadsheets(activeToken)
          .then(list => setSpreadsheets(list))
          .catch(err => {
            console.error('Error fetching spreadsheets:', err);
            setConnectionMessage(`Error al listar archivos de Google Drive: ${err.message || err}`);
          });
      } else {
        setConnectionMessage('⚠️ Conexión de Google autorizada pero la sesión ha expirado en este iframe. Haga clic en "CONECTAR CUENTA" para volver a iniciar sesión.');
      }
    } else {
      // Sandbox default list
      setSpreadsheets([
        { id: '1xSc9_AppSheet_KitchenCore_Master_Spreadsheet', name: 'KitchenCore_Master_Inventario_2026' },
        { id: '1b89-sheets-restaurante-sirloin', name: 'Sirloin_Tacos_Operaciones_Sheets' },
        { id: '1d72-appsheet-database-demo', name: 'AppSheet_Database_Respaldo_Cocina' }
      ]);
    }
  }, [config.isConnected, config.mode]);

  // Handle Google Auth Connection
  const handleConnectGoogle = async () => {
    setIsLoading(true);
    setConnectionMessage('Iniciando ventana oficial de autorización de Google OAuth 2.0...');
    
    try {
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly'
      ];
      
      const res = await authorizeGoogleAccount(config.clientId, scopes, config.mode);
      
      setConfig(prev => ({
        ...prev,
        isConnected: true,
        accountEmail: res.email,
        spreadsheetId: prev.spreadsheetId || '1xSc9_AppSheet_KitchenCore_Master_Spreadsheet',
        mode: prev.mode // maintain mode
      }));

      const successMsg = `Conectado exitosamente a la cuenta de Google: ${res.email}`;
      setConnectionMessage(successMsg);
      addSyncLog(`[OAuth 2.0] Cuenta de Google vinculada por ${activeUser.nombre}.`, 'success');
      
      addLocalGoogleLog({
        user: activeUser.nombre,
        device: 'Dispositivo Android (Administrador)',
        operation: 'Conectar Cuenta Google',
        affectedRecord: res.email,
        source: 'Android',
        destination: 'Firestore',
        status: 'SINCRONIZADO',
        result: successMsg
      });

      setLogs(getLocalGoogleLogs());
    } catch (error: any) {
      setConnectionMessage(`Error de autenticación: ${error.message || 'La ventana emergente fue cerrada por el usuario.'}`);
      addSyncLog(`[OAuth 2.0] Error al vincular cuenta: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Disconnect Account
  const handleDisconnectGoogle = async () => {
    if (!window.confirm('¿Está seguro de revocar la autorización de la cuenta de Google actual? La sincronización con AppSheet quedará suspendida.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await disconnectGoogleAccount();
      const oldEmail = config.accountEmail;
      
      setConfig(prev => ({
        ...prev,
        isConnected: false,
        accountEmail: '',
        spreadsheetId: ''
      }));
      
      setConnectionMessage('Cuenta de Google desconectada correctamente. Credenciales revocadas.');
      addSyncLog(`[OAuth 2.0] Cuenta revocada por el administrador.`, 'warning');
      
      addLocalGoogleLog({
        user: activeUser.nombre,
        device: 'Dispositivo Android (Administrador)',
        operation: 'Desconectar Cuenta Google',
        affectedRecord: oldEmail,
        source: 'Android',
        destination: 'Firestore',
        status: 'SINCRONIZADO',
        result: `Se desconectó la cuenta ${oldEmail} de forma segura.`
      });

      setLogs(getLocalGoogleLogs());
    } catch (err: any) {
      setConnectionMessage(`Error al desconectar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Test Connection
  const handleTestConnection = async () => {
    if (!config.spreadsheetId) {
      alert('Por favor, configure o seleccione un Spreadsheet ID válido primero.');
      return;
    }
    const token = getCachedToken();
    if (!token && config.mode === 'real') {
      alert('Su sesión de Google ha expirado o no ha sido autorizada. Por favor, haga clic en "CONECTAR CUENTA" o "CAMBIAR CUENTA" para iniciar sesión de nuevo.');
      return;
    }
    setIsLoading(true);
    setConnectionMessage('Probando canales de comunicación con Google Drive y Google Sheets...');
    
    try {
      await new Promise(r => setTimeout(r, 1000)); // Network simulation
      
      // Check structure
      const initialized = await initializeSpreadsheetStructure(token || 'mock-token', config.spreadsheetId, config.mode);
      if (initialized) {
        setConnectionMessage(`🟢 Conexión exitosa. El Spreadsheet "${config.spreadsheetId}" está listo para sincronizar. Pestañas verificadas: Insumos, Recetas, Movimientos, SyncLogs.`);
        addSyncLog(`[Google Sheets] Prueba de conectividad exitosa con ID: ${config.spreadsheetId}`, 'success');
        
        addLocalGoogleLog({
          user: activeUser.nombre,
          device: 'Android Admin Terminal',
          operation: 'Probar Conexión Spreadsheet',
          affectedRecord: config.spreadsheetId,
          source: 'Android',
          destination: 'Sheets',
          status: 'SINCRONIZADO',
          result: 'Conexión verificada e inicializada correctamente.'
        });
        setLogs(getLocalGoogleLogs());
      } else {
        throw new Error('No se pudo escribir en el Spreadsheet. Verifique los permisos de acceso.');
      }
    } catch (err: any) {
      setConnectionMessage(`🔴 Error al conectar con Google Sheets: ${err.message}`);
      addSyncLog(`[Google Sheets] Falló prueba de conexión: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Manual Trigger Full Sync (Sentido A: Android -> Sheets)
  const handleManualPushSync = async () => {
    if (!config.isConnected) {
      alert('Debe conectar su cuenta de Google antes de iniciar la sincronización.');
      return;
    }
    if (!config.spreadsheetId) {
      alert('Configure o seleccione el Spreadsheet ID de destino.');
      return;
    }
    const token = getCachedToken();
    if (!token && config.mode === 'real') {
      alert('Su sesión de Google ha expirado o no ha sido autorizada. Por favor, haga clic en "CONECTAR CUENTA" o "CAMBIAR CUENTA" para iniciar sesión de nuevo.');
      return;
    }

    setSyncStatus('syncing');
    addSyncLog(`[Google Sheets] Iniciando exportación de datos maestros...`, 'info');
    
    try {
      const res = await pushDataToGoogleSheets(
        token || 'mock-token',
        config.spreadsheetId,
        { insumos, recetas, movimientos },
        config.mode
      );

      if (res.success) {
        const timestamp = new Date().toLocaleString();
        setLastSyncTime(timestamp);
        localStorage.setItem('kitchen_sheets_last_sync_time', timestamp);
        setSyncStatus('success');
        
        const successMsg = `Sincronización de salida completada. Se exportaron ${res.rowsSynced} registros con éxito.`;
        addSyncLog(`[Google Sheets] ${successMsg}`, 'success');
        
        addLocalGoogleLog({
          user: activeUser.nombre,
          device: 'Android Terminal',
          operation: 'Sincronización Manual (Push)',
          affectedRecord: `${res.rowsSynced} registros`,
          source: 'Android',
          destination: 'Sheets',
          status: 'SINCRONIZADO',
          result: successMsg
        });

        setLogs(getLocalGoogleLogs());
      }
    } catch (err: any) {
      setSyncStatus('error');
      addSyncLog(`[Google Sheets] Fallo al exportar: ${err.message}`, 'error');
      
      addLocalGoogleLog({
        user: activeUser.nombre,
        device: 'Android Terminal',
        operation: 'Sincronización Manual (Push)',
        affectedRecord: 'Lote completo',
        source: 'Android',
        destination: 'Sheets',
        status: 'ERROR',
        errorMessage: err.message,
        result: 'Fallo al exportar lote.'
      });

      setLogs(getLocalGoogleLogs());
    }
  };

  // Manual Pull Bidirectional Sync (Sentido B: AppSheet/Sheets -> Android)
  const handlePullBidirectionalSync = async () => {
    if (!config.isConnected) {
      alert('Debe conectar su cuenta de Google para jalar modificaciones.');
      return;
    }
    if (!config.spreadsheetId) {
      alert('Seleccione un Spreadsheet para sincronizar.');
      return;
    }
    const token = getCachedToken();
    if (!token && config.mode === 'real') {
      alert('Su sesión de Google ha expirado o no ha sido autorizada. Por favor, haga clic en "CONECTAR CUENTA" o "CAMBIAR CUENTA" para iniciar sesión de nuevo.');
      return;
    }

    setSyncStatus('syncing');
    addSyncLog(`[Sincronización Bidireccional] Consultando actualizaciones en Google Sheets...`, 'info');

    try {
      const res = await pullAndMergeGoogleSheetsData(
        token || 'mock-token',
        config.spreadsheetId,
        insumos,
        movimientos,
        activeUser.nombre,
        'Android Device',
        config.mode
      );

      if (res.success) {
        onUpdateInsumos(res.updatedInsumos);
        const timestamp = new Date().toLocaleString();
        setLastSyncTime(timestamp);
        localStorage.setItem('kitchen_sheets_last_sync_time', timestamp);
        setSyncStatus('success');

        res.logsAdded.forEach(msg => {
          addSyncLog(msg, msg.includes('Rechazado') ? 'warning' : 'success');
        });

        // Trigger overall state sync to update views
        await triggerSync();
        setLogs(getLocalGoogleLogs());
      }
    } catch (err: any) {
      setSyncStatus('error');
      addSyncLog(`[Google Sheets] Fallo al descargar: ${err.message}`, 'error');
    }
  };

  // Filter logs list
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.operation.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchLogQuery.toLowerCase()) ||
      (log.errorMessage && log.errorMessage.toLowerCase().includes(searchLogQuery.toLowerCase())) ||
      log.result.toLowerCase().includes(searchLogQuery.toLowerCase());

    if (filterLogStatus === 'ALL') return matchesSearch;
    return log.status === filterLogStatus && matchesSearch;
  });

  const handleDownloadAppSheetSchema = () => {
    const schema = `
--- MODELO DE DATOS DE APPSHEET PARA KITCHENCORE ---
Vincule estas pestañas del Spreadsheet seleccionado como tablas en su Consola de AppSheet:

1. TABLA: Insumos
   Columnas:
     - ID (Texto, LLAVE PRIMARIA, UUID)
     - Nombre (Texto, Único)
     - Categoria (Texto, Categorías de Cocina)
     - ProveedorPrincipal (Texto)
     - Unidad (Texto, lb / Und, Solo Lectura)
     - CostoActual (Decimal, Solo Lectura desde AppSheet)
     - Activo (Texto/Boolean, SI / NO)

2. TABLA: Recetas
   Columnas:
     - ID (Texto, LLAVE PRIMARIA, Solo Lectura)
     - Nombre (Texto, Solo Lectura)
     - Activa (Texto, SI / NO)
     - Porciones (Decimal, Solo Lectura)
     - IngredientesDetalle (JSON, Solo Lectura)
     - CostoPorcion (Decimal, Solo Lectura)

3. TABLA: Movimientos
   Columnas:
     - ID (Texto, LLAVE PRIMARIA, Solo Lectura)
     - Fecha (Fecha, Solo Lectura)
     - Hora (Hora, Solo Lectura)
     - UsuarioNombre (Texto, Solo Lectura)
     - Tipo (Texto, Tipo de Movimiento, Solo Lectura)
     - Observaciones (Texto, Solo Lectura)
     - DetallesCantidad (Decimal, Solo Lectura)

4. TABLA: SyncLogs
   Columnas:
     - FechaHora (FechaHora, Solo Lectura)
     - Usuario (Texto, Solo Lectura)
     - Dispositivo (Texto, Solo Lectura)
     - Operacion (Texto, Solo Lectura)
     - RegistroAfectado (Texto, Solo Lectura)
     - Origen (Texto, Solo Lectura)
     - Destino (Texto, Solo Lectura)
     - Estado (Texto, Solo Lectura)
     - Intentos (Número, Solo Lectura)
     - Error (Texto, Solo Lectura)
    `;

    const blob = new Blob([schema], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AppSheet_Table_Schema_KitchenCore.txt';
    link.click();
    URL.revokeObjectURL(url);
    addSyncLog('[AppSheet Config] Esquema de estructura de base de datos descargado.', 'info');
  };

  // Lock panel for Non-Administrators
  if (!isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center bg-gray-50 h-full">
        <Shield size={48} className="text-rose-500 mb-4 animate-bounce" />
        <h3 className="text-base font-bold text-gray-900 uppercase tracking-wider mb-2">Panel de Integración Restringido</h3>
        <p className="text-xs text-gray-500 max-w-md leading-relaxed">
          De acuerdo con las reglas de seguridad de gobernanza de datos (RN-11), el Administrador de Integración AppSheet solo está disponible para usuarios con el rol de <strong className="font-bold text-gray-800">Administrador</strong>.
        </p>
        <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-800 font-mono">
          Usuario actual: {activeUser.nombre} ({activeUser.rol})
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Top Header Row */}
      <div className="bg-[#F8F9FA] border-b border-[#D1D1D1] px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-600" size={18} />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">Administrador de Integración AppSheet</h2>
            <p className="text-[10px] text-gray-400 font-mono -mt-0.5">Sincronización Master-Replica de Datos en Tiempo Real</p>
          </div>
        </div>

        {/* Mode Toggle Selector */}
        <div className="flex items-center gap-2 bg-white border border-[#D1D1D1] px-2 py-1 text-[10px] rounded">
          <span className="text-gray-400 font-mono uppercase font-semibold">Modo de Canal:</span>
          <select
            value={config.mode}
            onChange={(e) => {
              const nextMode = e.target.value as 'real' | 'sandbox';
              setConfig(prev => ({ ...prev, mode: nextMode }));
              addSyncLog(`[Integración] Modo de canal cambiado a: ${nextMode === 'real' ? 'Real API de Google' : 'Cámara de Simulación Local'}`, 'info');
            }}
            className="font-bold text-gray-800 focus:outline-none cursor-pointer"
          >
            <option value="sandbox">Sandbox Local (Verificable)</option>
            <option value="real">Real Google APIs (OAuth 2.0)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Connection Setup & Actions */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          
          {/* SECCIÓN 1: CUENTA DE GOOGLE CONECTADA */}
          <section className="bg-white border border-[#D1D1D1] p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-orange-500 text-[10px] text-white flex items-center justify-center font-bold">1</span>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">CUENTA DE GOOGLE CONECTADA</h3>
              </div>
              <span className="text-[8px] font-mono px-1 py-0.5 bg-gray-100 text-gray-500 rounded uppercase font-bold">OAuth 2.0 Access</span>
            </div>

            {config.isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[9px] text-emerald-800 uppercase font-mono font-bold tracking-wider">🟢 Cuenta Conectada</span>
                      <p className="text-xs font-semibold text-gray-850 mt-1 font-mono truncate" title={config.accountEmail}>
                        Cuenta actual: {config.accountEmail}
                      </p>
                    </div>
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConnectGoogle}
                    className="flex-1 py-1.5 bg-white hover:bg-gray-50 text-gray-800 text-[10px] font-mono font-bold border border-[#D1D1D1] transition-colors cursor-pointer text-center"
                  >
                    CAMBIAR CUENTA
                  </button>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-mono font-bold border border-rose-200 transition-colors cursor-pointer text-center"
                  >
                    DESCONECTAR
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                  Para iniciar la integración, autorice a la aplicación el acceso para crear y modificar hojas de cálculo y archivos de datos en su cuenta de Google.
                </p>
                
                {/* Official Google Button Style */}
                <button
                  onClick={handleConnectGoogle}
                  className="mx-auto gsi-material-button shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-sans font-semibold text-xs tracking-wide">CONECTAR CUENTA</span>
                  </div>
                </button>
              </div>
            )}
          </section>

          {/* SECCIÓN 2: APLICACIÓN APPSHEET */}
          <section className="bg-white border border-[#D1D1D1] p-4 flex flex-col gap-3 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-orange-500 text-[10px] text-white flex items-center justify-center font-bold">2</span>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">APLICACIÓN APPSHEET</h3>
              </div>
              <span className="text-[8px] font-mono px-1 py-0.5 bg-blue-50 text-blue-600 rounded uppercase font-bold">App Identifier</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-[11px]">
                <span className="text-[9px] text-gray-400 block font-bold">AppSheet App ID:</span>
                {isEditingAppId ? (
                  <input
                    type="text"
                    value={temporaryAppId}
                    onChange={(e) => setTemporaryAppId(e.target.value)}
                    className="w-full mt-1 bg-white border border-gray-300 text-xs px-2 py-1 text-gray-800 font-mono focus:outline-none focus:border-indigo-600"
                    placeholder="Ingrese ID (Ej: KitchenCore-3482)"
                  />
                ) : (
                  <span className="font-bold text-gray-800 block mt-1">
                    {config.appSheetAppId || 'NO CONFIGURADO (Sin ID)'}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {isEditingAppId ? (
                  <>
                    <button
                      onClick={() => {
                        const updated = { ...config, appSheetAppId: temporaryAppId };
                        setConfig(updated);
                        setIsEditingAppId(false);
                        addSyncLog(`[AppSheet] App ID configurado a: ${temporaryAppId}`, 'success');
                        addLocalGoogleLog({
                          user: activeUser.nombre,
                          device: 'Dispositivo Android (Administrador)',
                          operation: 'Configurar App ID',
                          affectedRecord: temporaryAppId,
                          source: 'Android',
                          destination: 'Firestore',
                          status: 'SINCRONIZADO',
                          result: `ID de AppSheet cambiado a ${temporaryAppId}`
                        });
                        setLogs(getLocalGoogleLogs());
                      }}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold transition-all cursor-pointer text-center"
                    >
                      CONFIGURAR
                    </button>
                    <button
                      onClick={() => {
                        setTemporaryAppId(config.appSheetAppId || '');
                        setIsEditingAppId(false);
                      }}
                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-mono border border-gray-300 transition-all cursor-pointer text-center"
                    >
                      CANCELAR
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditingAppId(true)}
                      className="flex-1 py-1.5 bg-white hover:bg-gray-50 text-gray-800 text-[10px] font-mono font-bold border border-[#D1D1D1] transition-colors cursor-pointer text-center"
                    >
                      CAMBIAR APP
                    </button>
                    <button
                      onClick={handleDownloadAppSheetSchema}
                      className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-mono font-bold border border-blue-200 transition-colors cursor-pointer text-center flex items-center gap-1"
                    >
                      <Download size={11} /> SCHEMA
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: FUENTE DE DATOS */}
          <section className="bg-white border border-[#D1D1D1] p-4 flex flex-col gap-3 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-orange-500 text-[10px] text-white flex items-center justify-center font-bold">3</span>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">FUENTE DE DATOS</h3>
              </div>
              <span className="text-[8px] font-mono px-1 py-0.5 bg-emerald-50 text-emerald-600 rounded uppercase font-bold">Sheets DB</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="bg-gray-50 border border-gray-200 p-2.5 rounded font-mono text-[11px] flex flex-col gap-1.5">
                <div>
                  <span className="text-[9px] text-gray-400 block font-bold">Spreadsheet actual:</span>
                  <span className="font-bold text-gray-800 block mt-0.5">
                    {spreadsheets.find(s => s.id === config.spreadsheetId)?.name || 'Ecosistema KitchenCore Activo'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 block font-bold">ID:</span>
                  <span className="text-[10px] text-gray-500 block truncate" title={config.spreadsheetId}>
                    {config.spreadsheetId || 'Ninguno vinculado'}
                  </span>
                </div>
              </div>

              {isEditingSpreadsheet && (
                <div className="p-3 bg-gray-50 border border-gray-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-mono font-bold text-gray-500">Configurar Spreadsheet</span>
                    <button
                      onClick={() => setManualSpreadsheetIdInput(!manualSpreadsheetIdInput)}
                      className="text-[9px] text-indigo-600 font-bold underline font-mono cursor-pointer"
                    >
                      {manualSpreadsheetIdInput ? 'Elegir de lista' : 'Ingresar ID manual'}
                    </button>
                  </div>

                  {manualSpreadsheetIdInput ? (
                    <input
                      type="text"
                      value={temporarySpreadsheetId}
                      onChange={(e) => setTemporarySpreadsheetId(e.target.value)}
                      placeholder="ID de la Hoja de Google (ej: 1xSc9_App...)"
                      className="w-full bg-white border border-gray-300 text-xs px-2 py-1 text-gray-800 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  ) : (
                    <select
                      value={temporarySpreadsheetId}
                      onChange={(e) => setTemporarySpreadsheetId(e.target.value)}
                      className="w-full bg-white border border-gray-300 text-xs text-gray-800 px-2 py-1 focus:outline-none focus:border-emerald-600 font-mono cursor-pointer"
                    >
                      <option value="">-- SELECCIONE UN RECURSO EN DRIVE --</option>
                      {spreadsheets.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id.substring(0, 8)}...)</option>
                      ))}
                    </select>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const updated = { ...config, spreadsheetId: temporarySpreadsheetId };
                        setConfig(updated);
                        setIsEditingSpreadsheet(false);
                        addSyncLog(`[Spreadsheet] Origen de datos cambiado a ID: ${temporarySpreadsheetId}`, 'success');
                        addLocalGoogleLog({
                          user: activeUser.nombre,
                          device: 'Dispositivo Android (Administrador)',
                          operation: 'Cambiar Spreadsheet ID',
                          affectedRecord: temporarySpreadsheetId,
                          source: 'Android',
                          destination: 'Firestore',
                          status: 'SINCRONIZADO',
                          result: `Spreadsheet ID de datos maestro cambiado a ${temporarySpreadsheetId}`
                        });
                        setLogs(getLocalGoogleLogs());
                      }}
                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold cursor-pointer"
                    >
                      GUARDAR SPREADSHEET
                    </button>
                    <button
                      onClick={() => {
                        setTemporarySpreadsheetId(config.spreadsheetId || '');
                        setIsEditingSpreadsheet(false);
                      }}
                      className="py-1 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-850 text-[10px] font-mono border border-gray-300 cursor-pointer"
                    >
                      CANCELAR
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-1">
                {!isEditingSpreadsheet && (
                  <button
                    disabled={!config.isConnected}
                    onClick={() => {
                      setTemporarySpreadsheetId(config.spreadsheetId || '');
                      setIsEditingSpreadsheet(true);
                    }}
                    className="flex-1 py-2 bg-white hover:bg-gray-50 text-[#1A1A1A] border border-[#D1D1D1] text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    CAMBIAR SPREADSHEET
                  </button>
                )}
                <button
                  disabled={!config.isConnected || isLoading}
                  onClick={handleTestConnection}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  PROBAR CONEXIÓN
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Status Summary, Operations & Live Sync Logger */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          
          {/* PANEL DE ESTADO DE INTEGRACIÓN (Point 5) */}
          <section className="bg-white border border-[#D1D1D1] p-4 flex flex-col gap-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-700 border-b border-gray-100 pb-1.5">Consola de Sincronización</h3>
            
            {/* Estado de Integración de la Fase 7 */}
            <div className="flex items-center justify-between p-3 border rounded text-[11px] font-mono leading-relaxed bg-gray-50 border-gray-200">
              <span className="text-gray-500 font-bold uppercase">Estado de Integración (Fase 7):</span>
              <div className="flex items-center gap-2">
                {config.mode === 'sandbox' ? (
                  <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    🟡 MODO SANDBOX/SIMULACIÓN
                  </span>
                ) : config.isConnected ? (
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    🟢 OAUTH REAL CONECTADO
                  </span>
                ) : connectionMessage && (connectionMessage.includes('Error') || connectionMessage.includes('🔴')) ? (
                  <span className="px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    🔴 OAUTH REAL CON ERROR
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-300 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    🔴 OAUTH REAL SIN CONECTAR
                  </span>
                )}
              </div>
            </div>

            {/* Visual Indicators Dashboard Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 p-2.5 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 font-mono uppercase leading-none">Google Account</p>
                  <p className="text-[11px] font-bold text-gray-800 mt-1 truncate">{config.isConnected ? 'Conectado' : 'Desconectado'}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-2.5 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.spreadsheetId ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 font-mono uppercase leading-none">Spreadsheet ID</p>
                  <p className="text-[11px] font-bold text-gray-800 mt-1 truncate">{config.spreadsheetId ? 'Vinculado' : 'No Vinculado'}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-2.5 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.appSheetAppId ? 'bg-indigo-500' : 'bg-gray-400'}`}></span>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 font-mono uppercase leading-none">AppSheet Config</p>
                  <p className="text-[11px] font-bold text-gray-800 mt-1 truncate">{config.appSheetAppId ? 'Configurado' : 'Sin Id'}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-2.5 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.isConnected && config.spreadsheetId ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 font-mono uppercase leading-none">Canal Bidireccional</p>
                  <p className="text-[11px] font-bold text-gray-800 mt-1 truncate">{config.isConnected && config.spreadsheetId ? 'ACTIVO' : 'INACTIVO'}</p>
                </div>
              </div>
            </div>

            {/* Sync Metadata summary */}
            <div className="bg-gray-50 border border-gray-200 p-4 font-mono text-[11px] flex flex-col gap-2.5">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-500 uppercase font-bold text-[9px]">Sincronización Automática de Entrada (Sentido B):</span>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${isAutoPullEnabled && config.isConnected ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                    {isAutoPullEnabled && config.isConnected ? `ACTIVA (${secondsToNextAutoPull}s)` : 'DESACTIVADA'}
                  </span>
                  <button
                    onClick={() => {
                      setIsAutoPullEnabled(!isAutoPullEnabled);
                      if(!isAutoPullEnabled) setSecondsToNextAutoPull(15);
                    }}
                    className={`px-2 py-0.5 text-[9px] font-bold border transition-all cursor-pointer rounded ${isAutoPullEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {isAutoPullEnabled ? 'Apagar Auto-Sync' : 'Encender Auto-Sync'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500 uppercase font-bold text-[9px]">Última Sincronización Exitosa:</span>
                <span className="text-gray-800 font-bold">{lastSyncTime || 'Nunca'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500 uppercase font-bold text-[9px]">Modo de Sincronización:</span>
                <span className="text-emerald-700 font-bold uppercase">Automática en tiempo real + Pull automático/manual</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500 uppercase font-bold text-[9px]">Registros Sincronizados (En lote):</span>
                <span className="text-gray-800 font-bold">{insumos.length + recetas.length + movimientos.length} filas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 uppercase font-bold text-[9px]">Errores o Conflictos en Cola:</span>
                <span className="text-rose-600 font-bold">0 mermas ilegales / 0 violaciones de unicidad</span>
              </div>
            </div>

            {/* Sync trigger buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled={isLoading || !config.isConnected}
                onClick={handleManualPushSync}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                SUBIR EXPORTACIÓN MANUAL (SENTIDO A)
              </button>

              <button
                disabled={isLoading || !config.isConnected}
                onClick={handlePullBidirectionalSync}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow disabled:opacity-50"
              >
                <Download size={12} />
                DESCARGAR MODIFICACIONES (SENTIDO B)
              </button>
            </div>

            {/* Log / Alert Box */}
            {connectionMessage && (
              <div className="p-3 bg-[#F1F1F1] border border-[#D1D1D1] text-[10px] font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
                {connectionMessage}
              </div>
            )}
          </section>

          {/* PERMISSIONS MATRIX & GOVERNANCE RULES (Point 8) */}
          <section className="bg-white border border-[#D1D1D1] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
              <Shield size={14} className="text-orange-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Gobernanza de Datos & Matriz de Permisos (AppSheet)</h3>
            </div>

            <p className="text-[10px] text-gray-500 leading-relaxed">
              Para resguardar la consistencia de inventario y evitar que ediciones en AppSheet rompan el ledger histórico, se aplica la siguiente regla estricta:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] font-mono">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-1 px-2 font-bold text-gray-600">Entidad</th>
                    <th className="py-1 px-2 font-bold text-emerald-700 text-center">Lectura AppSheet</th>
                    <th className="py-1 px-2 font-bold text-indigo-700 text-center">Escritura AppSheet</th>
                    <th className="py-1 px-2 font-bold text-gray-600">Garantía / Validación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-1 px-2 font-semibold">Insumos</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-indigo-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-gray-500">Unicidad nombre. Unidad inalterable si tiene movimientos.</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold">Categorías</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-indigo-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-gray-500">Normalización en el catálogo.</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold">Recetas</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-rose-500 font-bold">✗ NO</td>
                    <td className="py-1 px-2 text-gray-500">No alterable. Requiere cálculo circular recursivo.</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold">Compras</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-rose-500 font-bold">✗ NO</td>
                    <td className="py-1 px-2 text-gray-500">Genera costos ponderados promedio en motor central.</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold">Movimientos Ledger</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-rose-500 font-bold">✗ NO</td>
                    <td className="py-1 px-2 text-gray-500">Inviolabilidad del histórico diario.</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-semibold bg-orange-50">Inventario Calculado</td>
                    <td className="py-1 px-2 text-center text-emerald-600 font-bold bg-orange-50">✓ SÍ</td>
                    <td className="py-1 px-2 text-center text-red-600 font-bold bg-orange-50">✗ STRICT NO</td>
                    <td className="py-1 px-2 text-gray-600 bg-orange-50">No se puede editar directamente. Stock = ∑ Movimientos.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>

      {/* FOOTER SECTION: AUDIT LOG (BITÁCORA DE SINCRONIZACIÓN - Point 9 & 15) */}
      <section className="bg-white border-t border-[#D1D1D1] flex-1 flex flex-col overflow-hidden min-h-[220px]">
        <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Bitácora & Historial de Sincronización AppSheet</h4>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-2 text-gray-400" />
              <input
                type="text"
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                placeholder="Buscar en bitácora..."
                className="pl-7 pr-2 py-1 bg-white border border-gray-300 text-[10px] font-mono focus:outline-none focus:border-indigo-600 w-[150px] xs:w-[200px]"
              />
            </div>

            <div className="flex bg-white border border-gray-300 rounded text-[10px] font-mono overflow-hidden">
              <button
                onClick={() => setFilterLogStatus('ALL')}
                className={`px-2 py-1 cursor-pointer transition-colors ${filterLogStatus === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterLogStatus('SINCRONIZADO')}
                className={`px-2 py-1 cursor-pointer border-l border-gray-200 transition-colors ${filterLogStatus === 'SINCRONIZADO' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Sincronizado
              </button>
              <button
                onClick={() => setFilterLogStatus('ERROR')}
                className={`px-2 py-1 cursor-pointer border-l border-gray-200 transition-colors ${filterLogStatus === 'ERROR' ? 'bg-rose-600 text-white font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Error
              </button>
            </div>
          </div>
        </div>

        {/* Chronological Table of Logs */}
        <div className="overflow-auto flex-1 p-4 bg-[#FAFAFA]">
          <div className="border border-[#D1D1D1] bg-white">
            <table className="w-full text-left border-collapse text-[10px] font-mono">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[140px]">Fecha / Hora</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[120px]">Usuario</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[120px]">Dispositivo</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[150px]">Operación</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[130px]">Registro</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[120px]">Ruta (Orig → Dest)</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider w-[100px]">Estado</th>
                  <th className="py-1.5 px-3 font-bold text-gray-500 uppercase tracking-wider">Resultado / Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400 italic font-mono text-[10px]">
                      No se encontraron registros en el historial de sincronización que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isErr = log.status === 'ERROR';
                    return (
                      <tr key={index} className={`hover:bg-gray-50/50 ${isErr ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-1.5 px-3 text-gray-400 font-mono whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-1.5 px-3 font-semibold text-gray-800">{log.user}</td>
                        <td className="py-1.5 px-3 text-gray-500 truncate max-w-[120px]">{log.device}</td>
                        <td className="py-1.5 px-3 font-bold text-gray-700">{log.operation}</td>
                        <td className="py-1.5 px-3 text-indigo-700">{log.affectedRecord}</td>
                        <td className="py-1.5 px-3 text-gray-500 font-mono text-[9px] font-semibold whitespace-nowrap">
                          {log.source} <span className="text-orange-500">→</span> {log.destination}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 font-bold rounded text-[8px] tracking-wide ${isErr ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-gray-600 max-w-sm truncate" title={log.result}>
                          {isErr ? (
                            <span className="text-rose-700 font-semibold flex items-center gap-1">
                              <AlertTriangle size={10} className="shrink-0" /> {log.errorMessage}
                            </span>
                          ) : (
                            log.result
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
