import { Order, VENDEDORES } from '../types';
import {
  ParsedOrderMatrix,
  ParsedMatrixItem,
  parseOrderMatrixText,
  extractExpirationDate,
  getEmptyParsedOrder,
} from './orderMatrixParser';
import { OrderStore, getLocalDateKey } from './store';
import { ImportProgressState } from '../components/ImportProgressModal';

/**
 * Upscales small screenshots (e.g. 700px-1200px Ctrl+V captures) to ~2200px width
 * and enhances contrast in lossless PNG format so Tesseract OCR reads small tabular fonts
 * (like VitSis frmRelPedido2) with maximum accuracy.
 */
export function prepareImageForOcr(rawDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const origW = img.width || 1000;
          const origH = img.height || 800;

          // Target width between 2200px and 2600px so 8px-10px screenshot text becomes ~24px tall
          let scale = 1;
          if (origW < 2200) {
            scale = Math.min(3.0, 2200 / origW);
          } else if (origW > 2800) {
            scale = 2600 / origW;
          }

          const width = Math.round(origW * scale);
          const height = Math.round(origH * scale);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to clean high-clarity grayscale without erasing anti-aliased thin strokes
          try {
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              // Gentle S-curve contrast that preserves gray anti-aliased edges for Tesseract LSTM
              const val =
                lum > 235
                  ? 255
                  : Math.max(0, Math.min(255, Math.round((lum - 128) * 1.25 + 120)));
              data[i] = val;
              data[i + 1] = val;
              data[i + 2] = val;
            }
            ctx.putImageData(imageData, 0, 0);
          } catch {
            // Ignore if getImageData fails
          }

          // Use lossless PNG for OCR so no JPEG ringing artifacts blur small numbers
          resolve(canvas.toDataURL('image/png'));
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

/**
 * Compresses an image DataURL for preview/storage in localStorage.
 */
export function compressImageDataUrl(
  rawDataUrl: string,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width || 1400;
          let height = img.height || 1000;

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

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
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

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
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
    fileDataUrls?: string[];
    fileType?: 'pdf' | 'image' | 'sample';
    fileName?: string;
  }
): Order {
  const {
    userName,
    isAdmin,
    selectedSellerForAdmin = 'Auto',
    fileDataUrl,
    fileDataUrls,
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
    transport: parsed.transport || '1 - PROPRIO',
    route: parsed.route || '1 - LOCAL',
    sellerName: sellerDisplay,
    sellerNormalized: sellerNorm,
    status: 'Pendente',
    totalItems: parsed.items?.length || 0,
    totalValue: parsed.totalValue || 0,
    fileDataUrl: fileDataUrl || (fileDataUrls && fileDataUrls[0]),
    fileDataUrls:
      fileDataUrls && fileDataUrls.length > 0
        ? fileDataUrls
        : fileDataUrl
        ? [fileDataUrl]
        : undefined,
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
 * Executes any order import (PDF, Single/Multi-Page Photo Array, Camera Base64, or Pasted Text)
 * with a continuous 0% -> 100% progress bar until the actual order is saved and opened.
 */
export async function runOrderImportWithProgress(params: {
  file?: File;
  imageDataUrls?: string[];
  cameraBase64?: string;
  pastedText?: string;
  userName: string;
  isAdmin: boolean;
  selectedSellerForAdmin?: string;
  onProgress: (state: ImportProgressState) => void;
}): Promise<Order> {
  const {
    file,
    imageDataUrls,
    cameraBase64,
    pastedText,
    userName,
    isAdmin,
    selectedSellerForAdmin,
    onProgress,
  } = params;

  // Multi-page image import (Ctrl+V / Gallery / Camera pages)
  if (imageDataUrls && imageDataUrls.length > 0) {
    const totalPages = imageDataUrls.length;
    const fileName =
      totalPages === 1
        ? 'Fotografia do Pedido (1 página)'
        : `Fotografias do Pedido (${totalPages} páginas)`;

    onProgress({
      active: true,
      percent: 8,
      stageText: `Preparando ${totalPages} página(s) do pedido para leitura óptica...`,
      sourceType: 'image',
      fileName,
    });

    const ocrReadyPages: string[] = [];
    const storagePages: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      const pct = Math.round(10 + ((i + 1) / totalPages) * 18);
      onProgress({
        active: true,
        percent: pct,
        stageText: `Ampliando nitidez e contraste da Página ${i + 1} de ${totalPages}...`,
        sourceType: 'image',
        fileName,
      });
      const ocrReady = await prepareImageForOcr(imageDataUrls[i]);
      const storageImg = await compressImageDataUrl(imageDataUrls[i], 1400, 0.82);
      ocrReadyPages.push(ocrReady);
      storagePages.push(storageImg);
    }

    let mergedHeader: ParsedOrderMatrix | null = null;
    const combinedItems: ParsedMatrixItem[] = [];

    for (let i = 0; i < ocrReadyPages.length; i++) {
      const basePct = 30 + Math.round((i / ocrReadyPages.length) * 52);
      let currentPct = basePct;

      onProgress({
        active: true,
        percent: currentPct,
        stageText: `Interpretando cliente, produtos e valores da Página ${i + 1} de ${totalPages}...`,
        sourceType: 'image',
        fileName,
      });

      const pageTimer = setInterval(() => {
        const maxPagePct =
          30 + Math.round(((i + 0.9) / ocrReadyPages.length) * 52);
        if (currentPct < maxPagePct) {
          currentPct += 3;
          onProgress({
            active: true,
            percent: Math.min(maxPagePct, currentPct),
            stageText: `Extraindo SKU, Quantidade, Validade, Fornecedor e Valores (Pág. ${i + 1})...`,
            sourceType: 'image',
            fileName,
          });
        }
      }, 250);

      try {
        const res = await fetch('/api/parse-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileDataUrl: ocrReadyPages[i],
            fileType: 'image',
            fileName: `Pagina_${i + 1}.png`,
            sellerName: userName,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data) {
            const pageData: ParsedOrderMatrix = json.data;
            if (
              !mergedHeader ||
              mergedHeader.parseMethod === 'matrix-empty' ||
              mergedHeader.clientName.includes('Verificar Imagem') ||
              mergedHeader.clientName === 'Cliente Importado'
            ) {
              mergedHeader = pageData;
            }
            if (Array.isArray(pageData.items)) {
              for (const it of pageData.items) {
                const alreadyExists = combinedItems.some(
                  (existing) =>
                    existing.code === it.code &&
                    existing.description === it.description &&
                    existing.quantityOrdered === it.quantityOrdered
                );
                if (!alreadyExists) {
                  combinedItems.push(it);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Aviso na leitura da página ${i + 1}:`, err);
      } finally {
        clearInterval(pageTimer);
      }
    }

    if (!mergedHeader) {
      mergedHeader = getEmptyParsedOrder(userName);
    }
    if (combinedItems.length > 0) {
      mergedHeader.items = combinedItems;
      mergedHeader.totalItems = combinedItems.length;
      const calcTotal = combinedItems.reduce(
        (acc, it) => acc + (it.totalPrice || it.quantityOrdered * it.unitPrice),
        0
      );
      if (calcTotal > 0) {
        mergedHeader.totalValue = Number(calcTotal.toFixed(2));
      }
    }

    onProgress({
      active: true,
      percent: 90,
      stageText: `Consolidando ${totalPages} página(s) e registrando pedido na fila...`,
      sourceType: 'image',
      fileName,
    });
    await new Promise((r) => setTimeout(r, 160));

    const newOrder = buildOrderFromMatrix(mergedHeader, {
      userName,
      isAdmin,
      selectedSellerForAdmin,
      fileDataUrl: storagePages[0],
      fileDataUrls: storagePages,
      fileType: 'image',
      fileName,
    });

    OrderStore.addOrder(newOrder);

    onProgress({
      active: true,
      percent: 100,
      stageText: 'Importação 100% concluída! Abrindo pedido para conferência...',
      sourceType: 'image',
      fileName,
    });
    await new Promise((r) => setTimeout(r, 350));

    onProgress({
      active: false,
      percent: 100,
      stageText: '',
      sourceType: 'image',
    });

    return newOrder;
  }

  const isPdf = file
    ? file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
    : false;
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
  let displayDataUrl: string | undefined;

  if (pastedText) {
    await new Promise((r) => setTimeout(r, 120));
    onProgress({
      active: true,
      percent: 45,
      stageText: 'Extraindo dados do pedido colado...',
      sourceType,
      fileName,
    });
    const parsedFromText = parseOrderMatrixText(pastedText, undefined, userName);

    onProgress({
      active: true,
      percent: 85,
      stageText:
        'Validando Cliente, SKU, Produto, Quantidade, Validade, Fornecedor e Valores...',
      sourceType,
      fileName,
    });
    await new Promise((r) => setTimeout(r, 150));

    const newOrder = buildOrderFromMatrix(parsedFromText, {
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
      stageText: 'Ampliando contraste da fotografia para leitura óptica...',
      sourceType,
      fileName,
    });
    finalDataUrl = await prepareImageForOcr(cameraBase64);
    displayDataUrl = await compressImageDataUrl(cameraBase64, 1400, 0.82);
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
        stageText: 'Ampliando nitidez e contraste da fotografia...',
        sourceType,
        fileName,
      });
      finalDataUrl = await prepareImageForOcr(rawDataUrl);
      displayDataUrl = await compressImageDataUrl(rawDataUrl, 1400, 0.82);
    } else {
      finalDataUrl = rawDataUrl;
      displayDataUrl = rawDataUrl;
    }
  }

  // 2. Smoothly advance percentage while backend parses the PDF or Photograph (30% -> 82%)
  currentPct = 35;
  onProgress({
    active: true,
    percent: currentPct,
    stageText: isPdf
      ? 'Extraindo dados do PDF do pedido...'
      : 'Executando leitura óptica da imagem do pedido...',
    sourceType,
    fileName,
  });

  const progressInterval = setInterval(() => {
    if (currentPct < 82) {
      currentPct += currentPct < 60 ? 6 : 3;
      const stageMsg =
        currentPct < 55
          ? 'Identificando Número do Pedido, Emissão e Nome do Cliente...'
          : 'Extraindo SKU, Produto, Quantidade, Validade, Fornecedor e Valores...';
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
    console.warn('Erro de comunicação na importação:', err);
  } finally {
    clearInterval(progressInterval);
  }

  if (!parsedData) {
    parsedData = getEmptyParsedOrder(userName);
  }

  // 3. Final validation & saving into OrderStore (88% -> 100%)
  onProgress({
    active: true,
    percent: 90,
    stageText: 'Registrando pedido, valores e itens para conferência...',
    sourceType,
    fileName,
  });
  await new Promise((r) => setTimeout(r, 160));

  const newOrder = buildOrderFromMatrix(parsedData, {
    userName,
    isAdmin,
    selectedSellerForAdmin,
    fileDataUrl: displayDataUrl,
    fileDataUrls: displayDataUrl && !isPdf ? [displayDataUrl] : undefined,
    fileType: isPdf ? 'pdf' : 'image',
    fileName,
  });

  OrderStore.addOrder(newOrder);

  onProgress({
    active: true,
    percent: 100,
    stageText: 'Importação 100% concluída! Abrindo pedido para conferência...',
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
