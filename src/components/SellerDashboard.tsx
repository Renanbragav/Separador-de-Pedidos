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
  Plus,
  X,
  Check,
  ZoomIn,
} from 'lucide-react';
import { Order, OrderStatus, VENDEDORES } from '../types';
import { OrderStore } from '../services/store';
import { CameraCapture } from './CameraCapture';
import { extractExpirationDate } from '../services/orderMatrixParser';
import {
  runOrderImportWithProgress,
  readFileAsDataUrl,
  compressImageDataUrl,
} from '../services/orderImporter';
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

  // Multi-page image staging (for Ctrl+V, Gallery photos, and Camera captures)
  const [stagedImages, setStagedImages] = useState<string[]>([]);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

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

  // Add one or more image files to the multi-page preview gallery
  const addImageFilesToStage = async (files: File[]) => {
    const newUrls: string[] = [];
    for (const f of files) {
      try {
        const raw = await readFileAsDataUrl(f);
        newUrls.push(raw);
      } catch (e) {
        console.error('Erro ao ler imagem:', e);
      }
    }
    if (newUrls.length > 0) {
      setStagedImages((prev) => [...prev, ...newUrls]);
    }
  };

  // Process a PDF file directly, or if image files are chosen, stage them so user can see them and add more pages
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const pdfFile = files.find(
      (f) => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFile && stagedImages.length === 0) {
      try {
        const newOrder = await runOrderImportWithProgress({
          file: pdfFile,
          userName: sellerName,
          isAdmin,
          selectedSellerForAdmin,
          onProgress: setImportProgress,
        });
        onOrderAdded(newOrder);
      } catch (err) {
        console.error('Erro na importação de PDF:', err);
        setImportProgress((prev) => ({ ...prev, active: false }));
      }
      return;
    }

    // Filter image files and add them to the visible staging gallery
    const imageFiles = files.filter(
      (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name)
    );
    if (imageFiles.length > 0) {
      await addImageFilesToStage(imageFiles);
      setPastedImageInfo(
        `${imageFiles.length} imagem(ns) adicionada(s)! Você pode colar ou adicionar mais páginas antes de importar.`
      );
      setTimeout(() => setPastedImageInfo(null), 4500);
    }
  };

  // Import all staged images (1 or multiple pages) with 0% -> 100% progress bar
  const handleImportStagedImages = async () => {
    if (stagedImages.length === 0) return;
    try {
      const pagesToImport = [...stagedImages];
      const newOrder = await runOrderImportWithProgress({
        imageDataUrls: pagesToImport,
        userName: sellerName,
        isAdmin,
        selectedSellerForAdmin,
        onProgress: setImportProgress,
      });
      setStagedImages([]);
      onOrderAdded(newOrder);
    } catch (err) {
      console.error('Erro ao importar páginas fotografadas:', err);
      setImportProgress((prev) => ({ ...prev, active: false }));
    }
  };

  const handleRemoveStagedImage = (index: number) => {
    setStagedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Clipboard Paste (Ctrl + V) — shows pasted image immediately and allows pasting multiple pages!
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

      // Check for pasted image(s) (Ctrl + V)
      if (e.clipboardData.items) {
        const pastedFiles: File[] = [];
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              pastedFiles.push(file);
            }
          }
        }

        if (pastedFiles.length > 0) {
          e.preventDefault();
          await addImageFilesToStage(pastedFiles);
          setPastedImageInfo(
            'Foto colada com sucesso (Ctrl+V)! A imagem já está visível abaixo — cole mais páginas se o pedido tiver mais folhas ou clique em "Importar Pedido".'
          );
          setTimeout(() => setPastedImageInfo(null), 5000);
          return;
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
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
              Importe seus pedidos em PDF ou cole uma ou mais fotografias com <strong className="text-emerald-300">Ctrl + V</strong> (suporta múltiplas páginas).
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
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 shrink-0" />
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
            : stagedImages.length > 0
            ? 'border-emerald-500 bg-emerald-50/20'
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
                Cole fotos da folha de pedido com{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-800">
                  Ctrl + V
                </kbd>{' '}
                (você pode colar <strong>várias imagens</strong> se o pedido tiver mais páginas), selecione da galeria ou importe um PDF.
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

            {/* MULTI-PAGE STAGED IMAGES PREVIEW GALLERY (Shown when user pastes Ctrl+V or selects photos) */}
            {stagedImages.length > 0 && (
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 text-left space-y-4 shadow-xl border border-slate-800 max-w-4xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Pré-visualização das Páginas do Pedido
                    </span>
                    <h4 className="text-sm font-black text-white">
                      {stagedImages.length} Página(s) / Fotografia(s) Inserida(s)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-emerald-300">Ctrl + V</kbd> novamente ou clique em "+ Adicionar Página" para incluir mais folhas deste mesmo pedido.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStagedImages([])}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-950/50 transition-colors"
                  >
                    Limpar Todas
                  </button>
                </div>

                {/* Grid of Staged Page Images */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {stagedImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative group bg-slate-950 border-2 border-slate-700 hover:border-emerald-500 rounded-xl overflow-hidden shadow-md transition-all"
                    >
                      <div className="bg-slate-800/90 px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-emerald-300 border-b border-slate-700">
                        <span>Página {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedImage(idx)}
                          className="text-slate-400 hover:text-rose-400 p-0.5 rounded"
                          title="Remover esta página"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div
                        onClick={() => setZoomedImageUrl(imgUrl)}
                        className="relative h-36 w-full cursor-pointer overflow-hidden flex items-center justify-center bg-slate-950"
                      >
                        <img
                          src={imgUrl}
                          alt={`Página ${idx + 1} do pedido`}
                          className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                            <ZoomIn className="w-3 h-3 text-emerald-400" />
                            Ampliar
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add More Page Tile */}
                  <label className="border-2 border-dashed border-slate-700 hover:border-emerald-400 rounded-xl h-full min-h-[168px] flex flex-col items-center justify-center gap-1.5 p-3 cursor-pointer text-slate-400 hover:text-emerald-300 hover:bg-slate-800/40 transition-all text-center">
                    <Plus className="w-6 h-6 text-emerald-400" />
                    <span className="text-xs font-bold">
                      + Adicionar Mais Páginas
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Ou pressione Ctrl + V
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Confirm & Import Multi-Page Order Button */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>+ Fotografar Outra Página</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleImportStagedImages}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
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

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all">
                <Upload className="w-4 h-4" />
                <span>Importar PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>

              <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all">
                <ImageIcon className="w-4 h-4" />
                <span>Selecionar Fotografia(s) (1 ou + Páginas)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
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
              Você ainda não enviou pedidos hoje. Cole a foto do pedido com Ctrl+V ou importe um PDF para começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sellerOrders.map((order) => {
              const ordersAhead = OrderStore.getOrdersAhead(order, allOrders);
              const pageImages =
                order.fileDataUrls && order.fileDataUrls.length > 0
                  ? order.fileDataUrls
                  : order.fileDataUrl && order.fileType === 'image'
                  ? [order.fileDataUrl]
                  : [];

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
                        {pageImages.length > 0 && (
                          <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <ImageIcon className="w-3 h-3 text-emerald-600" />
                            {pageImages.length} página(s) anexada(s)
                          </span>
                        )}
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

                  {/* Thumbnail strip if order has attached photos (Ctrl+V / Camera / Gallery) */}
                  {pageImages.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center gap-2.5 overflow-x-auto">
                      <span className="text-[11px] font-bold text-slate-500 shrink-0 pl-1">
                        Fotos do Pedido:
                      </span>
                      {pageImages.map((imgUrl, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setZoomedImageUrl(imgUrl)}
                          className="relative group h-14 w-16 rounded-lg overflow-hidden border border-slate-300 hover:border-emerald-500 bg-slate-900 shrink-0"
                          title={`Ampliar Página ${pIdx + 1}`}
                        >
                          <img
                            src={imgUrl}
                            alt={`Página ${pIdx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] font-bold text-center py-0.2">
                            Pág. {pIdx + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Extracted Items Table Preview (SKU, Produto, Quantidade, Validade, Fornecedor, Valor) */}
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
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
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
                              className="grid grid-cols-12 px-3 py-2 text-xs items-center hover:bg-slate-50"
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

      {/* Fullscreen Image Zoom Lightbox */}
      {zoomedImageUrl && (
        <div
          onClick={() => setZoomedImageUrl(null)}
          className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl p-3 flex flex-col items-center"
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-white text-xs font-bold px-2">
              <span>Visualização da Fotografia do Pedido</span>
              <button
                type="button"
                onClick={() => setZoomedImageUrl(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomedImageUrl}
              alt="Fotografia Ampliada"
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Camera Modal — adds captured photo to stagedImages so user can see it and add more pages if needed */}
      {showCamera && (
        <CameraCapture
          onCapture={async (base64) => {
            setShowCamera(false);
            const crisp = await compressImageDataUrl(base64, 2200, 0.92);
            setStagedImages((prev) => [...prev, crisp]);
            setPastedImageInfo(
              'Fotografia capturada! Você pode tirar foto de mais páginas ou clicar em "Processar e Importar Pedido".'
            );
            setTimeout(() => setPastedImageInfo(null), 4500);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
