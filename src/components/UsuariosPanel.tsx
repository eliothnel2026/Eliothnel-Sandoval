import React, { useState } from 'react';
import { Usuario, RolUsuario } from '../types';
import { Plus, User, ShieldCheck, Key, ToggleLeft, ToggleRight, AlertCircle, Info } from 'lucide-react';

interface UsuariosPanelProps {
  users: Usuario[];
  activeUser: Usuario;
  onAddUser: (user: Omit<Usuario, 'id'>) => void;
  onToggleUserStatus: (id: string) => void;
}

export default function UsuariosPanel({
  users,
  activeUser,
  onAddUser,
  onToggleUserStatus
}: UsuariosPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolUsuario>('Operador');

  const isAdmin = activeUser.rol === 'Administrador';

  const resetForm = () => {
    setNombre('');
    setRol('Operador');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('Error de permisos: Solo perfiles de tipo ADMINISTRADOR pueden dar de alta nuevos usuarios.');
      return;
    }
    if (!nombre.trim()) {
      setErrorMsg('El nombre de usuario es obligatorio.');
      return;
    }

    onAddUser({
      nombre: nombre.trim(),
      rol,
      activo: true
    });

    setIsAdding(false);
    resetForm();
    setSuccessMsg('Nuevo operador agregado al sistema correctamente.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleStatus = (id: string) => {
    if (!isAdmin) {
      setErrorMsg('Error de permisos: Solo el Administrador puede activar o desactivar operadores.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    onToggleUserStatus(id);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white" id="usuarios-panel">
      {/* Panel Header */}
      <div className="bg-[#F1F1F1] border-b border-[#D1D1D1] px-4 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">Gestión de Usuarios</h2>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Control de accesos y perfiles de seguridad de cocina</p>
        </div>
        {isAdmin && !isAdding && (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-[#1A1A1A] hover:bg-orange-600 text-white text-xs font-bold py-1 px-3 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus size={14} /> NUEVO COLABORADOR
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error de Seguridad:</span>
              <p className="mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 text-xs shrink-0 font-medium">
            {successMsg}
          </div>
        )}

        {/* Add User Form */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="bg-[#F8F9FA] border border-[#D1D1D1] p-4 flex flex-col gap-4 shrink-0">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-[#D1D1D1] pb-1">
              Dar de Alta Nuevo Colaborador
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Ej. Martín Santos"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Perfil / Rol Asignado *</label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as RolUsuario)}
                  className="w-full bg-white border border-[#D1D1D1] p-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="Operador">Operador (Solo registro de consumos)</option>
                  <option value="Gerente">Gerente (Registro, Compras, Recetas, sin Mod. Usuarios)</option>
                  <option value="Administrador">Administrador (Control total sin restricciones)</option>
                </select>
              </div>
            </div>

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
                REGISTRAR COLABORADOR
              </button>
            </div>
          </form>
        )}

        {/* Matrix of Permissions (Fabulous Architectural Value) */}
        <div className="bg-[#F8F9FA] border border-[#D1D1D1] p-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 border-b border-[#D1D1D1] pb-1.5 mb-2">
            <ShieldCheck size={14} className="text-orange-500" />
            <span>Matriz de Control de Accesos Basado en Roles (RBAC)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white border border-gray-100 p-2.5">
              <span className="font-bold text-gray-900 flex items-center gap-1">🔴 OPERADOR</span>
              <p className="text-[10px] text-gray-500 font-sans mt-1">Diseñado para personal operativo de cocina. Solo puede registrar consumos directos y consumos por receta.</p>
              <ul className="text-[9px] font-mono text-gray-400 mt-2 list-disc list-inside">
                <li>Registro de Consumo Directo</li>
                <li>Descuento por Receta</li>
                <li className="line-through text-red-300">Alta de Insumos / Costos</li>
                <li className="line-through text-red-300">Ingreso de Compras</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-100 p-2.5">
              <span className="font-bold text-gray-900 flex items-center gap-1">🟡 GERENTE</span>
              <p className="text-[10px] text-gray-500 font-sans mt-1">Encargado de inventarios y costeo. Puede crear insumos, registrar compras y modificar recetas, pero no alterar la lista de usuarios.</p>
              <ul className="text-[9px] font-mono text-gray-400 mt-2 list-disc list-inside text-gray-600">
                <li>Alta y Edición de Insumos</li>
                <li>Registro de Compras</li>
                <li>Configuración de Recetas</li>
                <li className="line-through text-red-300">Gestión de Usuarios</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-100 p-2.5">
              <span className="font-bold text-gray-900 flex items-center gap-1">🟢 ADMINISTRADOR</span>
              <p className="text-[10px] text-gray-500 font-sans mt-1">Perfil de máxima seguridad. Acceso completo y sin restricciones a todos los módulos y eliminación física de registros huérfanos.</p>
              <ul className="text-[9px] font-mono text-green-700 mt-2 list-disc list-inside">
                <li>Creación y baja de Colaboradores</li>
                <li>Eliminación física de Insumos libres</li>
                <li>Ajustes de auditoría en Ledger</li>
                <li>Control total del sistema</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 border border-[#D1D1D1] overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[650px] text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-[#EDEDED] border-b border-[#D1D1D1] font-mono text-gray-500 z-10">
                <tr>
                  <th className="px-3 py-2 font-bold text-[10px]">COLABORADOR</th>
                  <th className="px-3 py-2 font-bold text-[10px]">ROL / PERFIL</th>
                  <th className="px-3 py-2 font-bold text-[10px]">ID DE ACCESO</th>
                  <th className="px-3 py-2 font-bold text-[10px] text-center">ESTADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {users.map((u) => {
                  let roleColor = 'bg-red-100 text-red-800';
                  if (u.rol === 'Gerente') roleColor = 'bg-yellow-100 text-yellow-800';
                  if (u.rol === 'Administrador') roleColor = 'bg-green-100 text-green-800';

                  return (
                    <tr key={u.id} className={`hover:bg-orange-50/10 ${!u.activo ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2.5 font-sans font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1A1A1A] text-white font-bold flex items-center justify-center text-[10px] uppercase">
                            {u.nombre.charAt(0)}
                          </div>
                          <span>{u.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${roleColor}`}>
                          {u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 italic text-[10px]">{u.id}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleStatus(u.id)}
                          disabled={!isAdmin || u.id === activeUser.id}
                          className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                            u.activo
                              ? 'bg-green-100 text-green-800 cursor-pointer hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200'
                          } ${(!isAdmin || u.id === activeUser.id) ? 'cursor-not-allowed opacity-50' : ''}`}
                          title={u.id === activeUser.id ? 'No puede auto-desactivar su sesión' : 'Cambiar estado'}
                        >
                          {u.activo ? 'ACTIVO' : 'SUSPENDIDO'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
