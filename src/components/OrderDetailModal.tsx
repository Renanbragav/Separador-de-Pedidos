import React, { useState } from 'react';
import {
  X,
  CheckSquare,
  Square,
  Package,
  User,
  MapPin,
  Truck,
  DollarSign,
  AlertTriangle,
  FileText,
  Printer,
  Save,
  Trash2,
  CheckCircle2,
  Check,
  FileSearch,
  Lock,
  Plus,
} from 'lucide-react';
import { Order, OrderItem, OrderStatus, ESTOQUE_USERS, UserRole } from '../types';
import { SignaturePad } from './SignaturePad';
import { AuthStore } from '../services/authStore';
import { extractExpirationDate } from '../services/orderMatrixParser';

interface OrderDetailModalProps {
  order: Order;
  userRole: UserRole;
  userName: string;
  onClose: () => void;
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  onDeleteOrder: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  userRole,
  userName,
  onClose,
  onUpdateOrder,
  onDeleteOrder,
}) => {
  const [clientName, setClientName] = useState(order.clientName || '');
  const [items, setItems] = useState<OrderItem[]>(() =>
    (order.items || []).map((it) => ({
      ...it,
      expirationDate:
        it.expirationDate || extractExpirationDate(it.lotInfo) || '-',
      manufacturer: it.manufacturer || 'PADRÃO',
    }))
  );
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [notaFiscal, setNotaFiscal] = useState(order.notaFiscal || '');
  const [volumes, setVolumes] = useState<number>(order.volumes || 1);
  const [separador, setSeparador] = useState(
    order.separador || (userRole === 'estoque' ? userName : ESTOQUE_USERS[0])
  );
  const [conferente, setConferente] = useState(
    order.conferente || ESTOQUE_USERS[1] || 'Gabriel'
  );
  const [pendenciesNotes, setPendenciesNotes] = useState(
    order.pendenciesNotes || ''
  );
  const [signatureBase64, setSignatureBase64] = useState(
    order.signatureBase64 || ''
  );
  const pageImages =
    order.fileDataUrls && order.fileDataUrls.length > 0
      ? order.fileDataUrls
      : order.fileDataUrl && order.fileType !== 'pdf'
      ? [order.fileDataUrl]
      : [];
  const [showImagePreview, setShowImagePreview] = useState(
    pageImages.length > 0
  );
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  // Quick Add Item row state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newProd, setNewProd] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newValidade, setNewValidade] = useState('');
  const [newFornecedor, setNewFornecedor] = useState('');

  const isAdminUser = AuthStore.isAdmin(userName) || userRole === 'admin';
  const canChangeStatus = isAdminUser || userRole === 'estoque';
  const canRequestDelete = isAdminUser || userRole === 'vendedor';

  const handleDeleteClick = () => {
    if (!canRequestDelete) {
      return;
    }
    onDeleteOrder(order);
  };

  // Calculate separation progress
  const totalItemsCount = items.length;
  const checkedItemsCount = items.filter((i) => i.checked).length;
  const progressPercent =
    totalItemsCount > 0
      ? Math.round((checkedItemsCount / totalItemsCount) * 100)
      : 0;

  const toggleItemCheck = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const updateQuantitySeparated = (itemId: string, newQty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantitySeparated: Math.max(0, newQty) }
          : item
      )
    );
  };

  const handleAddMatrixItem = () => {
    if (!newProd.trim()) return;
    const added: OrderItem = {
      id: `item-${Date.now()}`,
      code: newSku.trim() || String(Math.floor(1000 + Math.random() * 9000)),
      description: newProd.trim().toUpperCase(),
      quantityOrdered: Math.max(1, Number(newQty) || 1),
      quantitySeparated: Math.max(1, Number(newQty) || 1),
      unit: 'UN',
      expirationDate: newValidade.trim() || '-',
      manufacturer: newFornecedor.trim().toUpperCase() || 'PADRÃO',
      lotInfo: newValidade.trim() ? `L->${newValidade.trim()}` : '',
      location: '-',
      checked: false,
    };
    setItems((prev) => [...prev, added]);
    setNewSku('');
    setNewProd('');
    setNewQty(1);
    setNewValidade('');
    setNewFornecedor('');
    setShowAddRow(false);
  };

  const handleSave = () => {
    onUpdateOrder(order.id, {
      clientName,
      items,
      totalItems: items.length,
      status: canChangeStatus ? status : order.status,
      notaFiscal,
      volumes,
      separador,
      conferente,
      pendenciesNotes,
      signatureBase64,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (!canChangeStatus) {
      return;
    }
    setStatus(newStatus);
    onUpdateOrder(order.id, {
      clientName,
      status: newStatus,
      items,
      totalItems: items.length,
      notaFiscal,
      volumes,
      separador,
      conferente,
      pendenciesNotes,
      signatureBase64,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (st: OrderStatus) => {
    switch (st) {
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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              #{order.orderNumber}
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Pedido nº {order.orderNumber}
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusColor(
                    status
                  )}`}
                >
                  {status}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Vendedor: <strong className="text-slate-200">{order.sellerName}</strong> • Emissão: {order.dateCad}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Imprimir espelho de pedido"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800 flex-1">
          {/* Status Workflow Selector bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Status do Pedido
              </label>
              {!canChangeStatus ? (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Somente Estoque e Administradores podem alterar o status
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-700">
                  Clique para atualizar o status do pedido
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(
                [
                  'Pendente',
                  'Separando',
                  'Conferido',
                  'Com Pendências',
                  'Faturado',
                ] as OrderStatus[]
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={!canChangeStatus}
                  onClick={() => handleStatusChange(st)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-center flex items-center justify-center gap-1.5 ${
                    status === st
                      ? getStatusColor(st) + ' ring-2 ring-offset-1 ring-emerald-500'
                      : canChangeStatus
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  {status === st && <Check className="w-3.5 h-3.5" />}
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Client & Shipping Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome do Cliente Info */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                Nome do Cliente (Extraído da Matriz)
              </h3>
              <div>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-sm font-black text-slate-900 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {order.clientFantasia && (
                  <p className="text-xs font-semibold text-emerald-700 mt-1">
                    Fantasia: {order.clientFantasia}
                  </p>
                )}
                {order.clientAddress && (
                  <p className="text-xs text-slate-600 flex items-start gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{order.clientAddress}</span>
                  </p>
                )}
                {order.cnpj && (
                  <p className="text-xs text-slate-500 mt-1">CNPJ: {order.cnpj}</p>
                )}
              </div>
            </div>

            {/* Shipping & Transport Info */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                Expedição e Logística
              </h3>
              <div className="space-y-1 text-xs text-slate-700">
                <p>
                  <strong className="text-slate-900">Transportadora:</strong>{' '}
                  {order.transport || 'Própria / Retirada'}
                </p>
                <p>
                  <strong className="text-slate-900">Rota:</strong>{' '}
                  {order.route || 'Local'}
                </p>
                <p>
                  <strong className="text-slate-900">Data do Pedido:</strong>{' '}
                  {order.dateCad}
                </p>
                <p className="pt-1 text-sm font-bold text-emerald-700 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Valor Total: R${' '}
                  {order.totalValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* File attachment preview button if present */}
          {(order.fileDataUrl || pageImages.length > 0) && (
            <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>
                  Folha / Fotografias do Pedido Original (
                  {pageImages.length > 0
                    ? `${pageImages.length} página(s)`
                    : order.fileName || 'Arquivo'}
                  )
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowImagePreview(!showImagePreview)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <FileSearch className="w-3.5 h-3.5" />
                {showImagePreview
                  ? 'Ocultar Páginas do Pedido'
                  : `Ver Páginas do Pedido (${pageImages.length || 1})`}
              </button>
            </div>
          )}

          {showImagePreview && (order.fileDataUrl || pageImages.length > 0) && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              {order.fileType === 'pdf' && order.fileDataUrl ? (
                <iframe
                  src={order.fileDataUrl}
                  className="w-full h-96 rounded-lg border border-slate-700"
                  title="PDF do pedido"
                />
              ) : pageImages.length > 0 ? (
                <>
                  {pageImages.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <span className="text-xs font-bold text-emerald-400">
                        Visualizando Página {activePageIndex + 1} de{' '}
                        {pageImages.length}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pageImages.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePageIndex(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              activePageIndex === idx
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            Página {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <img
                      src={pageImages[activePageIndex] || pageImages[0]}
                      alt={`Página ${activePageIndex + 1} do Pedido`}
                      className="max-h-96 mx-auto rounded-lg object-contain border border-slate-700"
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Items Matrix & Separation Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Matriz de Produtos: SKU • Produto • Quantidade • Validade • Fornecedor ({checkedItemsCount}/{totalItemsCount})
                </h3>
                <p className="text-xs text-slate-500">
                  Dados replicados diretamente da folha de pedido. Marque o quadrado ao conferir cada item.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allChecked = items.every((i) => i.checked);
                      setItems((prev) =>
                        prev.map((i) => ({ ...i, checked: !allChecked }))
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    {items.every((i) => i.checked)
                      ? 'Desmarcar Todos'
                      : 'Dar Check em Todos'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAddRow(!showAddRow)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </button>

                {/* Progress bar */}
                <div className="w-36 sm:w-44 space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>Conferido</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progressPercent === 100
                          ? 'bg-emerald-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Add Row Form */}
            {showAddRow && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">SKU / Cdgo</label>
                  <input
                    type="text"
                    placeholder="Ex: 2188"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Produto</label>
                  <input
                    type="text"
                    placeholder="Ex: IM CREATINA 300G"
                    value={newProd}
                    onChange={(e) => setNewProd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Validade</label>
                  <input
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={newValidade}
                    onChange={(e) => setNewValidade(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Fornecedor</label>
                    <input
                      type="text"
                      placeholder="Ex: INTEGRALMEDICA"
                      value={newFornecedor}
                      onChange={(e) => setNewFornecedor(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMatrixItem}
                    className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-500 self-end"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* Matrix Table Header & Rows */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 bg-white shadow-sm">
              <div className="bg-slate-900 text-white text-[11px] font-bold grid grid-cols-12 px-3 py-2.5 text-left items-center">
                <div className="col-span-1 text-center">Check</div>
                <div className="col-span-1">Cdgo</div>
                <div className="col-span-3">Produto / Local</div>
                <div className="col-span-2">Fornec./Fab.</div>
                <div className="col-span-1 text-center">Validade</div>
                <div className="col-span-1 text-center">Qtde</div>
                <div className="col-span-1 text-center">Q. Sep</div>
                <div className="col-span-2 text-right">Vr. Unit / Total</div>
              </div>

              {items.map((item) => {
                const falta = item.quantityOrdered - item.quantitySeparated;
                const validade =
                  item.expirationDate && item.expirationDate !== '-'
                    ? item.expirationDate
                    : extractExpirationDate(item.lotInfo) || '-';
                const uPrice = Number(item.unitPrice) || 0;
                const tPrice =
                  Number(item.totalPrice) || uPrice * item.quantityOrdered || 0;

                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 px-3 py-3 items-center text-xs transition-colors hover:bg-slate-50/80 ${
                      item.checked ? 'bg-emerald-50/70' : ''
                    }`}
                  >
                    {/* Checkbox button */}
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleItemCheck(item.id)}
                        className="p-1 text-emerald-600 hover:scale-110 transition-transform"
                        title="Dar check neste item"
                      >
                        {item.checked ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    {/* SKU */}
                    <div className="col-span-1 font-mono pr-1">
                      <span className="font-black text-slate-900 text-xs block">
                        {item.code}
                      </span>
                    </div>

                    {/* Produto (Description), Local & Lot */}
                    <div
                      onClick={() => toggleItemCheck(item.id)}
                      className="col-span-3 pr-2 cursor-pointer"
                    >
                      <p
                        className={`font-bold text-slate-900 ${
                          item.checked ? 'line-through text-emerald-800' : ''
                        }`}
                      >
                        {item.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {item.location && item.location !== '-' && (
                          <span className="inline-block text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                            Local: {item.location}
                          </span>
                        )}
                        {item.lotInfo && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.lotInfo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fornecedor */}
                    <div className="col-span-2 pr-1">
                      <span className="inline-block bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[11px] uppercase truncate max-w-full">
                        {item.manufacturer || '-'}
                      </span>
                    </div>

                    {/* Validade */}
                    <div className="col-span-1 text-center">
                      <span className="inline-block bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px]">
                        {validade}
                      </span>
                    </div>

                    {/* Quantidade */}
                    <div className="col-span-1 text-center font-black text-slate-900">
                      {item.quantityOrdered}{' '}
                      <span className="text-[10px] text-slate-500 font-normal block">
                        {item.unit || 'UN'}
                      </span>
                    </div>

                    {/* Quantity Separated Input */}
                    <div className="col-span-1 flex flex-col items-center">
                      <input
                        type="number"
                        min="0"
                        value={item.quantitySeparated}
                        onChange={(e) =>
                          updateQuantitySeparated(
                            item.id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className={`w-12 text-center font-bold border rounded py-1 text-xs focus:ring-1 focus:ring-emerald-500 ${
                          falta > 0
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      />
                      {falta > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 mt-0.5">
                          Falta {falta}
                        </span>
                      )}
                    </div>

                    {/* Unit Price & Total Price */}
                    <div className="col-span-2 text-right font-mono">
                      <span className="text-xs font-black text-emerald-700 block">
                        R${' '}
                        {tPrice.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Unit: R${' '}
                        {uPrice.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch Info & Signatures Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              Conferência Final de Expedição & Assinatura
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nota Fiscal (Nº NF)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 045192"
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nº de Volumes
                </label>
                <input
                  type="number"
                  min="1"
                  value={volumes}
                  onChange={(e) => setVolumes(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Separador (Estoque)
                </label>
                <select
                  value={separador}
                  onChange={(e) => setSeparador(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                >
                  {ESTOQUE_USERS.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Conferente (Estoque)
                </label>
                <select
                  value={conferente}
                  onChange={(e) => setConferente(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                >
                  {ESTOQUE_USERS.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pendencies notes if any shortages */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Observações de Faltas ou Pendências
              </label>
              <textarea
                rows={2}
                placeholder="Informe se houve faltas de produtos, substituições ou avarias..."
                value={pendenciesNotes}
                onChange={(e) => setPendenciesNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Manual Digital Signature Canvas */}
            <div className="pt-2 border-t border-slate-200">
              <SignaturePad
                initialSignature={signatureBase64}
                onSave={(sig) => setSignatureBase64(sig)}
                label="Assinatura Manual do Separador / Conferente"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Controls - Admin & Vendedor Delete with Confirmation */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {canRequestDelete ? (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-200 transition-colors"
              title={
                isAdminUser
                  ? 'Excluir pedido (Solicitará confirmação)'
                  : 'Excluir pedido (Requer confirmação e senha de Administrador)'
              }
            >
              <Trash2 className="w-4 h-4" />
              {isAdminUser
                ? 'Excluir Pedido (Admin)'
                : 'Excluir Pedido (Requer Senha Admin)'}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Exclusão permitida apenas com autorização de Administrador</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold transition-colors"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Salvo!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
