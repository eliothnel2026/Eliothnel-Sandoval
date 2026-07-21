import React, { useState } from 'react';
import { Insumo, Movimiento, Compra } from '../types';
import { TrendingUp, DollarSign, PieChart, ShoppingBag, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface ReportesPanelProps {
  insumos: Insumo[];
  movimientos: Movimiento[];
  compras: Compra[];
  stocks: Record<string, number>;
}

export default function ReportesPanel({ insumos, movimientos, compras, stocks }: ReportesPanelProps) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>(insumos[0]?.id || '');

  // 1. Calculate stock value by category
  const valueByCategory: Record<string, number> = {};
  let totalValue = 0;

  insumos.forEach((insumo) => {
    const stock = stocks[insumo.id] || 0;
    const value = stock > 0 ? stock * insumo.costoActual : 0;
    if (value > 0) {
      valueByCategory[insumo.categoria] = (valueByCategory[insumo.categoria] || 0) + value;
      totalValue += value;
    }
  });

  const categoriesSorted = Object.entries(valueByCategory).sort((a, b) => b[1] - a[1]);

  // 2. Top valued items in stock
  const valuedItems = insumos
    .map((i) => {
      const stock = stocks[i.id] || 0;
      return {
        nombre: i.nombre,
        categoria: i.categoria,
        stock,
        unidad: i.unidad,
        costo: i.costoActual,
        total: stock > 0 ? stock * i.costoActual : 0
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 3. Waste analysis (Consumo Directo + negative Ajustes)
  let totalWasteValue = 0;
  const wasteByInsumo: Record<string, { nombre: string; valor: number; cantidad: number; unidad: string }> = {};

  movimientos.forEach((mov) => {
    if (mov.tipo === 'Consumo Directo' || mov.tipo === 'Ajuste') {
      mov.detalles.forEach((det) => {
        if (det.cantidad < 0) {
          const valorPerdido = Math.abs(det.cantidad) * det.costoUnitario;
          totalWasteValue += valorPerdido;

          const ins = insumos.find((i) => i.id === det.insumoId);
          const nombre = ins ? ins.nombre : 'Insumo Eliminado';
          const unidad = ins ? ins.unidad : '';

          if (!wasteByInsumo[det.insumoId]) {
            wasteByInsumo[det.insumoId] = { nombre, valor: 0, cantidad: 0, unidad };
          }
          wasteByInsumo[det.insumoId].valor += valorPerdido;
          wasteByInsumo[det.insumoId].cantidad += Math.abs(det.cantidad);
        }
      });
    }
  });

  const sortedWastes = Object.entries(wasteByInsumo)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.valor - a.valor);

  // 4. Price history of selected insumo
  const selectedInsumo = insumos.find((i) => i.id === selectedInsumoId);
  // Get all purchases for this insumo to build history
  const purchasesForInsumo = compras
    .filter((c) => c.insumoId === selectedInsumoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const initialCost = selectedInsumo ? selectedInsumo.costoActual : 0;
  // Build a timeline of costs
  const priceTimeline = purchasesForInsumo.map((p, idx) => ({
    label: `F-${p.documento.slice(-4)} (${p.fecha})`,
    cost: p.costoUnitario,
    qty: p.cantidad
  }));

  // If there are no purchases, add the starting cost as single point
  if (priceTimeline.length === 0 && selectedInsumo) {
    priceTimeline.push({
      label: 'Costo Base',
      cost: selectedInsumo.costoActual,
      qty: 0
    });
  }

  // Calculate SVG line points for history
  const chartHeight = 120;
  const chartWidth = 400;
  const minCost = Math.min(...priceTimeline.map(t => t.cost)) * 0.9 || 0;
  const maxCost = Math.max(...priceTimeline.map(t => t.cost)) * 1.1 || 10;
  const costRange = maxCost - minCost || 1;

  const points = priceTimeline.map((t, idx) => {
    const x = priceTimeline.length > 1 ? (idx / (priceTimeline.length - 1)) * (chartWidth - 40) + 20 : chartWidth / 2;
    const y = chartHeight - ((t.cost - minCost) / costRange) * (chartHeight - 40) - 20;
    return { x, y, label: t.label, cost: t.cost };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="reportes-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Tablero de Reportes</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Analíticas de mermas, tendencias de costos y valor de cocina</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        
        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card 1: Distribución de Valor por Categoría */}
          <div className="border border-[#D1D1D1] p-4 flex flex-col bg-white">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <PieChart size={12} className="text-orange-500" /> VALORIZACIÓN POR CATEGORÍA
            </span>
            {categoriesSorted.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No hay existencias con valor para calcular.</p>
            ) : (
              <div className="flex flex-col gap-3 font-mono text-xs">
                {categoriesSorted.map(([category, val]) => {
                  const pct = (val / totalValue) * 100;
                  return (
                    <div key={category} className="flex flex-col gap-1">
                      <div className="flex justify-between font-sans">
                        <span className="font-bold text-gray-800">{category}</span>
                        <span className="text-gray-500 font-mono">${val.toFixed(2)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 border border-gray-200">
                        <div
                          className="bg-orange-500 h-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between font-sans font-bold text-sm">
                  <span>Capital Total de Cocina:</span>
                  <span className="text-orange-600 font-mono">${totalValue.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Top Activos Más Valiosos */}
          <div className="border border-[#D1D1D1] p-4 flex flex-col bg-white">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <DollarSign size={12} className="text-green-500" /> TOP 5 INSUMOS CON MAYOR VALOR DE STOCK
            </span>
            {valuedItems.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-8 text-center">No hay insumos valorados en inventario.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {valuedItems.map((item, idx) => (
                  <div key={item.nombre} className="flex justify-between items-center bg-[#F8F9FA] border border-gray-100 p-2 text-xs">
                    <div>
                      <div className="font-bold text-gray-800">{idx + 1}. {item.nombre}</div>
                      <div className="text-[10px] text-gray-400 font-mono">Stock: {item.stock.toFixed(2)} {item.unidad} @ ${item.costo.toFixed(2)}</div>
                    </div>
                    <span className="font-mono font-bold text-orange-600">${item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Historial de Desperdicios, Mermas y Ajustes Negativos */}
          <div className="border border-[#D1D1D1] p-4 flex flex-col bg-white">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1 text-red-600">
              <AlertTriangle size={12} /> HISTORIAL ACUMULADO DE MERMAS Y PÉRDIDAS
            </span>
            <div className="bg-red-50 border border-red-100 p-3 mb-3 shrink-0 flex justify-between items-center">
              <span className="text-[10px] font-bold text-red-800 font-sans">VALOR TOTAL CONVERTIDO A MERMA:</span>
              <span className="text-base font-mono font-bold text-red-700">${totalWasteValue.toFixed(2)}</span>
            </div>
            {sortedWastes.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No se registran mermas en el historial de consumos.</p>
            ) : (
              <div className="overflow-auto max-h-48 pr-1 font-mono text-xs">
                <table className="w-full min-w-[320px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 text-[9px] font-bold">
                      <th className="pb-1.5">INSUMO</th>
                      <th className="pb-1.5 text-right">CANTIDAD PERDIDA</th>
                      <th className="pb-1.5 text-right">VALOR PERDIDO ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedWastes.map((waste) => (
                      <tr key={waste.id} className="hover:bg-red-50/10">
                        <td className="py-2 font-sans font-medium text-gray-800">{waste.nombre}</td>
                        <td className="py-2 text-right font-bold text-gray-600">
                          {waste.cantidad.toFixed(2)} {waste.unidad}
                        </td>
                        <td className="py-2 text-right font-bold text-red-600">${waste.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 4: Tendencia de Costos de Compra */}
          <div className="border border-[#D1D1D1] p-4 flex flex-col bg-white">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp size={12} className="text-blue-500" /> TENDENCIA DE PRECIOS ADQUISICIÓN
              </span>
              <select
                value={selectedInsumoId}
                onChange={(e) => setSelectedInsumoId(e.target.value)}
                className="bg-white border border-[#D1D1D1] px-2 py-1 text-[10px] font-mono focus:border-orange-500 focus:outline-none"
              >
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </select>
            </div>

            {priceTimeline.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-12 text-center">Sin adquisiciones registradas para este insumo.</p>
            ) : (
              <div className="flex flex-col gap-2 items-center">
                {/* Custom SVG Line Chart */}
                <div className="relative w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full bg-[#F8F9FA] border border-gray-200"
                  >
                    {/* Grid Lines */}
                    <line x1="20" y1="20" x2={chartWidth - 20} y2="20" stroke="#E2E8F0" strokeDasharray="3" />
                    <line x1="20" y1={chartHeight / 2} x2={chartWidth - 20} y2={chartHeight / 2} stroke="#E2E8F0" strokeDasharray="3" />
                    <line x1="20" y1={chartHeight - 20} x2={chartWidth - 20} y2={chartHeight - 20} stroke="#E2E8F0" strokeDasharray="3" />

                    {/* Path Line */}
                    {priceTimeline.length > 1 && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#EA580C"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Interactive dots */}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="#EA580C"
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          textAnchor="middle"
                          className="font-mono text-[8px] font-bold fill-gray-800"
                        >
                          ${p.cost.toFixed(2)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                {/* Timeline description */}
                <div className="w-full max-h-24 overflow-auto mt-1 font-mono text-[9px] text-gray-500">
                  <div className="grid grid-cols-3 font-bold border-b border-gray-200 pb-1 mb-1">
                    <span>Transacción</span>
                    <span className="text-right">Volumen</span>
                    <span className="text-right">Costo Unitario</span>
                  </div>
                  {[...priceTimeline].reverse().map((t, idx) => (
                    <div key={idx} className="grid grid-cols-3 py-0.5 border-b border-gray-50 last:border-0">
                      <span className="truncate">{t.label}</span>
                      <span className="text-right">{t.qty > 0 ? `${t.qty.toFixed(2)}` : 'Base'}</span>
                      <span className="text-right font-bold text-gray-700">${t.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
