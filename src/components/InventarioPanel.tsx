import React, { useState } from 'react';
import { Insumo } from '../types';
import { Search, Filter, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';

interface InventarioPanelProps {
  insumos: Insumo[];
  stocks: Record<string, number>;
}

export default function InventarioPanel({ insumos, stocks }: InventarioPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  const categories = ['Todas', ...Array.from(new Set(insumos.map((i) => i.categoria)))];

  const filteredInsumos = insumos.filter((insumo) => {
    const matchesSearch = insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          insumo.proveedorPrincipal.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || insumo.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalAssetValue = insumos.reduce((acc, insumo) => {
    const stock = stocks[insumo.id] || 0;
    return acc + (stock > 0 ? stock * insumo.costoActual : 0);
  }, 0);

  const lowStockCount = insumos.filter((insumo) => {
    const stock = stocks[insumo.id] || 0;
    return insumo.activo && stock <= (insumo.unidad === 'lb' ? 5 : 10);
  }).length;

  const outOfStockCount = insumos.filter((insumo) => {
    const stock = stocks[insumo.id] || 0;
    return insumo.activo && stock === 0;
  }).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="inventario-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Inventario Central</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Saldos teóricos calculados en tiempo real por flujos transaccionales</p>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[9px] rounded uppercase font-bold font-mono">
            Sincronizado Ledger
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="bg-[#F8F9FA] border border-[#D1D1D1] p-3 flex flex-col justify-between">
            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Valor total del Stock</span>
            <span className="text-xl font-mono font-bold text-orange-600 mt-1">
              ${totalAssetValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-gray-400 font-mono mt-1">Existencias valoradas a costo actual</span>
          </div>

          <div className="bg-[#F8F9FA] border border-[#D1D1D1] p-3 flex flex-col justify-between">
            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Insumos Críticos / Bajo Stock</span>
            <span className="text-xl font-mono font-bold text-yellow-600 mt-1 flex items-center gap-1.5">
              {lowStockCount} <TrendingDown size={18} />
            </span>
            <span className="text-[9px] text-gray-400 font-mono mt-1">Límite: &lt;5 lb o &lt;10 unidades</span>
          </div>

          <div className="bg-[#F8F9FA] border border-[#D1D1D1] p-3 flex flex-col justify-between">
            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Agotados (Stock Cero)</span>
            <span className="text-xl font-mono font-bold text-red-600 mt-1 flex items-center gap-1.5">
              {outOfStockCount} <AlertTriangle size={18} />
            </span>
            <span className="text-[9px] text-gray-400 font-mono mt-1">Insumos activos sin existencias</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar insumos por nombre o proveedor..."
              className="w-full bg-white border border-[#D1D1D1] pl-9 pr-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-[#D1D1D1] p-2 text-xs focus:border-orange-500 focus:outline-none shrink-0"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Inventory Table Grid */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[850px] text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#EDEDED] border-b border-[#D1D1D1] font-mono text-gray-500 z-10">
                <tr>
                  <th className="px-3 py-2 font-bold text-[10px]">INSUMO</th>
                  <th className="px-3 py-2 font-bold text-[10px]">CATEGORÍA</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">EXISTENCIA DISPONIBLE</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">UNIDAD</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">COSTO DE COMPRA VIGENTE</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-right">VALORIZACIÓN TOTAL</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">ESTADO STOCK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {filteredInsumos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400 italic">
                      No se encontraron insumos bajo los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredInsumos.map((insumo) => {
                    const stock = stocks[insumo.id] || 0;
                    const value = stock > 0 ? stock * insumo.costoActual : 0;
                    
                    // Determine stock status badges
                    const isOutOfStock = stock <= 0;
                    const isLowStock = insumo.activo && stock <= (insumo.unidad === 'lb' ? 5 : 10);
                    
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 font-bold text-[9px] rounded">
                        <CheckCircle2 size={10} /> ÓPTIMO
                      </span>
                    );
                    
                    if (isOutOfStock) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-800 font-bold text-[9px] rounded animate-pulse">
                          <AlertTriangle size={10} /> AGOTADO
                        </span>
                      );
                    } else if (isLowStock) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 font-bold text-[9px] rounded">
                          <AlertTriangle size={10} /> CRÍTICO
                        </span>
                      );
                    }

                    if (!insumo.activo) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 font-bold text-[9px] rounded">
                          INACTIVO
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={insumo.id}
                        className={`hover:bg-orange-50/10 ${isOutOfStock && insumo.activo ? 'bg-red-50/20' : ''} ${!insumo.activo ? 'opacity-60 bg-gray-50/50' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-sans font-bold text-gray-900">
                          {insumo.nombre}
                          {!insumo.activo && <span className="text-[9px] font-normal text-gray-400 ml-1.5 italic">(Baja lógica)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 font-sans">{insumo.categoria}</td>
                        <td className={`px-3 py-2.5 text-right font-bold text-sm ${isOutOfStock && insumo.activo ? 'text-red-600 italic' : isLowStock && insumo.activo ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {stock.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-gray-500">{insumo.unidad}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${insumo.costoActual.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-orange-800">${value.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-center">{statusBadge}</td>
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
