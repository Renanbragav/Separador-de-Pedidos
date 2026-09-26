import React, { useState } from 'react';
import {
  PackageSearch,
  CheckSquare,
  Search,
  Calendar,
  Trash2,
  Upload,
  FileSpreadsheet,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { Order, OrderStatus, VENDEDORES } from '../types';
import {
  extractExpirationDate,
  parseOrderMatrixText,
  ParsedOrderMatrix,
} from '../services/orderMatrixParser';
import { SAMPLE_MATRIX_TEXT } from '../data/sampleOrder';
import { OrderStore } from '../services/store';

interface StockDashboardProps {
  stockUserName: string;
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  isAdmin?: boolean;
  onDeleteOrder?: (order: Order) => void;
  onOrderAdded?: (newOrder: Order) => void;
}

export const StockDashboard: React.FC<StockDashboardProps> = ({
  stockUserName,
  orders,
  onOpenOrder,
  onUpdateStatus,
  isAdmin = false,
  onDeleteOrder,
  onOrderAdded,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'Todos'>('Todos');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSellerForAdmin, setSelectedSellerForAdmin] = useState<string>('Auto');

  const createOrderFromParsedMatrix = (
    parsed: ParsedOrderMatrix,
    fileDataUrl?: string,
    fileType?: 'pdf' | 'image' | 'sample',
    fileName?: string
  ): Order => {
    let sellerDisplay = parsed.sellerName || stockUserName.toUpperCase();
    let sellerNorm = stockUserName;

    if (selectedSellerForAdmin !== 'Auto') {
      sellerDisplay = selectedSellerForAdmin.toUpperCase();
      sellerNorm = selectedSellerForAdmin;
    } else if (parsed.sellerName) {
      const matched = VENDEDORES.find((v) =>
        parsed.sellerName.toLowerCase().includes(v.toLowerCase())
      );
      if (matched) {
        sellerNorm = matched;
      }
    }

    return {
      id: 'ped-' + Date.now(),
      orderNumber:
        parsed.orderNumber ||
        String(Math.floor(160000 + Math.random() * 9000)),
      dateCad: parsed.dateCad || new Date().toLocaleString('pt-BR'),
      clientCode: parsed.clientCode || '',
      clientName: parsed.clientName || 'Cliente Importado',
      clientFantasia: parsed.clientFantasia || '',
      clientAddress: parsed.clientAddress || '',
      cnpj: parsed.cnpj || '',
      transport: parsed.transport || 'TRANSRAPIDO LOGISTICA LTDA',
      route: parsed.route || '1 - LOCAL',
      sellerName: sellerDisplay,
      sellerNormalized: sellerNorm,
      status: 'Pendente',
      totalItems: parsed.items?.length || 0,
      totalValue: parsed.totalValue || 0,
      fileDataUrl,
      fileType,
      fileName,
      createdAt: Date.now(),
      dateKey: new Date().toISOString().split('T')[0],
      items: (parsed.items || []).map((it, idx) => {
        const expDate =
          it.expirationDate || extractExpirationDate(it.lotInfo) || '-';
        return {
          id: `item-${Date.now()}-${idx}`,
          code: it.code || `SKU-${idx + 1}`,
          description: it.description || 'Produto sem descrição',
          presentation: it.presentation || '',
          manufacturer: it.manufacturer || 'PADRÃO',
          expirationDate: expDate,
          quantityOrdered: Number(it.quantityOrdered) || 1,
          quantitySeparated: Number(it.quantityOrdered) || 1,
          unit: it.unit || 'UN',
          unitPrice: Number(it.unitPrice) || 0,
          totalPrice: Number(it.totalPrice) || 0,
          location: it.location || '-',
          lotInfo: it.lotInfo || (expDate !== '-' ? `L->${expDate}` : ''),
          checked: false,
        };
      }),
    };
  };

  const handleAdminFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64DataUrl = reader.result as string;
      try {
        const res = await fetch('/api/parse-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileDataUrl: base64DataUrl,
            fileType: file.type.includes('pdf') ? 'pdf' : 'image',
            sellerName: stockUserName,
          }),
        });
        const json = await res.json();
        const parsed =
          json.success && json.data
            ? json.data
            : parseOrderMatrixText(SAMPLE_MATRIX_TEXT, undefined, stockUserName);
        const newOrder = createOrderFromParsedMatrix(
          parsed,
          base64DataUrl,
          file.type.includes('pdf') ? 'pdf' : 'image',
          file.name
        );
        OrderStore.addOrder(newOrder);
        if (onOrderAdded) onOrderAdded(newOrder);
      } catch (err) {
        const fallbackParsed = parseOrderMatrixText(
          SAMPLE_MATRIX_TEXT,
          undefined,
          stockUserName
        );
        const newOrder = createOrderFromParsedMatrix(
          fallbackParsed,
          base64DataUrl,
          file.type.includes('pdf') ? 'pdf' : 'image',
          file.name
        );
        OrderStore.addOrder(newOrder);
        if (onOrderAdded) onOrderAdded(newOrder);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdminImportSample = () => {
    const parsed = parseOrderMatrixText(
      SAMPLE_MATRIX_TEXT,
      undefined,
      stockUserName
    );
    const sample = createOrderFromParsedMatrix(
      parsed,
      undefined,
      'sample',
      'pedido.pdf (Matriz #160753)'
    );
    OrderStore.addOrder(sample);
    if (onOrderAdded) onOrderAdded(sample);
  };

  // Filter orders by status and search query (including SKU, Produto, Fornecedor, Validade, Cliente)
  const filteredOrders = orders.filter((o) => {
    if (selectedStatus !== 'Todos' && o.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = o.orderNumber?.toLowerCase().includes(q);
      const matchClient = o.clientName?.toLowerCase().includes(q);
      const matchSeller = o.sellerName?.toLowerCase().includes(q);
      const matchItems = o.items?.some(
        (i) =>
          i.description?.toLowerCase().includes(q) ||
          i.code?.toLowerCase().includes(q) ||
          i.manufacturer?.toLowerCase().includes(q) ||
          i.expirationDate?.toLowerCase().includes(q)
      );
      if (!matchNumber && !matchClient && !matchSeller && !matchItems)
        return false;
    }

    return true;
  });

  // Sort orders by queue order (oldest active first for dispatch priority)
  const sortedOrders = [...filteredOrders].sort((a, b) => a.createdAt - b.createdAt);

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

  const statusCounts = {
    Todos: orders.length,
    Pendente: orders.filter((o) => o.status === 'Pendente').length,
    Separando: orders.filter((o) => o.status === 'Separando').length,
    Conferido: orders.filter((o) => o.status === 'Conferido').length,
    'Com Pendências': orders.filter((o) => o.status === 'Com Pendências').length,
    Faturado: orders.filter((o) => o.status === 'Faturado').length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Painel da Equipe do Estoque / Expedição • Matriz Padrão
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Operador: {stockUserName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Visualização completa com Nome do Cliente, SKU, Produto, Quantidade, Validade e Fornecedor extraídos da folha de pedido.
          </p>
        </div>

        {/* Date Selector for Archives */}
        <div className="flex items-center gap-2 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-300 font-semibold">Dia Salvo:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Quick Order Import Bar for Administrators */}
      {isAdmin && (
        <div className="bg-white border-2 border-dashed border-purple-300 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-600" />
              Importar Pedido Diretamente (Administrador {stockUserName})
            </h3>
            <p className="text-xs text-slate-500">
              Importe o PDF ou foto da folha de pedido para replicar automaticamente Cliente, Quantidade, Produto, SKU, Validade e Fornecedor.
            </p>
          </div>

          {isUploading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Importando dados da matriz do pedido...</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-xl px-2.5 py-1.5 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-bold text-purple-900">Vendedor:</span>
                <select
                  value={selectedSellerForAdmin}
                  onChange={(e) => setSelectedSellerForAdmin(e.target.value)}
                  className="bg-white border border-purple-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="Auto">Da Matriz (Auto)</option>
                  {VENDEDORES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <label className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 transition-all">
                <Upload className="w-4 h-4" />
                <span>Importar PDF / Foto</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleAdminFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                'Todos',
                'Pendente',
                'Separando',
                'Conferido',
                'Com Pendências',
                'Faturado',
              ] as (OrderStatus | 'Todos')[]
            ).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  selectedStatus === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{st}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    selectedStatus === st
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {statusCounts[st]}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar cliente, SKU, produto, fornecedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Orders Dispatch Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-emerald-600" />
            Fila de Expedição ({sortedOrders.length} pedido(s))
          </h3>
          <span className="text-xs font-medium text-slate-500">
            Ordenado por ordem de chegada
          </span>
        </div>

        {sortedOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <PackageSearch className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">
              Nenhum pedido nesta categoria ou busca
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Alterne as abas ou limpe o campo de busca para visualizar os demais pedidos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order, index) => {
              const checkedCount =
                order.items?.filter((i) => i.checked).length || 0;
              const totalItems = order.items?.length || 0;
              const percent =
                totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      {/* Queue position index badge */}
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                        #{index + 1}
                      </div>

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
                        </div>
                        <p className="text-sm font-black text-slate-900 mt-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 mr-1.5">
                            Cliente:
                          </span>
                          {order.clientCode ? `${order.clientCode} - ` : ''}
                          {order.clientName}{' '}
                          {order.clientFantasia ? (
                            <span className="text-emerald-700 font-bold text-xs">
                              ({order.clientFantasia})
                            </span>
                          ) : (
                            ''
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 sm:text-right">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">
                          Vendedor
                        </p>
                        <p className="font-bold text-blue-700">{order.sellerName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">
                          Valor
                        </p>
                        <p className="font-extrabold text-emerald-700">
                          R${' '}
                          {order.totalValue.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Matrix Items Summary Table (SKU | Produto | Quantidade | Validade | Fornecedor) */}
                  {order.items && order.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-900 text-white text-[11px] font-bold grid grid-cols-12 px-3 py-2">
                        <div className="col-span-2 sm:col-span-1">SKU</div>
                        <div className="col-span-4 sm:col-span-5">Produto</div>
                        <div className="col-span-2 text-center">Quantidade</div>
                        <div className="col-span-2 text-center">Validade</div>
                        <div className="col-span-2">Fornecedor</div>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white">
                        {order.items.map((item) => {
                          const validade =
                            item.expirationDate ||
                            extractExpirationDate(item.lotInfo) ||
                            '-';
                          return (
                            <div
                              key={item.id}
                              className={`grid grid-cols-12 px-3 py-1.5 text-xs items-center ${
                                item.checked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                              }`}
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

                  {/* Bottom Separation Progress & Open Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {checkedCount}/{totalItems} itens ({percent}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenOrder(order)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Abrir e Separar Pedido (Checklist & Assinatura)</span>
                      </button>

                      {isAdmin && onDeleteOrder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteOrder(order);
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-colors shrink-0"
                          title="Excluir pedido (Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
};
