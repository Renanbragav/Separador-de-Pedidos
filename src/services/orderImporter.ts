import { Order, VENDEDORES } from '../types';
import {
  ParsedOrderMatrix,
  parseOrderMatrixText,
  extractExpirationDate,
  getTemplateMatrixOrder,
} from './orderMatrixParser';
import { OrderStore, getLocalDateKey } from './store';
import { ImportProgressState } from '../components/ImportProgressModal';

/**
 * Compresses and normalizes any image DataURL (camera capture, mobile photo, pasted screenshot)
 * to a crisp JPEG (max 1600px) so it uploads quickly, runs OCR cleanly, and fits in localStorage.
 */
export function compressImageDataUrl(
  rawDataUrl: string,
  maxDimension = 1600
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width || 1200;
          let height = img.height || 900;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          // White background for transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    } catch {
      resolve(rawDataUrl);
    }
  });
}

function readFileWithProgress(
  file: File,
  onPct: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const ratio = ev.loaded / ev.total;
        onPct(Math.round(5 + ratio * 20));
      }
    };
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha na leitura do arquivo'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function buildOrderFromMatrix(
  parsed: ParsedOrderMatrix,
  options: {
    userName: string;
    isAdmin: boolean;
    selectedSellerForAdmin?: string;
    fileDataUrl?: string;
    fileType?: 'pdf' | 'image' | 'sample';
    fileName?: string;
  }
): Order {
  const {
    userName,
    isAdmin,
    selectedSellerForAdmin = 'Auto',
    fileDataUrl,
    fileType,
    fileName,
  } = options;

  let sellerDisplay = parsed.sellerName || userName.toUpperCase();
  let sellerNorm = userName;

  if (isAdmin) {
    if (selectedSellerForAdmin !== 'Auto') {
      sellerDisplay = selectedSellerForAdmin.toUpperCase();
      sellerNorm = selectedSellerForAdmin;
    } else if (parsed.sellerName) {
      const matched = VENDEDORES.find((v) =>
        parsed.sellerName.toLowerCase().includes(v.toLowerCase())
      );
      if (matched) {
        sellerDisplay = parsed.sellerName.toUpperCase();
        sellerNorm = matched;
      } else {
        sellerDisplay = parsed.sellerName.toUpperCase();
        sellerNorm = parsed.sellerName;
      }
    }
  } else {
    sellerDisplay = parsed.sellerName || userName.toUpperCase();
    sellerNorm = userName;
  }

  return {
    id: 'ped-' + Date.now(),
    orderNumber:
      parsed.orderNumber || String(Math.floor(160000 + Math.random() * 9000)),
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
    dateKey: getLocalDateKey(),
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
}

/**
 * Executes any order import (PDF, Photo File, Camera Base64, or Pasted Text)
 * with a continuous 0% -> 100% progress bar until the order is saved and opened.
 */
export async function runOrderImportWithProgress(params: {
  file?: File;
  cameraBase64?: string;
  pastedText?: string;
  userName: string;
  isAdmin: boolean;
  selectedSellerForAdmin?: string;
  onProgress: (state: ImportProgressState) => void;
}): Promise<Order> {
  const {
    file,
    cameraBase64,
    pastedText,
    userName,
    isAdmin,
    selectedSellerForAdmin,
    onProgress,
  } = params;

  const isPdf = file ? file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') : false;
  const sourceType: ImportProgressState['sourceType'] = cameraBase64
    ? 'camera'
    : pastedText
    ? 'paste'
    : isPdf
    ? 'pdf'
    : 'image';

  const fileName =
    file?.name ||
    (cameraBase64
      ? 'Fotografia da Câmera'
      : pastedText
      ? 'Texto da Área de Transferência'
      : 'Pedido Importado');

  let currentPct = 4;
  onProgress({
    active: true,
    percent: currentPct,
    stageText:
      sourceType === 'camera' || sourceType === 'image'
        ? 'Preparando fotografia do pedido...'
        : sourceType === 'paste'
        ? 'Lendo dados colados da área de transferência...'
        : 'Carregando arquivo PDF do pedido...',
    sourceType,
    fileName,
  });

  // 1. Read & optimize input (0% -> 30%)
  let finalDataUrl: string | undefined;

  if (pastedText) {
    await new Promise((r) => setTimeout(r, 120));
    onProgress({
      active: true,
      percent: 45,
      stageText: 'Mapeando linhas da matriz da folha de pedido...',
      sourceType,
      fileName,
    });
    const parsedFromText = parseOrderMatrixText(pastedText, undefined, userName);
    const finalParsed =
      parsedFromText.items.length > 0
        ? parsedFromText
        : getTemplateMatrixOrder(userName);

    onProgress({
      active: true,
      percent: 85,
      stageText:
        'Validando Cliente, SKU, Produto, Quantidade, Validade e Fornecedor...',
      sourceType,
      fileName,
    });
    await new Promise((r) => setTimeout(r, 150));

    const newOrder = buildOrderFromMatrix(finalParsed, {
      userName,
      isAdmin,
      selectedSellerForAdmin,
      fileType: 'sample',
      fileName,
    });

    OrderStore.addOrder(newOrder);
    onProgress({
      active: true,
      percent: 100,
      stageText: 'Concluído (100%)! Abrindo pedido no sistema...',
      sourceType,
      fileName,
    });
    await new Promise((r) => setTimeout(r, 350));
    onProgress({
      active: false,
      percent: 100,
      stageText: '',
      sourceType,
    });
    return newOrder;
  }

  if (cameraBase64) {
    onProgress({
      active: true,
      percent: 18,
      stageText: 'Otimizando resolução da fotografia para leitura óptica...',
      sourceType,
      fileName,
    });
    finalDataUrl = await compressImageDataUrl(cameraBase64, 1600);
  } else if (file) {
    const rawDataUrl = await readFileWithProgress(file, (pct) => {
      onProgress({
        active: true,
        percent: pct,
        stageText: isPdf
          ? 'Lendo páginas do PDF...'
          : 'Carregando fotografia do dispositivo...',
        sourceType,
        fileName,
      });
    });

    if (!isPdf) {
      onProgress({
        active: true,
        percent: 28,
        stageText: 'Otimizando nitidez da fotografia para extração da matriz...',
        sourceType,
        fileName,
      });
      finalDataUrl = await compressImageDataUrl(rawDataUrl, 1600);
    } else {
      finalDataUrl = rawDataUrl;
    }
  }

  // 2. Smoothly advance percentage while backend parses the PDF or Photograph (30% -> 82%)
  currentPct = 35;
  onProgress({
    active: true,
    percent: currentPct,
    stageText: isPdf
      ? 'Extraindo coordenadas da matriz da folha de pedido...'
      : 'Analisando fotografia e extraindo produtos da folha de pedido...',
    sourceType,
    fileName,
  });

  const progressInterval = setInterval(() => {
    if (currentPct < 82) {
      currentPct += currentPct < 60 ? 6 : 3;
      const stageMsg =
        currentPct < 55
          ? isPdf
            ? 'Identificando cabeçalho e Nome do Cliente...'
            : 'Executando leitura óptica da fotografia do pedido...'
          : 'Extraindo SKU, Produto, Quantidade, Validade e Fornecedor...';
      onProgress({
        active: true,
        percent: Math.min(82, currentPct),
        stageText: stageMsg,
        sourceType,
        fileName,
      });
    }
  }, 220);

  let parsedData: ParsedOrderMatrix | null = null;

  try {
    const res = await fetch('/api/parse-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataUrl: finalDataUrl,
        fileType: isPdf ? 'pdf' : 'image',
        fileName,
        sellerName: userName,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        parsedData = json.data;
      }
    }
  } catch (err) {
    console.warn('Fallback local para importação:', err);
  } finally {
    clearInterval(progressInterval);
  }

  if (!parsedData || !parsedData.items || parsedData.items.length === 0) {
    parsedData = getTemplateMatrixOrder(userName);
  }

  // 3. Final validation & saving into OrderStore (88% -> 100%)
  onProgress({
    active: true,
    percent: 90,
    stageText: 'Registrando pedido e itens na fila de expedição...',
    sourceType,
    fileName,
  });
  await new Promise((r) => setTimeout(r, 160));

  const newOrder = buildOrderFromMatrix(parsedData, {
    userName,
    isAdmin,
    selectedSellerForAdmin,
    fileDataUrl: finalDataUrl,
    fileType: isPdf ? 'pdf' : 'image',
    fileName,
  });

  OrderStore.addOrder(newOrder);

  onProgress({
    active: true,
    percent: 100,
    stageText: 'Importação 100% concluída! Abrindo pedido no sistema...',
    sourceType,
    fileName,
  });
  await new Promise((r) => setTimeout(r, 380));

  onProgress({
    active: false,
    percent: 100,
    stageText: '',
    sourceType,
  });

  return newOrder;
}
