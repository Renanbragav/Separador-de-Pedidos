import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SellerDashboard } from './components/SellerDashboard';
import { StockDashboard } from './components/StockDashboard';
import { OrderDetailModal } from './components/OrderDetailModal';
import { DeleteOrderModal } from './components/DeleteOrderModal';
import { UserProfile, Order } from './types';
import { OrderStore } from './services/store';
import { AuthStore } from './services/authStore';
import { ShieldCheck, Layers, PlusCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() =>
    AuthStore.getCurrentUser()
  );
  const [adminViewMode, setAdminViewMode] = useState<'estoque' | 'vendedor'>('estoque');

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] = useState<Order | null>(null);

  useEffect(() => {
    // Initial fetch
    setOrders(OrderStore.getOrders());

    // Subscribe to live changes
    const unsubscribe = OrderStore.subscribe((updatedOrders) => {
      setOrders(updatedOrders);
      // Keep modal order in sync if open
      if (activeModalOrder) {
        const found = updatedOrders.find((o) => o.id === activeModalOrder.id);
        if (found) {
          setActiveModalOrder(found);
        }
      }
    });

    return () => unsubscribe();
  }, [activeModalOrder?.id]);

  const handleUpdateOrder = (orderId: string, updates: Partial<Order>) => {
    const canChangeStatus =
      currentUser.role === 'admin' ||
      currentUser.role === 'estoque' ||
      AuthStore.isAdmin(currentUser.name);

    const safeUpdates = { ...updates };
    if (!canChangeStatus && 'status' in safeUpdates) {
      delete safeUpdates.status;
    }
    OrderStore.updateOrder(orderId, safeUpdates);
  };

  // Opens the confirmation modal (and requires admin password if seller)
  const handleRequestDeleteOrder = (orderOrId: Order | string) => {
    const targetOrder =
      typeof orderOrId === 'string'
        ? orders.find((o) => o.id === orderOrId) || null
        : orderOrId;
    if (targetOrder) {
      setOrderPendingDelete(targetOrder);
    }
  };

  // Executes actual deletion after confirmation (and admin password verification if seller)
  const handleConfirmDeleteOrder = (orderId: string) => {
    setOrderPendingDelete(null);
    if (activeModalOrder && activeModalOrder.id === orderId) {
      setActiveModalOrder(null);
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    OrderStore.deleteOrder(orderId);
  };

  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
    AuthStore.saveCurrentUser(user);
  };

  const activeOrdersCount = orders.filter((o) => o.status !== 'Faturado').length;
  const isAdminUser =
    currentUser.role === 'admin' || AuthStore.isAdmin(currentUser.name);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-purple-500 selection:text-white flex flex-col">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        activeOrdersCount={activeOrdersCount}
      />

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-12 flex-1 w-full space-y-4">
        {/* Admin Navigation Tab Switcher (When Renan or Ilma is active) */}
        {currentUser.role === 'admin' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 pl-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  Painel de Controle Administrador ({currentUser.name})
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30 uppercase">
                    Acesso Total
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Você pode importar novos pedidos diretamente ou gerenciar a fila geral da expedição.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setAdminViewMode('estoque')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  adminViewMode === 'estoque'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Fila Geral & Importação Rápida
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode('vendedor')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  adminViewMode === 'vendedor'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Central de Importação de Pedidos
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Display */}
        {currentUser.role === 'vendedor' ? (
          <SellerDashboard
            sellerName={currentUser.name}
            allOrders={orders}
            onOpenOrder={(ord) => setActiveModalOrder(ord)}
            onOrderAdded={(newOrd) => setActiveModalOrder(newOrd)}
            isAdmin={false}
            onDeleteOrder={handleRequestDeleteOrder}
          />
        ) : currentUser.role === 'admin' ? (
          adminViewMode === 'vendedor' ? (
            <SellerDashboard
              sellerName={currentUser.name}
              allOrders={orders}
              onOpenOrder={(ord) => setActiveModalOrder(ord)}
              onOrderAdded={(newOrd) => setActiveModalOrder(newOrd)}
              isAdmin={true}
              onDeleteOrder={handleRequestDeleteOrder}
            />
          ) : (
            <StockDashboard
              stockUserName={currentUser.name}
              orders={orders}
              onOpenOrder={(ord) => setActiveModalOrder(ord)}
              onUpdateStatus={(id, st) => handleUpdateOrder(id, { status: st })}
              isAdmin={true}
              onDeleteOrder={handleRequestDeleteOrder}
              onOrderAdded={(newOrd) => setActiveModalOrder(newOrd)}
            />
          )
        ) : (
          <StockDashboard
            stockUserName={currentUser.name}
            orders={orders}
            onOpenOrder={(ord) => setActiveModalOrder(ord)}
            onUpdateStatus={(id, st) => handleUpdateOrder(id, { status: st })}
            isAdmin={false}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} Sistema Organizador de Expedição • VitSis Integration
          </span>
          <span className="font-semibold text-slate-700">
            Administração Renan & Ilma • Leitura por Matriz de Pedido
          </span>
        </div>
      </footer>

      {/* Order Details & Separation Checklist Modal */}
      {activeModalOrder && (
        <OrderDetailModal
          order={activeModalOrder}
          userRole={currentUser.role}
          userName={currentUser.name}
          onClose={() => setActiveModalOrder(null)}
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleRequestDeleteOrder}
        />
      )}

      {/* Delete Confirmation & Admin Password Modal */}
      {orderPendingDelete && (
        <DeleteOrderModal
          order={orderPendingDelete}
          isAdmin={isAdminUser}
          onConfirmDelete={handleConfirmDeleteOrder}
          onCancel={() => setOrderPendingDelete(null)}
        />
      )}
    </div>
  );
}
