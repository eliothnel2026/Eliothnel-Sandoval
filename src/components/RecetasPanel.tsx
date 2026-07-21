import React, { useState } from 'react';
import { Insumo, Receta, RecetaIngrediente, Usuario } from '../types';
import { Plus, Trash2, Edit2, AlertCircle, Sparkles, FolderTree } from 'lucide-react';
import { calculateRecipeCost, hasCircularDependency } from '../utils/inventoryEngine';

interface RecetasPanelProps {
  recetas: Receta[];
  insumos: Insumo[];
  activeUser: Usuario;
  selectedRecipeId: string | null;
  onSelectRecipeId: (id: string | null) => void;
  onAddReceta: (receta: Omit<Receta, 'id'>) => { success: boolean; error?: string };
  onEditReceta: (id: string, updated: Partial<Receta>) => { success: boolean; error?: string };
  onDeleteReceta: (id: string) => { success: boolean; error?: string };
  isRecipeUsedInSubrecetas: (id: string) => boolean;
  isRecipeUsedInMovements: (id: string) => boolean;
}

export default function RecetasPanel({
  recetas,
  insumos,
  activeUser,
  selectedRecipeId,
  onSelectRecipeId,
  onAddReceta,
  onEditReceta,
  onDeleteReceta,
  isRecipeUsedInSubrecetas,
  isRecipeUsedInMovements
}: RecetasPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activa, setActiva] = useState(true);
  const [ingredientes, setIngredientes] = useState<RecetaIngrediente[]>([]);

  const canWrite = activeUser.rol === 'Administrador' || activeUser.rol === 'Gerente';

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setActiva(true);
    setIngredientes([]);
    setErrorMsg(null);
  };

  const addIngredientRow = () => {
    setIngredientes([...ingredientes, { tipo: 'insumo', targetId: '', cantidad: 0 }]);
  };

  const removeIngredientRow = (index: number) => {
    setIngredientes(ingredientes.filter((_, idx) => idx !== index));
  };

  const handleIngredientChange = (index: number, field: keyof RecetaIngrediente, value: any) => {
    const updated = [...ingredientes];
    if (field === 'tipo') {
      updated[index] = { tipo: value, targetId: '', cantidad: 0 };
    } else if (field === 'targetId') {
      updated[index].targetId = value;
    } else if (field === 'cantidad') {
      updated[index].cantidad = Number(value);
    }
    setIngredientes(updated);
  };

  const validateRecipeAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    if (!nombre.trim()) {
      setErrorMsg('El nombre de la receta es obligatorio.');
      return;
    }

    if (ingredientes.length === 0) {
      setErrorMsg('Una receta debe tener al menos un ingrediente.');
      return;
    }

    // Validate empty ingredient targets or zero quantities
    for (const ing of ingredientes) {
      if (!ing.targetId) {
        setErrorMsg('Por favor seleccione todos los ingredientes o elimine las filas vacías.');
        return;
      }
      if (ing.cantidad <= 0) {
        setErrorMsg('La cantidad de todos los ingredientes debe ser mayor que cero.');
        return;
      }
    }

    // Validate circular dependency
    if (editingId) {
      for (const ing of ingredientes) {
        if (ing.tipo === 'receta') {
          // Check if editing recipe to include another recipe creates a circular loop
          const hasCycle = hasCircularDependency(ing.targetId, editingId, recetas);
          if (hasCycle || ing.targetId === editingId) {
            setErrorMsg(`RN-06: Bloqueado por dependencia circular. La subreceta seleccionada contiene directa o indirectamente a esta receta.`);
            return;
          }
        }
      }
    }

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      activa,
      ingredientes
    };

    let result;
    if (isAdding) {
      result = onAddReceta(payload);
    } else {
      result = onEditReceta(editingId!, payload);
    }

    if (result.success) {
      setSuccessMsg(isAdding ? 'Receta creada exitosamente.' : 'Receta modificada correctamente.');
      setIsAdding(false);
      setEditingId(null);
      resetForm();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'Error al guardar la receta.');
    }
  };

  const startEdit = (receta: Receta) => {
    if (!canWrite) {
      setErrorMsg('Error de permisos: Solo administradores o gerentes pueden editar recetas.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setEditingId(receta.id);
    setNombre(receta.nombre);
    setDescripcion(receta.descripcion || '');
    setActiva(receta.activa);
    setIngredientes([...receta.ingredientes]);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (activeUser.rol !== 'Administrador') {
      setErrorMsg('Restricción de Seguridad: Solo el Administrador del sistema puede eliminar recetas.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    
    const result = onDeleteReceta(id);
    if (result.success) {
      setSuccessMsg('Receta eliminada físicamente del catálogo.');
      if (selectedRecipeId === id) onSelectRecipeId(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'No se pudo eliminar la receta.');
      setTimeout(() => setErrorMsg(null), 6000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="recetas-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Catálogo de Recetas</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Definición de fórmulas complejas con resolución recursiva</p>
        </div>
        {canWrite && !isAdding && !editingId && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1 px-3 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={14} /> NUEVA RECETA
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Regla de Negocio / Bloqueo:</span>
              <p className="mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 text-xs shrink-0 font-medium">
            {successMsg}
          </div>
        )}

        {/* Form Add/Edit */}
        {(isAdding || editingId) && (
          <form onSubmit={validateRecipeAndSubmit} className="bg-[#F8F9FA] border border-[#D1D1D1] p-4 flex flex-col gap-4 shrink-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-[#D1D1D1] pb-1">
              {isAdding ? 'Registrar Nueva Fórmulación/Receta' : 'Editar Fórmulación/Receta'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Nombre de la Receta *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Ej. Salsa Birria Especial"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1 font-sans">Estado Activo *</label>
                <select
                  value={activa ? 'si' : 'no'}
                  onChange={(e) => setActiva(e.target.value === 'si')}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="si">Activa (Disponible para producción)</option>
                  <option value="no">Inactiva</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Descripción / Notas de Preparación</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-sans"
                  placeholder="Instrucciones breves o notas..."
                />
              </div>
            </div>

            {/* Ingredients rows */}
            <div className="border border-[#D1D1D1] bg-white p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-1.5 mb-1">
                <span className="text-[10px] font-bold uppercase text-gray-500">Ingredientes de la Fórmulación (Relativo a 1 unidad/libra final)</span>
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold font-mono text-[9px] px-2 py-1 border border-gray-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} /> AGREGAR INGREDIENTE
                </button>
              </div>

              {ingredientes.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 italic">
                  Debe agregar al menos un ingrediente para componer la receta.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-auto pr-1">
                  {ingredientes.map((ing, index) => {
                    return (
                      <div key={index} className="flex gap-2 items-center text-xs">
                        <select
                          value={ing.tipo}
                          onChange={(e) => handleIngredientChange(index, 'tipo', e.target.value)}
                          className="bg-gray-50 border border-[#D1D1D1] p-1.5 focus:outline-none w-28 shrink-0"
                        >
                          <option value="insumo">Insumo</option>
                          <option value="receta">Otra Receta</option>
                        </select>

                        <select
                          value={ing.targetId}
                          onChange={(e) => handleIngredientChange(index, 'targetId', e.target.value)}
                          className="flex-1 bg-white border border-[#D1D1D1] p-1.5 focus:outline-none"
                          required
                        >
                          <option value="">-- Seleccionar --</option>
                          {ing.tipo === 'insumo' ? (
                            insumos.filter(i => i.activo).map((i) => (
                              <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                            ))
                          ) : (
                            recetas.filter(r => r.activa && r.id !== editingId).map((r) => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))
                          )}
                        </select>

                        <div className="flex items-center gap-1 w-32 shrink-0">
                          <input
                            type="number"
                            step="0.0001"
                            value={ing.cantidad || ''}
                            onChange={(e) => handleIngredientChange(index, 'cantidad', e.target.value)}
                            placeholder="Cant."
                            className="w-full bg-white border border-[#D1D1D1] p-1.5 focus:outline-none font-mono"
                            min="0.0001"
                            required
                          />
                          <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0 w-8">
                            {ing.tipo === 'insumo' && ing.targetId
                              ? insumos.find(i => i.id === ing.targetId)?.unidad
                              : 'Und'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeIngredientRow(index)}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
                {isAdding ? 'COMPILAR RECETA' : 'ACTUALIZAR RECETA'}
              </button>
            </div>
          </form>
        )}

        {/* Recipes Table Grid */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[850px] text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#EDEDED] border-b border-[#D1D1D1] font-mono text-gray-500 z-10">
                <tr>
                  <th className="px-3 py-2 font-bold text-[10px]">NOMBRE DE RECETA</th>
                  <th className="px-3 py-2 font-bold text-[10px]">DESCRIPCIÓN</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">INGREDIENTES</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">COSTO TOTAL RECURSIVO</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">ESTADO</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {recetas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-400 italic">
                      No hay recetas configuradas.
                    </td>
                  </tr>
                ) : (
                  recetas.map((receta) => {
                    const isSelected = selectedRecipeId === receta.id;
                    const calculatedCost = calculateRecipeCost(receta.id, recetas, insumos);
                    const subrecInUse = isRecipeUsedInSubrecetas(receta.id);
                    const movsInUse = isRecipeUsedInMovements(receta.id);
                    const cannotDelete = subrecInUse || movsInUse;

                    return (
                      <tr
                        key={receta.id}
                        onClick={() => onSelectRecipeId(receta.id)}
                        className={`hover:bg-orange-50/30 cursor-pointer transition-colors ${isSelected ? 'bg-orange-50 font-bold border-l-4 border-l-orange-500' : ''} ${!receta.activa ? 'opacity-60' : ''}`}
                      >
                        <td className="px-3 py-3 font-sans font-bold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            <FolderTree size={14} className="text-orange-500 shrink-0" />
                            <span>{receta.nombre}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 font-sans text-[11px] max-w-xs truncate">{receta.descripcion || 'Sin descripción'}</td>
                        <td className="px-3 py-3 text-center text-gray-600">{receta.ingredientes.length}</td>
                        <td className="px-3 py-3 text-right font-bold text-orange-700 text-sm">${calculatedCost.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${receta.activa ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {receta.activa ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(receta)}
                              className="p-1 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                              title="Editar Receta"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(receta.id)}
                              className={`p-1 transition-colors cursor-pointer ${
                                cannotDelete
                                  ? 'text-gray-300 hover:text-gray-400 cursor-not-allowed'
                                  : 'text-red-400 hover:bg-red-50 hover:text-red-700'
                              }`}
                              title={
                                subrecInUse
                                  ? 'No se puede eliminar (RN-05): Usada en otra subreceta activa'
                                  : movsInUse
                                    ? 'No se puede eliminar (RN-05): Cuenta con historial de movimientos'
                                    : 'Eliminar receta'
                              }
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

        {/* Informative Hint */}
        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 shrink-0 bg-gray-50 p-2.5 border border-gray-200">
          <Sparkles size={12} className="text-orange-500 shrink-0" />
          <span>Haga clic sobre una receta en la tabla para explorarla recursivamente en el panel de navegación de la derecha.</span>
        </div>
      </div>
    </div>
  );
}
