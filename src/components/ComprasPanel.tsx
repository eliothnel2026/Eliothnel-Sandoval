import React, { useState } from 'react';
import { Insumo, Compra, Usuario } from '../types';
import { Plus, DollarSign, AlertCircle, ShoppingBag, FileText } from 'lucide-react';

interface ComprasPanelProps {
  compras: Compra[];
  insumos: Insumo[];
  activeUser: Usuario;
  getCurrentStock: (insumoId: string) => number;
  onAddCompra: (compra: {
    fecha: string;
    proveedor: string;
    documento: string;
    insumoId: string;
    cantidad: number;
    precioTotal: number;
  }) => { success: boolean; error?: string };
}

export default function ComprasPanel({
  compras,
  insumos,
  activeUser,
  getCurrentStock,
  onAddCompra
}: ComprasPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [proveedor, setProveedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [cantidad, setCantidad] = useState<number>(0);
  const [precioTotal, setPrecioTotal] = useState<number>(0);

  const canWrite = activeUser.rol === 'Administrador' || activeUser.rol === 'Gerente';
  const purchasableInsumos = insumos.filter((i) => i.activo && i.permitirCompras);

  const handleInsumoChange = (id: string) => {
    setInsumoId(id);
    const selected = insumos.find((i) => i.id === id);
    if (selected) {
      setProveedor(selected.proveedorPrincipal);
    }
  };

  const resetForm = () => {
    setFecha(new Date().toISOString().split('T')[0]);
    setProveedor('');
    setDocumento('');
    setInsumoId('');
    setCantidad(0);
    setPrecioTotal(0);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) {
      setErrorMsg('Error de permisos: Su perfil actual no tiene autorización para ingresar compras.');
      return;
    }
    if (!insumoId) {
      setErrorMsg('Debe seleccionar un insumo válido.');
      return;
    }
    if (cantidad <= 0 || precioTotal <= 0) {
      setErrorMsg('La cantidad y el precio total deben ser mayores que cero.');
      return;
    }
    if (!proveedor.trim() || !documento.trim()) {
      setErrorMsg('El proveedor y el documento son obligatorios.');
      return;
    }

    const res = onAddCompra({
      fecha,
      proveedor: proveedor.trim(),
      documento: documento.trim(),
      insumoId,
      cantidad,
      precioTotal
    });

    if (res && !res.success) {
      setErrorMsg(res.error || 'Error al guardar la compra.');
      return;
    }

    setIsAdding(false);
    resetForm();
    setSuccessMsg('Compra registrada correctamente. El costo unitario y las existencias han sido actualizados mediante transacciones ledger.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="compras-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Registro de Compras</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Ingreso de materias primas e insumos desde proveedor</p>
        </div>
        {canWrite && !isAdding && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1 px-3 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={14} /> REGISTRAR COMPRA
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error de Validación:</span>
              <p className="mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 text-xs shrink-0 font-medium">
            {successMsg}
          </div>
        )}

        {/* Add Purchase Form */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="bg-[#F8F9FA] border border-[#D1D1D1] p-4 flex flex-col gap-4 shrink-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-[#D1D1D1] pb-1">
              Nueva Entrada por Compra de Proveedor
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Fecha de Compra *</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Insumo a Comprar *</label>
                <select
                  value={insumoId}
                  onChange={(e) => handleInsumoChange(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar Insumo --</option>
                  {purchasableInsumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad}) - Proveedor: {i.proveedorPrincipal}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Proveedor *</label>
                <input
                  type="text"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Nombre de la distribuidora"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Documento Referencia *</label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Factura, Remisión, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cantidad Comprada *</label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    value={cantidad || ''}
                    onChange={(e) => setCantidad(Number(e.target.value))}
                    className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none font-mono"
                    placeholder="0.00"
                    min="0.01"
                    required
                  />
                  <span className="bg-gray-100 border border-[#D1D1D1] border-l-0 px-3 flex items-center text-gray-500 font-bold uppercase text-[10px]">
                    {insumoId ? insumos.find((i) => i.id === insumoId)?.unidad : '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Precio Total Compra *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-gray-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={precioTotal || ''}
                    onChange={(e) => setPrecioTotal(Number(e.target.value))}
                    className="w-full bg-white border border-[#D1D1D1] pl-6 p-2 focus:border-orange-500 focus:outline-none font-mono"
                    placeholder="0.00"
                    min="0.01"
                    required
                  />
                </div>
              </div>
            </div>

            {cantidad > 0 && precioTotal > 0 && (
              <div className="bg-orange-50 border border-orange-100 p-2 text-[11px] font-mono flex justify-between">
                <span>COSTO UNITARIO ESTIMADO: <strong className="text-orange-700">${(precioTotal / cantidad).toFixed(4)} / {insumoId ? insumos.find((i) => i.id === insumoId)?.unidad : ''}</strong></span>
                <span>EXISTENCIA ACTUAL: <strong className="text-gray-700">{insumoId ? getCurrentStock(insumoId).toFixed(2) : '0'} {insumoId ? insumos.find((i) => i.id === insumoId)?.unidad : ''}</strong></span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[#D1D1D1] pt-3">
              <button
                type="button"
                onClick={() => { resetForm(); setIsAdding(false); }}
                className="border border-[#D1D1D1] hover:bg-gray-100 text-gray-700 text-xs font-bold py-1.5 px-4 cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-4 cursor-pointer"
              >
                REGISTRAR COMPRA
              </button>
            </div>
          </form>
        )}

        {/* Purchase History Ledger */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="bg-gray-100 border-b border-[#D1D1D1] px-3 py-2 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Historial Ledger de Adquisiciones</span>
            <span className="text-[10px] font-mono text-gray-400">Total transacciones: {compras.length}</span>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[900px] text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#EDEDED] border-b border-[#D1D1D1] font-mono text-gray-500 z-10">
                <tr>
                  <th className="px-3 py-2 font-bold text-[10px]">FECHA</th>
                  <th className="px-3 py-2 font-bold text-[10px]">INSUMO</th>
                  <th className="px-3 py-2 font-bold text-[10px]">DOCUMENTO</th>
                  <th className="px-3 py-2 font-bold text-[10px]">PROVEEDOR</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">CANTIDAD</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">COSTO UNITARIO</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">PRECIO TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {compras.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400 italic">
                      No hay compras registradas.
                    </td>
                  </tr>
                ) : (
                  [...compras].reverse().map((compra) => {
                    const ins = insumos.find((i) => i.id === compra.insumoId);
                    return (
                      <tr key={compra.id} className="hover:bg-orange-50/20">
                        <td className="px-3 py-2.5 text-gray-600">{compra.fecha}</td>
                        <td className="px-3 py-2.5 font-sans font-bold text-gray-900">{ins ? ins.nombre : 'Insumo Eliminado'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <FileText size={12} className="text-gray-400" />
                            <span>{compra.documento}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 font-sans">{compra.proveedor}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                          {compra.cantidad.toFixed(2)} <span className="text-[10px] font-normal text-gray-500">{ins?.unidad}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${compra.costoUnitario.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-green-700">${compra.precioTotal.toFixed(2)}</td>
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
