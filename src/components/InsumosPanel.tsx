import React, { useState } from 'react';
import { Insumo, Usuario, UnidadMedida } from '../types';
import { Plus, Edit2, ToggleLeft, ToggleRight, Trash2, AlertCircle } from 'lucide-react';

interface InsumosPanelProps {
  insumos: Insumo[];
  activeUser: Usuario;
  onAddInsumo: (insumo: Omit<Insumo, 'id'>) => { success: boolean; error?: string };
  onEditInsumo: (id: string, updated: Partial<Insumo>) => { success: boolean; error?: string };
  onDeleteInsumo: (id: string) => { success: boolean; error?: string };
  hasMovements: (insumoId: string) => boolean;
}

export default function InsumosPanel({
  insumos,
  activeUser,
  onAddInsumo,
  onEditInsumo,
  onDeleteInsumo,
  hasMovements
}: InsumosPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Carnes');
  const [proveedorPrincipal, setProveedorPrincipal] = useState('');
  const [unidad, setUnidad] = useState<UnidadMedida>('lb');
  const [costoActual, setCostoActual] = useState(0);
  const [activo, setActivo] = useState(true);
  const [permitirCompras, setPermitirCompras] = useState(true);
  const [permitirProduccion, setPermitirProduccion] = useState(false);

  const canWrite = activeUser.rol === 'Administrador' || activeUser.rol === 'Gerente';

  const resetForm = () => {
    setNombre('');
    setCategoria('Carnes');
    setProveedorPrincipal('');
    setUnidad('lb');
    setCostoActual(0);
    setActivo(true);
    setPermitirCompras(true);
    setPermitirProduccion(false);
    setErrorMsg(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      setErrorMsg('Error de permisos: Su perfil actual no tiene autorización para realizar esta acción.');
      return;
    }
    if (!nombre.trim() || !proveedorPrincipal.trim()) {
      setErrorMsg('Todos los campos obligatorios deben estar completos.');
      return;
    }
    const result = onAddInsumo({
      nombre: nombre.trim(),
      categoria,
      proveedorPrincipal: proveedorPrincipal.trim(),
      unidad,
      costoActual: Number(costoActual),
      activo,
      permitirCompras,
      permitirProduccion
    });

    if (result && !result.success) {
      setErrorMsg(result.error || 'Error al guardar el insumo.');
      return;
    }

    setIsAdding(false);
    resetForm();
    setSuccessMsg('Insumo creado exitosamente.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const startEdit = (insumo: Insumo) => {
    if (!canWrite) {
      setErrorMsg('Error de permisos: Solo administradores o gerentes pueden editar insumos.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setEditingId(insumo.id);
    setNombre(insumo.nombre);
    setCategoria(insumo.categoria);
    setProveedorPrincipal(insumo.proveedorPrincipal);
    setUnidad(insumo.unidad);
    setCostoActual(insumo.costoActual);
    setActivo(insumo.activo);
    setPermitirCompras(insumo.permitirCompras);
    setPermitirProduccion(insumo.permitirProduccion);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!nombre.trim() || !proveedorPrincipal.trim()) {
      setErrorMsg('Todos los campos obligatorios deben estar completos.');
      return;
    }
    const result = onEditInsumo(editingId!, {
      nombre: nombre.trim(),
      categoria,
      proveedorPrincipal: proveedorPrincipal.trim(),
      unidad,
      costoActual: Number(costoActual),
      activo,
      permitirCompras,
      permitirProduccion
    });

    if (result && !result.success) {
      setErrorMsg(result.error || 'Error al actualizar el insumo.');
      return;
    }

    setEditingId(null);
    resetForm();
    setSuccessMsg('Insumo actualizado correctamente.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDelete = (id: string) => {
    if (activeUser.rol !== 'Administrador') {
      setErrorMsg('Restricción de Seguridad: Solo el Administrador del sistema puede eliminar insumos.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const result = onDeleteInsumo(id);
    if (result.success) {
      setSuccessMsg('Insumo eliminado físicamente del catálogo.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'No se pudo eliminar el insumo.');
      setTimeout(() => setErrorMsg(null), 6000);
    }
  };

  const toggleStatus = (insumo: Insumo) => {
    if (!canWrite) return;
    const result = onEditInsumo(insumo.id, { activo: !insumo.activo });
    if (result && !result.success) {
      setErrorMsg(result.error || 'Error al cambiar el estado del insumo.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="insumos-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Catálogo de Insumos</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Control y alta de insumos permitidos de cocina</p>
        </div>
        {canWrite && !isAdding && !editingId && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1 px-3 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={14} /> NUEVO INSUMO
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Regla de Negocio / Restricción:</span>
              <p className="mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 text-xs shrink-0 font-medium">
            {successMsg}
          </div>
        )}

        {/* Add/Edit Form */}
        {(isAdding || editingId) && (
          <form onSubmit={isAdding ? handleCreate : handleUpdate} className="bg-[#F8F9FA] border border-[#D1D1D1] p-4 flex flex-col gap-4 shrink-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-[#D1D1D1] pb-1">
              {isAdding ? 'Crear Nuevo Insumo' : 'Editar Insumo Existente'}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Nombre del Insumo *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Ej. Carne de Res (Sirloin)"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Categoría *</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="Carnes">Carnes</option>
                  <option value="Verduras">Verduras</option>
                  <option value="Tortillería">Tortillería</option>
                  <option value="Despensa">Despensa</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Salsas">Salsas</option>
                  <option value="Especias">Especias</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Proveedor Principal *</label>
                <input
                  type="text"
                  value={proveedorPrincipal}
                  onChange={(e) => setProveedorPrincipal(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Ej. Distribuidora del Norte"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Unidad de Medida *</label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value as UnidadMedida)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  disabled={editingId !== null && hasMovements(editingId)} // Block changing unit if there are movements
                >
                  <option value="lb">Libra (lb)</option>
                  <option value="Und">Unidad (Und)</option>
                </select>
                {editingId !== null && hasMovements(editingId) && (
                  <p className="text-[9px] text-gray-400 mt-0.5">No se puede cambiar la unidad: ya tiene movimientos.</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Costo Unitario Inicial ($)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={costoActual}
                  onChange={(e) => setCostoActual(Number(e.target.value))}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                  placeholder="0.00"
                  min="0"
                />
              </div>

              <div className="flex flex-col justify-end gap-2 py-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={permitirCompras}
                      onChange={(e) => setPermitirCompras(e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span className="text-[10px] font-bold uppercase text-gray-600">Permitir Compras</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={permitirProduccion}
                      onChange={(e) => setPermitirProduccion(e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span className="text-[10px] font-bold uppercase text-gray-600">Permitir Producción</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#D1D1D1] pt-3">
              <button
                type="button"
                onClick={() => { resetForm(); setIsAdding(false); setEditingId(null); }}
                className="border border-[#D1D1D1] hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 px-4 cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-4 cursor-pointer"
              >
                {isAdding ? 'CREAR INSUMO' : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </form>
        )}

        {/* Insumos Table */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[950px] text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#EDEDED] border-b border-[#D1D1D1] font-mono text-gray-500 z-10">
                <tr>
                  <th className="px-3 py-2 font-bold text-[10px]">NOMBRE</th>
                  <th className="px-3 py-2 font-bold text-[10px]">CATEGORÍA</th>
                  <th className="px-3 py-2 font-bold text-[10px]">PROVEEDOR PRINCIPAL</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">UNIDAD</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">COSTO ACTUAL</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">PERMISOS</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">ESTADO</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {insumos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400 italic">
                      No hay insumos creados en el catálogo.
                    </td>
                  </tr>
                ) : (
                  insumos.map((insumo) => {
                    const hasMovs = hasMovements(insumo.id);
                    return (
                      <tr key={insumo.id} className={`hover:bg-orange-50/40 ${!insumo.activo ? 'opacity-60 bg-gray-50/50' : ''}`}>
                        <td className="px-3 py-2.5 font-sans font-bold text-gray-900">{insumo.nombre}</td>
                        <td className="px-3 py-2.5 text-gray-600 font-sans">{insumo.categoria}</td>
                        <td className="px-3 py-2.5 text-gray-600 font-sans">{insumo.proveedorPrincipal}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-gray-700">{insumo.unidad}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-orange-700">${insumo.costoActual.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center text-[10px]">
                          <div className="flex items-center justify-center gap-1">
                            {insumo.permitirCompras && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold" title="Permite comprar de proveedor">COMPRA</span>
                            )}
                            {insumo.permitirProduccion && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold" title="Permite producir mediante receta">PROD</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => toggleStatus(insumo)}
                            disabled={!canWrite}
                            className={`inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                              insumo.activo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {insumo.activo ? 'ACTIVO' : 'INACTIVO'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(insumo)}
                              className="p-1 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                              title="Editar Insumo"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(insumo.id)}
                              className={`p-1 transition-colors cursor-pointer ${
                                hasMovs 
                                  ? 'text-gray-300 hover:text-gray-400 cursor-not-allowed' 
                                  : 'text-red-400 hover:bg-red-50 hover:text-red-700'
                              }`}
                              title={hasMovs ? "No se puede eliminar (RN-04: posee movimientos)" : "Eliminar del catálogo"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
