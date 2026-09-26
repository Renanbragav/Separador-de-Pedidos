import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  Lock,
  X,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { Order } from '../types';
import { AuthStore } from '../services/authStore';

interface DeleteOrderModalProps {
  order: Order;
  isAdmin: boolean;
  onConfirmDelete: (orderId: string) => void;
  onCancel: () => void;
}

export const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({
  order,
  isAdmin,
  onConfirmDelete,
  onCancel,
}) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      if (!AuthStore.verifyAdminPassword(adminPassword)) {
        setError(
          'Senha de administrador inválida. Apenas a senha de Renan ou Ilma libera a exclusão.'
        );
        return;
      }
    }
    onConfirmDelete(order.id);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Tem certeza que deseja excluir?
              </h3>
              <p className="text-xs text-slate-500">
                Esta ação removerá o pedido permanentemente do sistema.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-black text-slate-900 text-sm">
              Pedido #{order.orderNumber}
            </span>
            <span className="font-bold text-emerald-700">
              R${' '}
              {order.totalValue.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <p className="font-bold text-slate-800">
            Cliente: {order.clientName}
          </p>
          <p className="text-slate-500">
            Vendedor: <strong className="text-slate-700">{order.sellerName}</strong> •{' '}
            {order.items?.length || order.totalItems} item(ns)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isAdmin && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Autorização de Administrador Obrigatória</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Vendedores só podem excluir pedidos mediante a senha de um administrador (<strong>Renan</strong> ou <strong>Ilma</strong>).
              </p>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  autoFocus
                  placeholder="Digite a senha do Admin (Renan / Ilma)..."
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/25 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sim, Excluir Pedido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
