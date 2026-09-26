import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageSearch,
  CheckSquare,
  Search,
  Calendar,
  Trash2,
  Upload,
  UserCheck,
  PieChart as PieChartIcon,
  History,
  RotateCcw,
  HardDrive,
  Layers,
  Camera,
  Image as ImageIcon,
  Plus,
  X,
  Check,
  Clipboard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Order, OrderStatus, VENDEDORES } from '../types';
import { extractExpirationDate } from '../services/orderMatrixParser';
import {
  OrderStore,
  getLocalDateKey,
  getDateKeyDaysAgo,
  MAX_RETENTION_DAYS,
} from '../services/store';
import {
  runOrderImportWithProgress,
  readFileAsDataUrl,
  compressImageDataUrl,
} from '../services/orderImporter';
import {
  ImportProgressModal,
  ImportProgressState,
} from './ImportProgressModal';
import { CameraCapture } from './CameraCapture';

interface StockDashboardProps {
  stockUserName: string;
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  isAdmin?: boolean;
  onDeleteOrder?: (order: Order) => void;
  onOrderAdded?: (newOrder: Order) => void;
}

function formatDateKeyLabel(dateKey: string, todayKey: string, yesterdayKey: string): string {
  if (dateKey === 'ALL_30_DAYS') return 'Últimos 30 Dias (Geral)';
  const parts = dateKey.split('-');
  const formatted =
    parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
  if (dateKey === todayKey) return `Hoje (${formatted})`;
  if (dateKey === yesterdayKey) return `Ontem (${formatted})`;
  return formatted;
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
  const todayKey = useMemo(() => getLocalDateKey(), []);
  const yesterdayKey = useMemo(() => getDateKeyDaysAgo(1), []);
  const minAllowedDateKey = useMemo(
    () => getDateKeyDaysAgo(MAX_RETENTION_DAYS),
    []
  );

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'Todos'>('Todos');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    active: false,
    percent: 0,
    stageText: '',
    sourceType: 'pdf',
  });
  const [showCamera, setShowCamera] = useState(false);
  const [selectedSellerForAdmin, setSelectedSellerForAdmin] = useState<string>('Auto');
  const [storageCleanedMsg, setStorageCleanedMsg] = useState<string | null>(null);
  const [stagedImages, setStagedImages] = useState<string[]>([]);
  const [pastedInfoMsg, setPastedInfoMsg] = useState<string | null>(null);

  // Build daily archive summary for all saved days within the 30-day window
  const savedDaysArchive = useMemo(() => {
    const map = new Map<
      string,
      {
        dateKey: string;
        total: number;
        pendente: number;
        emSeparacao: number;
        faturado: number;
        totalValue: number;
      }
    >();

    // Always include Today and Yesterday in quick history tabs
    map.set(todayKey, {
      dateKey: todayKey,
      total: 0,
      pendente: 0,
      emSeparacao: 0,
      faturado: 0,
      totalValue: 0,
    });
    map.set(yesterdayKey, {
      dateKey: yesterdayKey,
      total: 0,
      pendente: 0,
      emSeparacao: 0,
      faturado: 0,
      totalValue: 0,
    });

    for (const o of orders) {
      const dKey =
        o.dateKey ||
        (o.createdAt ? getLocalDateKey(new Date(o.createdAt)) : todayKey);
      if (!map.has(dKey)) {
        map.set(dKey, {
          dateKey: dKey,
          total: 0,
          pendente: 0,
          emSeparacao: 0,
          faturado: 0,
          totalValue: 0,
        });
      }
      const entry = map.get(dKey)!;
      entry.total += 1;
      entry.totalValue += o.totalValue || 0;
      if (o.status === 'Pendente' || o.status === 'Com Pendências') {
        entry.pendente += 1;
      } else if (o.status === 'Separando' || o.status === 'Conferido') {
        entry.emSeparacao += 1;
      } else if (o.status === 'Faturado') {
        entry.faturado += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey)
    );
  }, [orders, todayKey, yesterdayKey]);

  // Orders for the currently selected day (or all 30 days)
  const ordersForSelectedDay = useMemo(() => {
    if (selectedDate === 'ALL_30_DAYS') {
      return orders;
    }
    return orders.filter((o) => {
      const dKey =
        o.dateKey ||
        (o.createdAt ? getLocalDateKey(new Date(o.createdAt)) : todayKey);
      return dKey === selectedDate;
    });
  }, [orders, selectedDate, todayKey]);

  // Recharts Pie Chart Data for "Resumo do Dia" (Pendente, Em separação, Faturado)
  const pieChartStats = useMemo(() => {
    const pendenteCount = ordersForSelectedDay.filter(
      (o) => o.status === 'Pendente' || o.status === 'Com Pendências'
    ).length;
    const emSeparacaoCount = ordersForSelectedDay.filter(
      (o) => o.status === 'Separando' || o.status === 'Conferido'
    ).length;
    const faturadoCount = ordersForSelectedDay.filter(
      (o) => o.status === 'Faturado'
    ).length;
    const totalDayValue = ordersForSelectedDay.reduce(
      (acc, o) => acc + (o.totalValue || 0),
      0
    );

    const chartData = [
      {
        name: 'Pendente',
        value: pendenteCount,
        color: '#f59e0b', // amber-500
      },
      {
        name: 'Em separação',
        value: emSeparacaoCount,
        color: '#3b82f6', // blue-500
      },
      {
        name: 'Faturado',
        value: faturadoCount,
        color: '#10b981', // emerald-500
      },
    ];

    return {
      pendenteCount,
      emSeparacaoCount,
      faturadoCount,
      totalCount: ordersForSelectedDay.length,
      totalDayValue,
      chartData,
      activeSlices: chartData.filter((d) => d.value > 0),
    };
  }, [ordersForSelectedDay]);

  const addAdminImageFilesToStage = async (files: File[]) => {
    const newUrls: string[] = [];
    for (const f of files) {
      try {
        const raw = await readFileAsDataUrl(f);
        newUrls.push(raw);
      } catch (err) {
        console.error('Erro ao ler imagem:', err);
      }
    }
    if (newUrls.length > 0) {
      setStagedImages((prev) => [...prev, ...newUrls]);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
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
      if (!e.clipboardData || !e.clipboardData.items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          const f = item.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        await addAdminImageFilesToStage(pastedFiles);
        setPastedInfoMsg(
          'Foto colada (Ctrl+V)! A imagem está visível abaixo — cole mais páginas se desejar ou clique em "Processar e Importar Pedido".'
        );
        setTimeout(() => setPastedInfoMsg(null), 5000);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isAdmin]);

  const handleAdminFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);
    e.target.value = '';

    const pdfFile = files.find(
      (f: File) => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFile && stagedImages.length === 0) {
      try {
        const newOrder = await runOrderImportWithProgress({
          file: pdfFile,
          userName: stockUserName,
          isAdmin: true,
          selectedSellerForAdmin,
          onProgress: setImportProgress,
        });
        setSelectedDate(todayKey);
        if (onOrderAdded) onOrderAdded(newOrder);
      } catch (err) {
        console.error('Erro ao importar PDF:', err);
        setImportProgress((prev) => ({ ...prev, active: false }));
      }
      return;
    }

    const imageFiles = files.filter(
      (f: File) =>
        f.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name)
    );
    if (imageFiles.length > 0) {
      await addAdminImageFilesToStage(imageFiles);
    }
  };

  const handleAdminImportStagedImages = async () => {
    if (stagedImages.length === 0) return;
    try {
      const pages = [...stagedImages];
      const newOrder = await runOrderImportWithProgress({
        imageDataUrls: pages,
        userName: stockUserName,
        isAdmin: true,
        selectedSellerForAdmin,
        onProgress: setImportProgress,
      });
      setStagedImages([]);
      setSelectedDate(todayKey);
      if (onOrderAdded) onOrderAdded(newOrder);
    } catch (err) {
      console.error('Erro ao importar fotografias:', err);
      setImportProgress((prev) => ({ ...prev, active: false }));
    }
  };

  const handleAdminCameraCapture = async (base64DataUrl: string) => {
    const compressed = await compressImageDataUrl(base64DataUrl, 1400);
    setStagedImages((prev) => [...prev, compressed]);
  };

  const handleManualPruneCheck = () => {
    const removed = OrderStore.cleanExpiredHistory();
    setStorageCleanedMsg(
      removed > 0
        ? `${removed} pedido(s) com mais de 30 dias foram removidos para liberar espaço.`
        : 'Espaço otimizado! Todos os pedidos salvos estão dentro do limite dos últimos 30 dias.'
    );
    setTimeout(() => setStorageCleanedMsg(null), 4000);
  };

  // Filter orders for the selected day by status and search query
  const filteredOrders = ordersForSelectedDay.filter((o) => {
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
    Todos: ordersForSelectedDay.length,
    Pendente: ordersForSelectedDay.filter((o) => o.status === 'Pendente').length,
    Separando: ordersForSelectedDay.filter((o) => o.status === 'Separando').length,
    Conferido: ordersForSelectedDay.filter((o) => o.status === 'Conferido').length,
    'Com Pendências': ordersForSelectedDay.filter(
      (o) => o.status === 'Com Pendências'
    ).length,
    Faturado: ordersForSelectedDay.filter((o) => o.status === 'Faturado').length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Painel da Equipe do Estoque / Expedição • Arquivo de 30 Dias
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Operador: {stockUserName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Todos os pedidos ficam salvos diariamente por <strong className="text-emerald-300">30 dias</strong> e podem ser reabertos a qualquer momento.
          </p>
        </div>

        {/* Date Picker & 30-Day Retention Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-semibold">
              Consultar Dia:
            </span>
            <input
              type="date"
              min={minAllowedDateKey}
              max={todayKey}
              value={selectedDate === 'ALL_30_DAYS' ? todayKey : selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* RESUMO DO DIA & HISTÓRICO DE 30 DIAS (RECHARTS PIE CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Main Column: Resumo do Dia Pie Chart & Status Breakdown */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Resumo do Dia:{' '}
                  <span className="text-emerald-700">
                    {formatDateKeyLabel(selectedDate, todayKey, yesterdayKey)}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribuição de pedidos por status (Pendente, Em separação e Faturado)
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Total Movimentado
              </span>
              <span className="text-sm font-black text-emerald-700">
                R${' '}
                {pieChartStats.totalDayValue.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Recharts PieChart */}
            <div className="sm:col-span-6 h-56 w-full flex items-center justify-center">
              {pieChartStats.totalCount === 0 ? (
                <div className="text-center space-y-2 p-4">
                  <div className="w-24 h-24 rounded-full border-8 border-slate-100 flex items-center justify-center mx-auto">
                    <span className="text-xs font-bold text-slate-400">
                      0 pedidos
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Nenhum pedido registrado nesta data.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartStats.activeSlices}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {pieChartStats.activeSlices.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${value} pedido(s)`,
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px', fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 3 Core Status KPI Cards */}
            <div className="sm:col-span-6 space-y-2.5">
              {/* Pendente */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-amber-950">Pendente</p>
                    <p className="text-[10px] text-amber-700">
                      Aguardando início ou com pendência
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-amber-900">
                  {pieChartStats.pendenteCount}
                </span>
              </div>

              {/* Em Separação */}
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-blue-950">
                      Em separação
                    </p>
                    <p className="text-[10px] text-blue-700">
                      Separando no estoque ou conferido
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-blue-900">
                  {pieChartStats.emSeparacaoCount}
                </span>
              </div>

              {/* Faturado */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-emerald-950">
                      Faturado
                    </p>
                    <p className="text-[10px] text-emerald-700">
                      Finalizado (pode ser reaberto)
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-emerald-900">
                  {pieChartStats.faturadoCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Histórico dos Dias Anteriores (Últimos 30 Dias) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">
                  Arquivo Diário (Últimos 30 Dias)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Clique em qualquer dia anterior para visualizar e reabrir pedidos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate('ALL_30_DAYS')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                selectedDate === 'ALL_30_DAYS'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Ver Todos (30d)
            </button>
          </div>

          {/* Scrollable List of Saved Days */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {savedDaysArchive.map((day) => {
              const isSelected = selectedDate === day.dateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(day.dateKey)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div>
                    <p className="text-xs font-black flex items-center gap-1.5">
                      <Calendar
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      {formatDateKeyLabel(day.dateKey, todayKey, yesterdayKey)}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {day.total} pedido(s) • R${' '}
                      {day.totalValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  {/* Mini status pills */}
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <span
                      className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30"
                      title="Pendentes"
                    >
                      P: {day.pendente}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 border border-blue-500/30"
                      title="Em Separação"
                    >
                      S: {day.emSeparacao}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                      title="Faturados"
                    >
                      F: {day.faturado}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 30-day automatic cleanup footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Retenção automática de <strong>30 dias</strong> (anteriores são apagados)
              </span>
            </div>
            <button
              type="button"
              onClick={handleManualPruneCheck}
              className="text-emerald-700 hover:underline font-bold shrink-0"
            >
              Verificar Espaço
            </button>
          </div>
          {storageCleanedMsg && (
            <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
              {storageCleanedMsg}
            </div>
          )}
        </div>
      </div>

      {/* Global Percentage Progress Modal */}
      <ImportProgressModal progress={importProgress} />

      {/* Quick Order Import Bar for Administrators */}
      {isAdmin && (
        <div className="bg-white border-2 border-dashed border-purple-300 rounded-2xl p-4 shadow-sm space-y-4">
          {pastedInfoMsg && (
            <div className="bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
              <Clipboard className="w-4 h-4 shrink-0" />
              <span>{pastedInfoMsg}</span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-600" />
                Importar Pedido Diretamente (Administrador {stockUserName})
              </h3>
              <p className="text-xs text-slate-500">
                Cole uma ou mais fotos com <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold">Ctrl + V</kbd> (múltiplas páginas), selecione da galeria ou envie PDF.
              </p>
            </div>

            {importProgress.active ? (
              <div className="w-full lg:w-80 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black text-purple-900">
                  <span className="truncate pr-2">{importProgress.stageText}</span>
                  <span className="font-mono text-purple-700">
                    {Math.round(importProgress.percent)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-purple-100 rounded-full overflow-hidden border border-purple-200">
                  <div
                    className="h-full bg-purple-600 transition-all duration-200"
                    style={{ width: `${importProgress.percent}%` }}
                  />
                </div>
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
                    <option value="Auto">Do Pedido (Auto)</option>
                    {VENDEDORES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 transition-all">
                  <Upload className="w-4 h-4" />
                  <span>Importar PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleAdminFileUpload}
                    className="hidden"
                  />
                </label>

                <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 transition-all">
                  <ImageIcon className="w-4 h-4" />
                  <span>Selecionar Fotografia(s)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAdminFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Tirar Foto</span>
                </button>
              </div>
            )}
          </div>

          {/* Multi-Page Staged Images Preview Gallery for Admin */}
          {stagedImages.length > 0 && !importProgress.active && (
            <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-xs font-black text-emerald-400 uppercase">
                    {stagedImages.length} Página(s) / Fotografia(s) Pronta(s) para Importar
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Cole mais imagens com Ctrl + V se o pedido tiver mais páginas, ou clique em "Processar e Importar Pedido".
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStagedImages([])}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                >
                  Limpar Todas
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {stagedImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-800 px-2 py-1 flex items-center justify-between text-[10px] font-bold text-emerald-300">
                      <span>Página {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setStagedImages((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <img
                      src={imgUrl}
                      alt={`Página ${idx + 1}`}
                      className="h-28 w-full object-contain bg-slate-950"
                    />
                  </div>
                ))}

                <label className="border border-dashed border-slate-700 hover:border-emerald-400 rounded-lg min-h-[120px] flex flex-col items-center justify-center gap-1 p-2 cursor-pointer text-slate-400 hover:text-emerald-300 text-center">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <span className="text-[11px] font-bold">+ Mais Páginas</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAdminFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAdminImportStagedImages}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Processar e Importar Pedido ({stagedImages.length} página
                    {stagedImages.length > 1 ? 's' : ''})
                  </span>
                </button>
              </div>
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

      {/* Orders Dispatch Queue for Selected Day */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-emerald-600" />
            Pedidos de {formatDateKeyLabel(selectedDate, todayKey, yesterdayKey)} ({sortedOrders.length})
          </h3>
          <span className="text-xs font-medium text-slate-500">
            Clique em qualquer pedido salvo para reabrir, conferir ou alterar o status
          </span>
        </div>

        {sortedOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <PackageSearch className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">
              Nenhum pedido encontrado para {formatDateKeyLabel(selectedDate, todayKey, yesterdayKey)}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Selecione outro dia no Arquivo Diário de 30 Dias acima ou alterne o filtro de status.
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
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            Data: {order.dateKey || todayKey}
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

                  {/* Matrix Items Summary Table (Cdgo | Produto/Local | Qtde | Validade | Fornecedor | Total) */}
                  {order.items && order.items.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-900 text-white text-[11px] font-bold grid grid-cols-12 px-3 py-2">
                        <div className="col-span-1">Cdgo</div>
                        <div className="col-span-4">Produto / Local</div>
                        <div className="col-span-2 text-center">Qtde</div>
                        <div className="col-span-2 text-center">Validade</div>
                        <div className="col-span-2">Fornecedor</div>
                        <div className="col-span-1 text-right">Total</div>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white">
                        {order.items.map((item) => {
                          const validade =
                            item.expirationDate ||
                            extractExpirationDate(item.lotInfo) ||
                            '-';
                          const itemTotal =
                            Number(item.totalPrice) ||
                            (Number(item.unitPrice) || 0) * item.quantityOrdered;
                          return (
                            <div
                              key={item.id}
                              className={`grid grid-cols-12 px-3 py-1.5 text-xs items-center ${
                                item.checked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="col-span-1 font-mono font-bold text-slate-900">
                                {item.code}
                              </div>
                              <div className="col-span-4 pr-2">
                                <span className="font-semibold text-slate-800 block truncate">
                                  {item.description}
                                </span>
                                {item.location && item.location !== '-' && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Local: {item.location}
                                  </span>
                                )}
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
                              <div className="col-span-1 text-right font-mono font-bold text-slate-800 text-[11px]">
                                {itemTotal > 0
                                  ? itemTotal.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })
                                  : '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bottom Separation Progress & Reopen / Open Buttons */}
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

                    <div className="flex flex-wrap items-center gap-2">
                      {order.status === 'Faturado' && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(order.id, 'Separando')}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          title="Reabrir este pedido para nova conferência ou separação"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reabrir Pedido</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenOrder(order)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>
                          {order.status === 'Faturado'
                            ? 'Reabrir / Ver Checklist Completo'
                            : 'Abrir e Separar Pedido (Checklist & Assinatura)'}
                        </span>
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
      {/* Camera Modal for Admin */}
      {showCamera && (
        <CameraCapture
          onCapture={(base64) => {
            setShowCamera(false);
            handleAdminCameraCapture(base64);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
