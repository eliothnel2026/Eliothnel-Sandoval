import React, { useState } from 'react';
import { Insumo, Receta, Movimiento, Usuario, TipoMovimiento, MovimientoDetalle } from '../types';
import { Plus, AlertCircle, ShoppingBag, ArrowDownLeft, Sliders, ChevronDown, ChevronUp, History, User } from 'lucide-react';
import { calculateStocks, resolveRecipeToInsumos } from '../utils/inventoryEngine';

interface MovimientosPanelProps {
  movimientos: Movimiento[];
  insumos: Insumo[];
  recetas: Receta[];
  activeUser: Usuario;
  onAddMovimiento: (movimiento: Omit<Movimiento, 'id' | 'usuarioId' | 'usuarioNombre'>) => { success: boolean; error?: string };
}

export default function MovimientosPanel({
  movimientos,
  insumos,
  recetas,
  activeUser,
  onAddMovimiento
}: MovimientosPanelProps) {
  const [activeFormTab, setActiveFormTab] = useState<'consumo_directo' | 'consumo_receta' | 'ajuste'>('consumo_directo');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedMovId, setExpandedMovId] = useState<string | null>(null);

  // Form states
  const [observaciones, setObservaciones] = useState('');
  
  // Consumo Directo State
  const [cdInsumoId, setCdInsumoId] = useState('');
  const [cdCantidad, setCdCantidad] = useState<number>(0);

  // Consumo por Receta State
  const [crRecetaId, setCrRecetaId] = useState('');
  const [crCantidad, setCrCantidad] = useState<number>(0);

  // Ajuste State
  const [ajInsumoId, setAjInsumoId] = useState('');
  const [ajCantidad, setAjCantidad] = useState<number>(0); // positive or negative
  const [ajSigno, setAjSigno] = useState<'positivo' | 'negativo'>('negativo');

  // Permissions validation
  const canDoAjuste = activeUser.rol === 'Administrador' || activeUser.rol === 'Gerente';

  const resetForm = () => {
    setObservaciones('');
    setCdInsumoId('');
    setCdCantidad(0);
    setCrRecetaId('');
    setCrCantidad(0);
    setAjInsumoId('');
    setAjCantidad(0);
    setAjSigno('negativo');
    setErrorMsg(null);
  };

  const handleRegisterConsumoDirecto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cdInsumoId) {
      setErrorMsg('Debe seleccionar un insumo.');
      return;
    }
    if (cdCantidad <= 0) {
      setErrorMsg('La cantidad a descontar debe ser mayor que cero.');
      return;
    }
    if (!observaciones.trim()) {
      setErrorMsg('Las observaciones de salida directa son obligatorias para el historial de mermas.');
      return;
    }

    const insumo = insumos.find((i) => i.id === cdInsumoId);
    if (!insumo) return;

    // Build details: Consumo directo is an exit, so quantity is negative
    const detalles: MovimientoDetalle[] = [
      {
        insumoId: cdInsumoId,
        cantidad: -cdCantidad,
        costoUnitario: insumo.costoActual
      }
    ];

    const result = onAddMovimiento({
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().split(' ')[0],
      tipo: 'Consumo Directo',
      observaciones: observaciones.trim(),
      detalles
    });

    if (result.success) {
      setSuccessMsg('Consumo directo registrado con éxito. Descuento aplicado en el ledger.');
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'No se pudo procesar el movimiento.');
    }
  };

  const handleRegisterConsumoReceta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crRecetaId) {
      setErrorMsg('Debe seleccionar una receta.');
      return;
    }
    if (crCantidad <= 0) {
      setErrorMsg('La cantidad de porciones a producir debe ser mayor que cero.');
      return;
    }
    if (!observaciones.trim()) {
      setErrorMsg('Las observaciones son obligatorias para justificar la orden de preparación.');
      return;
    }

    const receta = recetas.find((r) => r.id === crRecetaId);
    if (!receta) return;

    try {
      // 1. Resolve recursive tree of recipe ingredients to flat insumos requirements
      const resolved = resolveRecipeToInsumos(crRecetaId, crCantidad, recetas, insumos);
      
      // 2. Map flat requirements to ledger details (exits are negative)
      const detalles: MovimientoDetalle[] = Object.entries(resolved).map(([insumoId, qty]) => {
        const ins = insumos.find((i) => i.id === insumoId);
        return {
          insumoId,
          cantidad: -qty,
          costoUnitario: ins ? ins.costoActual : 0
        };
      });

      const result = onAddMovimiento({
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        tipo: 'Consumo por Receta',
        observaciones: observaciones.trim(),
        referenciaId: crRecetaId,
        referenciaNombre: receta.nombre,
        referenciaCantidad: crCantidad,
        detalles
      });

      if (result.success) {
        setSuccessMsg(`Consumo por receta exitoso. Se desglosaron ${detalles.length} insumos primarios y se descontaron correspondientemente.`);
        resetForm();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(result.error || 'Error al procesar el consumo.');
      }
    } catch (err: any) {
      setErrorMsg(`Error de resolución recursiva: ${err.message}`);
    }
  };

  const handleRegisterAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDoAjuste) {
      setErrorMsg('Error de permisos: Su rol actual no permite registrar ajustes de inventario.');
      return;
    }
    if (!ajInsumoId) {
      setErrorMsg('Debe seleccionar un insumo.');
      return;
    }
    if (ajCantidad <= 0) {
      setErrorMsg('La cantidad del ajuste debe ser mayor que cero.');
      return;
    }
    if (!observaciones.trim()) {
      setErrorMsg('La justificación/observación del ajuste es obligatoria por motivos de auditoría.');
      return;
    }

    const insumo = insumos.find((i) => i.id === ajInsumoId);
    if (!insumo) return;

    const finalQty = ajSigno === 'positivo' ? ajCantidad : -ajCantidad;

    const detalles: MovimientoDetalle[] = [
      {
        insumoId: ajInsumoId,
        cantidad: finalQty,
        costoUnitario: insumo.costoActual
      }
    ];

    const result = onAddMovimiento({
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().split(' ')[0],
      tipo: 'Ajuste',
      observaciones: observaciones.trim(),
      detalles
    });

    if (result.success) {
      setSuccessMsg('Ajuste de inventario aplicado y auditado de forma segura.');
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'Error al aplicar el ajuste.');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedMovId === id) {
      setExpandedMovId(null);
    } else {
      setExpandedMovId(id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="movimientos-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Movimientos de Inventario</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Control transaccional estricto de consumos y ajustes</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
          <User size={12} className="text-gray-400" />
          <span>OPERADOR ACTIVO: <strong className="text-gray-700">{activeUser.nombre} ({activeUser.rol})</strong></span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">RN-02: Transacción Abortada (Operación Bloqueada)</span>
              <p className="mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 text-xs shrink-0 font-medium">
            {successMsg}
          </div>
        )}

        {/* Dynamic Navigation Form Tabs */}
        <div className="border border-[#D1D1D1] bg-white flex flex-col shrink-0">
          <div className="flex border-b border-[#D1D1D1] bg-[#F1F1F1]">
            <button
              type="button"
              onClick={() => { resetForm(); setActiveFormTab('consumo_directo'); }}
              className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-r border-[#D1D1D1] ${activeFormTab === 'consumo_directo' ? 'bg-white border-b-2 border-b-orange-500' : 'text-gray-500 hover:bg-[#EAEAEA]'}`}
            >
              Consumo Directo
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setActiveFormTab('consumo_receta'); }}
              className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-r border-[#D1D1D1] ${activeFormTab === 'consumo_receta' ? 'bg-white border-b-2 border-b-orange-500' : 'text-gray-500 hover:bg-[#EAEAEA]'}`}
            >
              Consumo por Receta
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setActiveFormTab('ajuste'); }}
              disabled={!canDoAjuste}
              className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider cursor-pointer ${!canDoAjuste ? 'opacity-40 cursor-not-allowed text-gray-400' : activeFormTab === 'ajuste' ? 'bg-white border-b-2 border-b-orange-500' : 'text-gray-500 hover:bg-[#EAEAEA]'}`}
              title={!canDoAjuste ? 'Solo Administrador y Gerente pueden realizar ajustes de stock' : 'Sincronizar discrepancias'}
            >
              Ajuste Manual {!canDoAjuste && '(Bloqueado)'}
            </button>
          </div>

          <div className="p-4 bg-[#F8F9FA]">
            {/* 1. Consumo Directo Form */}
            {activeFormTab === 'consumo_directo' && (
              <form onSubmit={handleRegisterConsumoDirecto} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Insumo a Descontar *</label>
                    <select
                      value={cdInsumoId}
                      onChange={(e) => setCdInsumoId(e.target.value)}
                      className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Seleccionar Insumo --</option>
                      {insumos.filter(i => i.activo).map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad a Retirar *</label>
                    <div className="flex">
                      <input
                        type="number"
                        step="0.01"
                        value={cdCantidad || ''}
                        onChange={(e) => setCdCantidad(Number(e.target.value))}
                        className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                        placeholder="0.00"
                        min="0.01"
                        required
                      />
                      <span className="bg-gray-100 border border-[#D1D1D1] border-l-0 px-3 flex items-center text-gray-500 font-bold uppercase text-[10px]">
                        {cdInsumoId ? insumos.find((i) => i.id === cdInsumoId)?.unidad : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Observaciones / Motivo de Salida *</label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej. Desperdicio: Soda Uva rota accidentalmente al cargar estante"
                    className="w-full bg-white border border-[#D1D1D1] p-2 text-xs focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end border-t border-[#D1D1D1] pt-3">
                  <button
                    type="submit"
                    className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-6 cursor-pointer"
                  >
                    REGISTRAR CONSUMO DIRECTO
                  </button>
                </div>
              </form>
            )}

            {/* 2. Consumo por Receta Form */}
            {activeFormTab === 'consumo_receta' && (
              <form onSubmit={handleRegisterConsumoReceta} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-sans">Seleccionar Plato / Receta a Despachar *</label>
                    <select
                      value={crRecetaId}
                      onChange={(e) => setCrRecetaId(e.target.value)}
                      className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Seleccionar Receta --</option>
                      {recetas.filter(r => r.activa).map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-sans">Porciones Preparadas *</label>
                    <div className="flex">
                      <input
                        type="number"
                        step="1"
                        value={crCantidad || ''}
                        onChange={(e) => setCrCantidad(Number(e.target.value))}
                        className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                        placeholder="Porciones (Entero)"
                        min="1"
                        required
                      />
                      <span className="bg-gray-100 border border-[#D1D1D1] border-l-0 px-3 flex items-center text-gray-500 font-bold uppercase text-[10px]">
                        Servicios
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-sans">Observaciones de la Orden *</label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej. Almuerzos de mesa de servicio - Evento corporativo mediodía"
                    className="w-full bg-white border border-[#D1D1D1] p-2 text-xs focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end border-t border-[#D1D1D1] pt-3">
                  <button
                    type="submit"
                    className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-6 cursor-pointer"
                  >
                    CONSUMIR POR RECETA (DESCONTAR ARBOL)
                  </button>
                </div>
              </form>
            )}

            {/* 3. Ajuste Form */}
            {activeFormTab === 'ajuste' && canDoAjuste && (
              <form onSubmit={handleRegisterAjuste} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Insumo a Ajustar *</label>
                    <select
                      value={ajInsumoId}
                      onChange={(e) => setAjInsumoId(e.target.value)}
                      className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                      required
                    >
                      <option value="">-- Seleccionar Insumo --</option>
                      {insumos.filter(i => i.activo).map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Sentido del Ajuste *</label>
                    <select
                      value={ajSigno}
                      onChange={(e) => setAjSigno(e.target.value as 'positivo' | 'negativo')}
                      className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="negativo">Merma / Pérdida (-) </option>
                      <option value="positivo">Sobrante / Entrada (+)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad *</label>
                    <div className="flex">
                      <input
                        type="number"
                        step="0.01"
                        value={ajCantidad || ''}
                        onChange={(e) => setAjCantidad(Number(e.target.value))}
                        className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                        placeholder="0.00"
                        min="0.01"
                        required
                      />
                      <span className="bg-gray-100 border border-[#D1D1D1] border-l-0 px-3 flex items-center text-gray-500 font-bold uppercase text-[10px]">
                        {ajInsumoId ? insumos.find((i) => i.id === ajInsumoId)?.unidad : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Justificación del Ajuste (Mandatorio) *</label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej. Sincronización tras inventario físico - Bolsa abierta en mal estado"
                    className="w-full bg-white border border-[#D1D1D1] p-2 text-xs focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end border-t border-[#D1D1D1] pt-3">
                  <button
                    type="submit"
                    className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-6 cursor-pointer"
                  >
                    APLICAR AJUSTE DE AUDITORÍA
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Audit Movements Log List */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="bg-gray-100 border-b border-[#D1D1D1] px-3 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <History size={12} className="text-gray-400" />
              <span>Libro Diario de Movimientos (Trazabilidad ACID)</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">Total movimientos: {movimientos.length}</span>
          </div>

          <div className="overflow-auto flex-1">
            <div className="p-3 flex flex-col gap-2">
              {[...movimientos].reverse().map((mov) => {
                const isExpanded = expandedMovId === mov.id;
                
                // Color sidebar mapping
                let sideColor = 'border-l-blue-500';
                if (mov.tipo === 'Compra') sideColor = 'border-l-green-500';
                if (mov.tipo === 'Ajuste') {
                  const isNeg = mov.detalles.some(d => d.cantidad < 0);
                  sideColor = isNeg ? 'border-l-red-500' : 'border-l-purple-500';
                }

                return (
                  <div
                    key={mov.id}
                    className={`bg-white border border-gray-200 border-l-4 ${sideColor} p-3 flex flex-col hover:bg-orange-50/5 transition-colors`}
                  >
                    <div className="flex justify-between items-start text-xs font-mono">
                      <div>
                        <span className="font-bold text-gray-900">{mov.tipo.toUpperCase()}</span>
                        {mov.referenciaNombre && (
                          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-700 font-bold rounded text-[9px]">
                            {mov.referenciaNombre} ({mov.referenciaCantidad} porc.)
                          </span>
                        )}
                        <p className="text-[11px] text-gray-500 font-sans mt-1">{mov.observaciones}</p>
                      </div>

                      <div className="text-right text-gray-400 text-[10px] shrink-0">
                        <div className="font-bold text-gray-600">{mov.fecha} {mov.hora}</div>
                        <div>Reg por: {mov.usuarioNombre}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-between items-center border-t border-gray-100 pt-2 shrink-0">
                      <span className="text-[10px] text-gray-400 font-mono">Afectación: {mov.detalles.length} insumo(s)</span>
                      <button
                        onClick={() => toggleExpand(mov.id)}
                        className="text-[10px] font-bold font-mono text-gray-500 hover:text-orange-600 flex items-center gap-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>OCULTAR DETALLES <ChevronUp size={12} /></>
                        ) : (
                          <>VER DETALLES <ChevronDown size={12} /></>
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 bg-gray-50 border border-gray-100 p-2 text-[11px] font-mono">
                        <div className="grid grid-cols-4 font-bold text-gray-500 border-b border-gray-200 pb-1 mb-1">
                          <span>Insumo</span>
                          <span className="text-right">Cantidad</span>
                          <span className="text-right">Valor Unitario</span>
                          <span className="text-right">Subtotal</span>
                        </div>
                        {mov.detalles.map((det, index) => {
                          const ins = insumos.find((i) => i.id === det.insumoId);
                          const subtotal = det.cantidad * det.costoUnitario;
                          return (
                            <div key={index} className="grid grid-cols-4 py-1 border-b border-gray-100 last:border-0">
                              <span className="font-sans font-medium text-gray-800 truncate">{ins ? ins.nombre : 'Insumo Eliminado'}</span>
                              <span className={`text-right font-bold ${det.cantidad < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {det.cantidad > 0 ? '+' : ''}{det.cantidad.toFixed(2)} {ins?.unidad}
                              </span>
                              <span className="text-right text-gray-500">${det.costoUnitario.toFixed(2)}</span>
                              <span className="text-right text-gray-600">${subtotal.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
