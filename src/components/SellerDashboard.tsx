import React, { useState, useEffect } from 'react';
import {
  Upload,
  Camera,
  Clipboard,
  Clock,
  CheckCircle2,
  Package,
  Eye,
  Trash2,
  UserCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { Order, OrderStatus, VENDEDORES } from '../types';
import { OrderStore } from '../services/store';
import { CameraCapture } from './CameraCapture';
import { extractExpirationDate } from '../services/orderMatrixParser';
import { runOrderImportWithProgress } from '../services/orderImporter';
import {
  ImportProgressModal,
  ImportProgressState,
} from './ImportProgressModal';

interface SellerDashboardProps {
  sellerName: string;
  allOrders: Order[];
  onOpenOrder: (order: Order) => void;
  onOrderAdded: (newOrder: Order) => void;
  isAdmin?: boolean;
  onDeleteOrder?: (order: Order) => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  sellerName,
  allOrders,
  onOpenOrder,
  onOrderAdded,
  isAdmin = false,
  onDeleteOrder,
}) => {
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    active: false,
    percent: 0,
    stageText: '',
    sourceType: 'pdf',
  });
  const [showCamera, setShowCamera] = useState(false);
  const [pastedImageInfo, setPastedImageInfo] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedSellerForAdmin, setSelectedSellerForAdmin] = useState<string>('Auto');

  // Filter orders:
  // - If isAdmin is true: Admin can see all orders imported into the system
  // - If Vendedor: sees only their own orders from Today and Yesterday
  const sellerOrders = allOrders.filter((o) => {
    if (isAdmin) {
      return true;
    }

    if (!o.sellerNormalized && !o.sellerName) return false;
    const nameStr = (o.sellerNormalized || o.sellerName).toLowerCase();
    const matchesSeller = nameStr.includes(sellerName.toLowerCase());
    if (!matchesSeller) return false;

    const getFormattedDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const todayStr = getFormattedDate(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getFormattedDate(yesterday);

    const orderDateStr =
      o.dateKey ||
      (o.createdAt ? getFormattedDate(new Date(o.createdAt)) : todayStr);
    if (orderDateStr !== todayStr && orderDateStr !== yesterdayStr) {
      return false;
    }

    return true;
  });

  const activeOrders = sellerOrders.filter((o) => o.status !== 'Faturado');

  // Unified handler for file (PDF or Photo)
  const processFile = async (file: File) => {
    try {
      const newOrder = await runOrderImportWithProgress({
        file,
        userName: sellerName,
        isAdmin,
        selectedSellerForAdmin,
        onProgress: setImportProgress,
      });
      onOrderAdded(newOrder);
    } catch (err) {
      console.error('Erro na importação de arquivo:', err);
      setImportProgress((prev) => ({ ...prev, active: false }));
    }
  };

  // Unified handler for Camera Capture base64
  const processCameraCapture = async (base64DataUrl: string) => {
    try {
      const newOrder = await runOrderImportWithProgress({
        cameraBase64: base64DataUrl,
        userName: sellerName,
        isAdmin,
        selectedSellerForAdmin,
        onProgress: setImportProgress,
      });
      onOrderAdded(newOrder);
    } catch (err) {
      console.error('Erro na importação por fotografia:', err);
      setImportProgress((prev) => ({ ...prev, active: false }));
    }
  };

  // Handle Clipboard Paste (Ctrl + V) for both Images and Text with 0-100% progress bar
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!e.clipboardData) return;

      // Check for pasted image / screenshot
      if (e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              setPastedImageInfo('Fotografia/Imagem colada (Ctrl+V)!');
              setTimeout(() => setPastedImageInfo(null), 4000);
              await processFile(file);
              return;
            }
          }
        }
      }

      // Check for pasted text from PDF / ERP order sheet
      const pastedText = e.clipboardData.getData('text/plain');
      if (pastedText && pastedText.trim().length > 20) {
        setPastedImageInfo('Dados do pedido colados (Ctrl+V)!');
        setTimeout(() => setPastedImageInfo(null), 4000);
        try {
          const newOrder = await runOrderImportWithProgress({
            pastedText,
            userName: sellerName,
            isAdmin,
            selectedSellerForAdmin,
            onProgress: setImportProgress,
          });
          onOrderAdded(newOrder);
        } catch (err) {
          console.error('Erro na importação de texto colado:', err);
          setImportProgress((prev) => ({ ...prev, active: false }));
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [sellerName, selectedSellerForAdmin, isAdmin]);

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pendente':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Separando':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Conferido':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Com Pendências':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Faturado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Global Percentage Progress Modal */}
      <ImportProgressModal progress={importProgress} />

      {/* Seller / Admin Import Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {isAdmin
                ? `Central de Importação Administrador (${sellerName})`
                : 'Painel do Vendedor'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Olá, {sellerName}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Importe seus pedidos em PDF ou fotografia e acompanhe a posição exata na fila do estoque.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isAdmin ? 'Total de Pedidos Ativos' : 'Seus Pedidos Ativos'}
              </p>
              <p className="text-lg font-black text-white">
                {activeOrders.length} pedido(s)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ctrl + V Toast indicator */}
      {pastedImageInfo && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4" />
            <span>{pastedImageInfo}</span>
          </div>
        </div>
      )}

      {/* Import / Upload Order Options Box */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 transition-all bg-white text-center space-y-4 shadow-sm ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {importProgress.active ? (
          <div className="py-6 max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-slate-800">
              <span>{importProgress.stageText}</span>
              <span className="text-emerald-600 font-mono text-base">
                {Math.round(importProgress.percent)}%
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-200"
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Incluir Novo Pedido de Expedição
              </h3>
              <p className="text-xs text-slate-500 max-w-xl mx-auto mt-1">
                Envie um arquivo <strong>PDF</strong>, selecione uma <strong>Fotografia</strong> da galeria, tire foto pela câmera ou cole com{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">
                  Ctrl + V
                </kbd>
                .
              </p>
            </div>

            {/* Admin Seller Assignment Selector */}
            {isAdmin && (
              <div className="max-w-xs mx-auto bg-purple-50 border border-purple-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  Vendedor do Pedido:
                </span>
                <select
                  value={selectedSellerForAdmin}
                  onChange={(e) => setSelectedSellerForAdmin(e.target.value)}
                  className="bg-white border border-purple-300 text-slate-900 font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Auto">Automático (Do Pedido)</option>
                  {VENDEDORES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all">
                <Upload className="w-4 h-4" />
                <span>Importar PDF ou Arquivo</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>

              <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all">
                <ImageIcon className="w-4 h-4" />
                <span>Importar por Fotografia (Galeria)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Tirar Foto com a Câmera</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Seller's Orders List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            {isAdmin
              ? `Todos os Pedidos (${sellerOrders.length})`
              : `Seus Pedidos (${sellerOrders.length})`}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Atualizado em tempo real
          </span>
        </div>

        {sellerOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">
              Nenhum pedido encontrado
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Você ainda não enviou pedidos hoje. Importe um PDF ou fotografia do pedido para começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sellerOrders.map((order) => {
              const ordersAhead = OrderStore.getOrdersAhead(order, allOrders);
              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  {/* Top Header info: Nome do Cliente highlighted */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900">
                          Pedido #{order.orderNumber}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                          Emissão: {order.dateCad}
                        </span>
                        {isAdmin && (
                          <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                            Vendedor: {order.sellerName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Nome do Cliente
                        </span>
                        <p className="text-sm font-black text-slate-900">
                          {order.clientCode ? `${order.clientCode} - ` : ''}
                          {order.clientName}
                          {order.clientFantasia && (
                            <span className="text-xs font-bold text-emerald-700 ml-2">
                              ({order.clientFantasia})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-sm font-black text-emerald-700">
                        R${' '}
                        {order.totalValue.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        {order.items?.length || order.totalItems} item(ns)
                      </p>
                    </div>
                  </div>

                  {/* Extracted Items Table Preview (SKU, Produto, Quantidade, Validade, Fornecedor) */}
                  {order.items && order.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-900 text-white text-[11px] font-bold grid grid-cols-12 px-3 py-2">
                        <div className="col-span-2 sm:col-span-1">SKU</div>
                        <div className="col-span-4 sm:col-span-5">Produto</div>
                        <div className="col-span-2 text-center">Quantidade</div>
                        <div className="col-span-2 text-center">Validade</div>
                        <div className="col-span-2">Fornecedor</div>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                        {order.items.map((item) => {
                          const validade =
                            item.expirationDate ||
                            extractExpirationDate(item.lotInfo) ||
                            '-';
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-12 px-3 py-2 text-xs items-center hover:bg-slate-50"
                            >
                              <div className="col-span-2 sm:col-span-1 font-mono font-bold text-slate-900">
                                {item.code}
                              </div>
                              <div className="col-span-4 sm:col-span-5 font-semibold text-slate-800 pr-2 truncate">
                                {item.description}
                              </div>
                              <div className="col-span-2 text-center font-black text-emerald-700">
                                {item.quantityOrdered}{' '}
                                <span className="text-[10px] font-normal text-slate-500">
                                  {item.unit || 'UN'}
                                </span>
                              </div>
                              <div className="col-span-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[11px] font-bold">
                                  {validade}
                                </span>
                              </div>
                              <div className="col-span-2 truncate">
                                <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold uppercase truncate max-w-full">
                                  {item.manufacturer || '-'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Queue Position Indicator + Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-slate-700 font-medium">
                        Fila na expedição:
                      </span>
                      {order.status === 'Faturado' ? (
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Finalizado
                        </span>
                      ) : ordersAhead === 0 ? (
                        <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                          Primeiro da Fila (Sendo separado)
                        </span>
                      ) : (
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                          {ordersAhead} pedido(s) na sua frente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenOrder(order)}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                        <Eye className="w-4 h-4 text-emerald-400" />
                        <span>Ver Detalhes e Conferência</span>
                      </button>
                      {onDeleteOrder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOrder(order);
                          }}
                          className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-colors shrink-0 text-xs font-bold flex items-center gap-1.5"
                          title={
                            isAdmin
                              ? 'Excluir pedido (Admin)'
                              : 'Excluir pedido (Requer senha de Admin)'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => {
            setShowCamera(false);
            processCameraCapture(base64);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
