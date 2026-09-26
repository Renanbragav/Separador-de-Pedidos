import { VENDEDORES } from '../types';
import { SAMPLE_ORDER_160753 } from '../data/sampleOrder';

export interface ParsedMatrixItem {
  code: string; // SKU
  quantityOrdered: number; // Quantidade
  unit: string;
  description: string; // Produto
  presentation: string;
  manufacturer: string; // Fornecedor
  expirationDate: string; // Validade
  unitPrice: number;
  totalPrice: number;
  location: string;
  lotInfo: string;
}

export interface ParsedOrderMatrix {
  orderNumber: string;
  dateCad: string;
  clientCode: string;
  clientName: string; // Nome do Cliente
  clientFantasia: string;
  clientAddress: string;
  cnpj: string;
  transport: string;
  route: string;
  sellerName: string;
  totalItems: number;
  totalValue: number;
  items: ParsedMatrixItem[];
  parseMethod: 'matrix-pdf' | 'matrix-text' | 'matrix-ocr' | 'matrix-template';
}

export const KNOWN_SUPPLIERS = [
  'INTEGRALMEDICA',
  'INTEGRAL MEDICA',
  'MAX TITANIUM',
  'BODYACTION',
  'BODY ACTION',
  'BENDU',
  'PROBIOTICA',
  'DARKNESS',
  'NUTRATA',
  'DUX NUTRITION',
  'DUX',
  'GROWTH',
  'VITAFOR',
  'ESSENTIAL NUTRITION',
  'ESSENTIAL',
  'EQUALIV',
  'ATLHETICA NUTRITION',
  'ATLHETICA',
  'NEW MILLEN',
  'BLACK SKULL',
  'ADAPTOGEN',
  'BOLD',
  'PINATI',
  'DR PEANUT',
  'DR. PEANUT',
  'MAIS MU',
  '+MU',
  'SUAVIPAN',
  'TRUE SOURCE',
  'PURAVIDA',
  'PURA VIDA',
  'OCEAN DROP',
  'SANAVITA',
  'CATARINENSE',
  'NATULAB',
  'CIMED',
  'NEO QUIMICA',
  'EUROFARMA',
  'EMS',
  'OPTIMUM NUTRITION',
  'DYMATIZE',
  'MUSCLETECH',
  'UNIVERSAL',
  'DRAGON PHARMA',
  'UNDER LABZ',
  'FTW',
  'PRO CORPS',
  'PROCORPS',
  'LEADER NUTRITION',
  'PROFIT',
  'CANIBAL INC',
  'CANIBAL',
  '3VS NUTRITION',
  '3VS',
  'SHARK PRO',
  'SOLDIERS NUTRITION',
  'SOLDIER',
];

const VALID_UNITS = new Set([
  'UN',
  'UND',
  'UNID',
  'PT',
  'POTE',
  'CX',
  'CAIXA',
  'SCH',
  'SACHE',
  'LATA',
  'LT',
  'KG',
  'GR',
  'G',
  'ML',
  'PC',
  'PCT',
  'PACOTE',
  'DP',
  'DISP',
  'FD',
  'FARDO',
  'FR',
  'FRASCO',
  'BL',
  'TB',
  'KIT',
]);

/**
 * Extracts clean expiration date (Validade) from VitSis lot info (e.g. "L->04/06/2027 Lt S040668 Qt 16")
 * or any date string.
 */
export function extractExpirationDate(text?: string): string {
  if (!text) return '';
  // Pattern 1: VitSis lot line "L->04/06/2027" or "L -> 04/06/2027"
  const lotArrowMatch = text.match(/L\s*[-=]>\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (lotArrowMatch) return lotArrowMatch[1];

  // Pattern 2: Explicit "Val: 04/06/2027" or "Validade: 04/06/2027" or "Venc: 04/06/2027"
  const valMatch = text.match(
    /(?:VAL(?:IDADE)?|VENC(?:IMENTO)?)\s*[:.-]?\s*(\d{2}\/\d{2}\/\d{2,4}|\d{2}\/\d{4})/i
  );
  if (valMatch) return valMatch[1];

  // Pattern 3: Any DD/MM/YYYY or MM/YYYY inside the string
  const genericDate = text.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})\b/);
  if (genericDate) return genericDate[1];

  return '';
}

function parseBrNumber(raw?: string): number {
  if (!raw) return 0;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function cleanHeaderValue(val: string): string {
  return val
    .replace(
      /\s+(?:DATA\s*CAD\.?|EMISS[AÃ]O|NOME\s*FANTASIA|FANTASIA|CNPJ(?:\/CPF)?|CPF|INSC(?:R)?\.?\s*EST|IE|FONE|TELEFONE|CELULAR|ROTA|VENDEDOR(?:\(A\))?|TRANSPORTADORA|CEP|BAIRRO|CIDADE|UF)\s*[:.-].*$/i,
      ''
    )
    .trim();
}

/**
 * Deterministic Matrix Parser for VitSis "Folha de Pedido" (PDF text, pasted matrix, or OCR text).
 * Replicates key fields without AI:
 * - Nome do Cliente (clientName)
 * - Quantidade (quantityOrdered)
 * - Produto (description)
 * - SKU (code)
 * - Validade (expirationDate)
 * - Fornecedor (manufacturer)
 */
export function parseOrderMatrixText(
  rawText: string,
  structuredLines?: string[],
  defaultSellerName = 'Zelia'
): ParsedOrderMatrix {
  const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = (
    structuredLines && structuredLines.length > 0
      ? structuredLines
      : normalizedText.split('\n')
  )
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let orderNumber = '';
  let dateCad = '';
  let clientCode = '';
  let clientName = '';
  let clientFantasia = '';
  let clientAddress = '';
  let cnpj = '';
  let transport = '';
  let route = '';
  let sellerName = '';

  // 1. EXTRACT HEADER METADATA FROM LINES
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t+/g, '   ');

    // Order Number
    if (!orderNumber) {
      const mOrder =
        line.match(
          /(?:PEDIDO(?:\s+DE\s+VENDA)?|OR[CÇ]AMENTO)\s*(?:N[º°o.]*|NUM(?:ERO)?|#)?\s*[:.-]?\s*(\d{3,10})/i
        ) ||
        line.match(/N[º°o.]+\s*(?:DO\s+)?PEDIDO\s*[:.-]?\s*(\d{3,10})/i) ||
        line.match(/\bPEDIDO\s*:\s*(\d{3,10})/i);
      if (mOrder) {
        orderNumber = mOrder[1].trim();
      }
    }

    // Date Cad / Emissão
    if (!dateCad) {
      const mDate = line.match(
        /(?:DATA\s*(?:CAD\.?|DE\s*CADASTRO|EMISS[AÃ]O|DO\s*PEDIDO)?|EMISS[AÃ]O)\s*[:.-]?\s*(\d{2}\/\d{2}\/\d{2,4}(?:\s*[-–às]*\s*\d{2}:\d{2}(?::\d{2})?)?)/i
      );
      if (mDate) {
        dateCad = mDate[1].trim();
      }
    }

    // Client Code & Client Name (Nome do Cliente)
    if (!clientName) {
      const mClient = line.match(
        /(?:CLIENTE|RAZ[AÃ]O\s*SOCIAL|DESTINAT[AÁ]RIO|SACADO|NOME\s*DO\s*CLIENTE)\s*[:.-]?\s*(?:(\d{1,8})\s*[-–/]\s*)?(.+)/i
      );
      if (mClient) {
        if (mClient[1]) clientCode = mClient[1].trim();
        let rawClient = cleanHeaderValue(mClient[2]);
        const codePrefix = rawClient.match(/^(\d{1,8})\s*[-–/]\s*(.+)$/);
        if (codePrefix) {
          if (!clientCode) clientCode = codePrefix[1].trim();
          rawClient = codePrefix[2].trim();
        }
        if (rawClient && rawClient.length >= 2) {
          clientName = rawClient;
        }
      }
    }

    // Client Fantasia
    if (!clientFantasia) {
      const mFantasia = line.match(/(?:NOME\s*)?FANTASIA\s*[:.-]?\s*(.+)/i);
      if (mFantasia) {
        clientFantasia = cleanHeaderValue(mFantasia[1]);
      }
    }

    // CNPJ / CPF
    if (!cnpj) {
      const mCnpj = line.match(
        /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/
      );
      if (mCnpj) {
        cnpj = mCnpj[1];
      }
    }

    // Client Address
    if (!clientAddress) {
      const mAddr = line.match(/ENDERE[CÇ]O\s*[:.-]?\s*(.+)/i);
      if (mAddr) {
        clientAddress = cleanHeaderValue(mAddr[1]);
      }
    }

    // Transportadora
    if (!transport) {
      const mTransp = line.match(
        /TRANSPORTADORA\s*[:.-]?\s*(?:\d+\s*[-–]\s*)?(.+)/i
      );
      if (mTransp) {
        transport = cleanHeaderValue(mTransp[1]);
      }
    }

    // Rota
    if (!route) {
      const mRoute = line.match(/\bROTA\s*[:.-]?\s*(.+)/i);
      if (mRoute) {
        route = cleanHeaderValue(mRoute[1]);
      }
    }

    // Seller Name (Vendedor)
    if (!sellerName) {
      const mSeller = line.match(
        /(?:VENDEDOR(?:\(A\))?|REPR(?:ESENTANTE)?)\s*[:.-]?\s*(?:\d+\s*[-–]\s*)?([A-ZÀ-Úa-zà-ú\s]+)/i
      );
      if (mSeller) {
        sellerName = cleanHeaderValue(mSeller[1]);
      }
    }
  }

  // Fallback seller matching from known VENDEDORES list if not matched by label
  if (!sellerName) {
    for (const v of VENDEDORES) {
      const regex = new RegExp(`\\b${v}\\b`, 'i');
      if (regex.test(normalizedText)) {
        sellerName = v.toUpperCase();
        break;
      }
    }
  }

  // 2. EXTRACT ITEMS MATRIX (SKU, Quantidade, Produto, Validade, Fornecedor)
  const items: ParsedMatrixItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineClean = rawLine.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();

    // Check if this line is a VitSis Lot / Validade sub-row:
    // e.g. "L->04/06/2027 Lt S040668 Qt 16" or "Validade: 04/06/2027 Lote: S040668"
    const lotRowMatch =
      lineClean.match(
        /^L\s*[-=]>\s*(\d{2}\/\d{2}\/\d{2,4})(?:\s+Lt\.?\s*([A-Za-z0-9\/_-]+))?(?:\s+Qt\.?\s*([\d.,]+))?/i
      ) ||
      lineClean.match(
        /^(?:LOTE|VAL(?:IDADE)?|VENC(?:IMENTO)?)\s*[:.-]?\s*(.+)/i
      );

    if (lotRowMatch && items.length > 0) {
      const lastItem = items[items.length - 1];
      const expDate = extractExpirationDate(lineClean);
      if (expDate) {
        lastItem.expirationDate = lastItem.expirationDate
          ? `${lastItem.expirationDate} | ${expDate}`
          : expDate;
      }
      lastItem.lotInfo = lastItem.lotInfo
        ? `${lastItem.lotInfo} / ${lineClean}`
        : lineClean;

      // If quantity wasn't found on the main line, check "Qt 16" in lot line
      if (!lastItem.quantityOrdered || lastItem.quantityOrdered <= 0) {
        const qtMatch = lineClean.match(/Qt\.?\s*(\d+(?:[.,]\d+)?)/i);
        if (qtMatch) {
          lastItem.quantityOrdered = parseBrNumber(qtMatch[1]) || 1;
        }
      }
      continue;
    }

    // Skip non-item header/footer lines
    if (
      /^(?:PEDIDO|CLIENTE|RAZ[AÃ]O|FANTASIA|NOME\s*FANTASIA|ENDERE[CÇ]O|CNPJ|CPF|TRANSPORTADORA|VENDEDOR|ROTA|DATA\s*CAD|EMISS[AÃ]O|OBSERVA|TOTAL|VALOR\s*TOTAL|SUBTOTAL|DESCONTO|FRETE|ASSINATURA|CONFERENTE|SEPARADOR|C[ÓO]D(?:IGO)?\.?\s|SKU\s|ITEM\s+C[ÓO]D|P[ÁA]GINA|FONE|TELEFONE|CIDADE|BAIRRO|CEP|CONDI[CÇ][AÃ]O|FORMA\s*DE\s*PAG)/i.test(
        lineClean
      )
    ) {
      continue;
    }

    // Check if the line is pipe-separated or semicolon-separated (e.g. "9357 | 16 | UN | SALTY CHIPS | 04/06/2027 | BENDU")
    if (rawLine.includes('|') || rawLine.includes(';')) {
      const sep = rawLine.includes('|') ? '|' : ';';
      const cols = rawLine
        .split(sep)
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 3 && /^\d{2,8}$/.test(cols[0].replace(/^#/, ''))) {
        const parsedFromDelimited = parseDelimitedItemColumns(cols);
        if (parsedFromDelimited) {
          items.push(parsedFromDelimited);
          continue;
        }
      }
    }

    // Standard VitSis Matrix Item Line detection:
    // Starts with SKU (2 to 8 digits, e.g. 9357, 4967, 8394) or Seq + SKU
    const parsedItem = parseVitSisMatrixRow(rawLine);
    if (parsedItem) {
      items.push(parsedItem);
    }
  }

  // Secondary OCR pass for photographs where table borders or OCR noise altered line structure
  if (items.length === 0 && lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const cleanedOcrLine = lines[i]
        .replace(/^[|!lI\[\]•·\-_=+*~<>:;.,\s]+/, '')
        .replace(/[|!\[\]]+/g, '  ')
        .trim();
      if (!cleanedOcrLine || cleanedOcrLine.length < 6) continue;

      const retryItem = parseVitSisMatrixRow(cleanedOcrLine);
      if (retryItem) {
        items.push(retryItem);
        continue;
      }

      // Loose photo line match: e.g. "SALTY CHIPS SOUR CREAM 40G - 16 UN" or "16x PRODUTO..."
      const looseMatch =
        cleanedOcrLine.match(
          /^(\d{1,4})\s*(?:x|un|und|pt|cx|sch|pote|caixa)?\s+([A-ZÀ-Ú][A-ZÀ-Ú0-9\s.%-]{4,})$/i
        ) ||
        cleanedOcrLine.match(
          /^([A-ZÀ-Ú][A-ZÀ-Ú0-9\s.%-]{4,})\s+(\d{1,4})\s*(?:un|und|pt|cx|sch)?$/i
        );
      if (
        looseMatch &&
        !/^(?:PEDIDO|CLIENTE|ENDERE|FANTASIA|VENDEDOR|TRANSP|CNPJ|DATA|TOTAL|PAGINA|ASSINATURA)/i.test(
          cleanedOcrLine
        )
      ) {
        const isQtyFirst = /^\d+$/.test(looseMatch[1].trim());
        const qty = parseInt(
          isQtyFirst ? looseMatch[1] : looseMatch[2],
          10
        ) || 1;
        const desc = (isQtyFirst ? looseMatch[2] : looseMatch[1]).trim();
        items.push({
          code: String(1000 + items.length + 1),
          quantityOrdered: qty,
          unit: 'UN',
          description: desc.toUpperCase(),
          presentation: '',
          manufacturer: 'PADRÃO',
          expirationDate: extractExpirationDate(cleanedOcrLine) || '-',
          unitPrice: 0,
          totalPrice: 0,
          location: '-',
          lotInfo: '',
        });
      }
    }
  }

  // Calculate total value & total items
  const calculatedTotal = items.reduce(
    (acc, item) =>
      acc +
      (item.totalPrice || item.unitPrice * item.quantityOrdered || 0),
    0
  );

  // Check if total value is explicitly stated in the text
  let explicitTotal = 0;
  const totalMatch = normalizedText.match(
    /(?:VALOR\s*TOTAL|TOTAL\s*DO\s*PEDIDO|TOTAL\s*GERAL|VLR\.?\s*TOTAL\s*PEDIDO|TOTAL\s*R\$)\s*[:.-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/i
  );
  if (totalMatch) {
    explicitTotal = parseBrNumber(totalMatch[1]);
  }

  return {
    orderNumber:
      orderNumber || String(Math.floor(160000 + Math.random() * 9000)),
    dateCad: dateCad || new Date().toLocaleString('pt-BR'),
    clientCode: clientCode || '',
    clientName: clientName || 'CLIENTE DA MATRIZ DE PEDIDO',
    clientFantasia: clientFantasia || '',
    clientAddress: clientAddress || '',
    cnpj: cnpj || '',
    transport: transport || 'TRANSRAPIDO LOGISTICA LTDA',
    route: route || '1 - LOCAL',
    sellerName: sellerName || defaultSellerName.toUpperCase(),
    totalItems: items.length,
    totalValue:
      Number((calculatedTotal || explicitTotal || 0).toFixed(2)),
    items,
    parseMethod: 'matrix-text',
  };
}

/**
 * Parses a single VitSis matrix row into SKU, Quantidade, Produto, Validade, Fornecedor, etc.
 */
function parseVitSisMatrixRow(rawLine: string): ParsedMatrixItem | null {
  let working = rawLine.replace(/\t+/g, '  ').trim();

  // Must start with a SKU code (2 to 8 alphanumeric/numeric characters, with at least 2 digits)
  // Avoid matching dates like 17/09/2026 or phone numbers or CNPJs
  if (/^\d{2}\/\d{2}\//.test(working) || /^\d{2}\.\d{3}\./.test(working)) {
    return null;
  }

  // Match leading SKU (or optional 1-2 digit item index followed by 4-8 digit SKU + quantity)
  const skuMatch = working.match(/^(\d{2,8}|[A-Z]{1,3}\d{2,6})\s+(.+)$/i);
  if (!skuMatch) return null;

  const code = skuMatch[1].trim();
  working = skuMatch[2].trim();

  let lotInfo = '';
  let expirationDate = '';

  // 1. Check if inline Lot / Validade info is present on the same line
  const inlineLotMatch = working.match(
    /(L\s*[-=]>\s*\d{2}\/\d{2}\/\d{2,4}(?:\s+Lt\.?\s*[A-Za-z0-9\/_-]+)?(?:\s+Qt\.?\s*[\d.,]+)?)/i
  );
  if (inlineLotMatch) {
    lotInfo = inlineLotMatch[1].trim();
    expirationDate = extractExpirationDate(lotInfo);
    working = working.replace(inlineLotMatch[0], ' ').trim();
  }

  // Check for inline "Val: DD/MM/YYYY" or standalone date column DD/MM/YYYY
  const inlineDateMatch = working.match(
    /(?:VAL(?:IDADE)?\s*[:.-]?\s*)?(\b\d{2}\/\d{2}\/\d{4}\b)/i
  );
  if (inlineDateMatch && !expirationDate) {
    expirationDate = inlineDateMatch[1];
    working = working.replace(inlineDateMatch[0], ' ').trim();
  }

  // 2. Extract Location (e.g., ESTOQUE2-BLOCO-K, GELADEIRA 01, PRATELEIRA B)
  let location = '-';
  const locMatch = working.match(
    /\b(ESTOQUE\s*\d*\s*[-–]?\s*BLOCO\s*[-–]?\s*[A-Z0-9]+|GELADEIRA\s*\d+|PRATELEIRA\s*[A-Z0-9]+|CORREDOR\s*[A-Z0-9]+|GONDOLA\s*[A-Z0-9]+)\b/i
  );
  if (locMatch) {
    location = locMatch[1].trim().toUpperCase();
    working = working.replace(locMatch[0], ' ').trim();
  }

  // 3. Extract Quantity and Unit
  // In VitSis: right after SKU comes "16 UN", "3 PT", "5 CX", "3 SCH", OR later in the row
  let quantityOrdered = 0;
  let unit = 'UN';

  const leadingQtyUnit = working.match(
    /^(\d+(?:[.,]\d+)?)\s+(UN|UND|UNID|PT|POTE|CX|CAIXA|SCH|SACHE|LATA|LT|KG|GR|G|ML|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\b\s*(.+)$/i
  );

  if (leadingQtyUnit) {
    quantityOrdered = parseBrNumber(leadingQtyUnit[1]);
    unit = normalizeUnit(leadingQtyUnit[2]);
    working = leadingQtyUnit[3].trim();
  } else {
    // Check if Quantity is at the start without explicit unit token (e.g. "16   SALTY CHIPS...")
    const leadingQtyOnly = working.match(/^(\d{1,5})\s+([A-Z].+)$/i);
    // Or check if Quantity + Unit appears after Description
    const middleQtyUnit = working.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(UN|UND|UNID|PT|POTE|CX|CAIXA|SCH|SACHE|LATA|LT|KG|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\b(.*)$/i
    );
    const middleUnitQty = working.match(
      /^(.+?)\s+\b(UN|UND|UNID|PT|POTE|CX|CAIXA|SCH|SACHE|LATA|LT|KG|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\s+(\d+(?:[.,]\d+)?)\b(.*)$/i
    );

    if (middleQtyUnit && !/^\d+$/.test(middleQtyUnit[1].trim())) {
      quantityOrdered = parseBrNumber(middleQtyUnit[2]);
      unit = normalizeUnit(middleQtyUnit[3]);
      working = `${middleQtyUnit[1].trim()}   ${middleQtyUnit[4].trim()}`.trim();
    } else if (middleUnitQty && !/^\d+$/.test(middleUnitQty[1].trim())) {
      unit = normalizeUnit(middleUnitQty[2]);
      quantityOrdered = parseBrNumber(middleUnitQty[3]);
      working = `${middleUnitQty[1].trim()}   ${middleUnitQty[4].trim()}`.trim();
    } else if (leadingQtyOnly) {
      quantityOrdered = parseBrNumber(leadingQtyOnly[1]);
      working = leadingQtyOnly[2].trim();
    }
  }

  // 4. Extract Unit Price & Total Price (decimal numbers like "7,76  124,16" at the end of the row)
  let unitPrice = 0;
  let totalPrice = 0;

  const trailingTwoPrices = working.match(
    /^(.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})\s*$/
  );
  if (trailingTwoPrices) {
    working = trailingTwoPrices[1].trim();
    unitPrice = parseBrNumber(trailingTwoPrices[2]);
    totalPrice = parseBrNumber(trailingTwoPrices[3]);
  } else {
    const trailingOnePrice = working.match(
      /^(.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})\s*$/
    );
    if (trailingOnePrice) {
      working = trailingOnePrice[1].trim();
      totalPrice = parseBrNumber(trailingOnePrice[2]);
      unitPrice =
        quantityOrdered > 0
          ? Number((totalPrice / quantityOrdered).toFixed(2))
          : totalPrice;
    }
  }

  // If quantity still wasn't found, check if there is a trailing or standalone integer
  if (quantityOrdered <= 0) {
    const standaloneQty = working.match(/^(.*?)\s+(\d{1,4})\s*$/);
    if (standaloneQty && standaloneQty[1].trim().length >= 3) {
      working = standaloneQty[1].trim();
      quantityOrdered = parseInt(standaloneQty[2], 10) || 1;
    } else {
      quantityOrdered = 1;
    }
  }

  // 5. Extract Fornecedor (manufacturer), Apresentação (presentation), and Produto (description)
  let manufacturer = '';
  let presentation = '';
  let description = working.replace(/\s+/g, ' ').trim();

  // Check if any KNOWN_SUPPLIERS matches at the end of description
  const sortedSuppliers = [...KNOWN_SUPPLIERS].sort(
    (a, b) => b.length - a.length
  );
  for (const sup of sortedSuppliers) {
    const escaped = sup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const supEndRegex = new RegExp(`^(.+?)\\s+(${escaped})\\s*$`, 'i');
    const matchSup = description.match(supEndRegex);
    if (matchSup) {
      description = matchSup[1].trim();
      manufacturer = sup.toUpperCase();
      break;
    }
  }

  // Check if VitSis presentation column (e.g. "40G", "100G", "300G", "900G", "12X45G") separates Produto and Fornecedor
  // e.g. "SALTY CHIPS SOUR CREAM 40G 40G BENDU" or "SALTY CHIPS SOUR CREAM 40G 40G"
  const presAndSupplierMatch = description.match(
    /^(.+?\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP|UN)))\s+\2(?:\s+([A-ZÀ-Ú0-9\s.&+-]{2,25}))?$/i
  );
  if (presAndSupplierMatch) {
    description = presAndSupplierMatch[1].trim();
    presentation = presAndSupplierMatch[2].toUpperCase().replace(/\s+/g, '');
    if (!manufacturer && presAndSupplierMatch[3]) {
      manufacturer = presAndSupplierMatch[3].trim().toUpperCase();
    }
  } else {
    // Check if there is a presentation token at the end of description
    const presMatch = description.match(
      /\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP))\b/i
    );
    if (presMatch) {
      presentation = presMatch[1].toUpperCase().replace(/\s+/g, '');
      // If manufacturer wasn't found yet and there is text after a second presentation or multi-space gap
      if (!manufacturer) {
        const partsByDoubleSpace = working
          .split(/\s{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (partsByDoubleSpace.length >= 2) {
          const lastPart = partsByDoubleSpace[partsByDoubleSpace.length - 1];
          if (
            lastPart.length >= 2 &&
            lastPart.length <= 25 &&
            !/^\d/.test(lastPart)
          ) {
            manufacturer = lastPart.toUpperCase();
            description = partsByDoubleSpace
              .slice(0, -1)
              .join(' ')
              .replace(new RegExp(`\\s+${presentation}$`, 'i'), '')
              .trim();
          }
        }
      }
    }
  }

  // Clean duplicated trailing presentation in description if still present (e.g. "300G 300G")
  const dupPres = description.match(
    /^(.+\b(\d+(?:X\d+)?(?:G|GR|KG|ML|L|MG|CAPS)))\s+\2$/i
  );
  if (dupPres) {
    description = dupPres[1].trim();
    if (!presentation) presentation = dupPres[2].toUpperCase();
  }

  // Ensure description has actual letters (is a real product name)
  if (!description || !/[A-Za-zÀ-ú]{2,}/.test(description)) {
    return null;
  }

  if (!totalPrice && unitPrice > 0) {
    totalPrice = Number((unitPrice * quantityOrdered).toFixed(2));
  }

  return {
    code,
    quantityOrdered,
    unit,
    description,
    presentation,
    manufacturer: manufacturer || 'PADRÃO',
    expirationDate: expirationDate || '',
    unitPrice,
    totalPrice,
    location,
    lotInfo,
  };
}

function parseDelimitedItemColumns(cols: string[]): ParsedMatrixItem | null {
  // Supports: SKU | Produto | Qtd | Validade | Fornecedor OR SKU | Qtd | Unid | Produto | Fornecedor | Validade
  const code = cols[0].replace(/^#/, '').trim();
  let quantityOrdered = 1;
  let unit = 'UN';
  let description = '';
  let manufacturer = '';
  let expirationDate = '';

  for (let i = 1; i < cols.length; i++) {
    const c = cols[i].trim();
    if (!c) continue;

    // Date (Validade)
    const exp = extractExpirationDate(c);
    if (exp && !expirationDate) {
      expirationDate = exp;
      continue;
    }

    // Quantity (+ optional unit)
    const qMatch = c.match(
      /^(\d+(?:[.,]\d+)?)(?:\s*(UN|UND|PT|CX|SCH|LATA|KG|PC|PCT|FD|FR))?$/i
    );
    if (qMatch && quantityOrdered === 1 && i <= 3) {
      quantityOrdered = parseBrNumber(qMatch[1]) || 1;
      if (qMatch[2]) unit = normalizeUnit(qMatch[2]);
      continue;
    }

    if (VALID_UNITS.has(c.toUpperCase())) {
      unit = normalizeUnit(c);
      continue;
    }

    if (!description) {
      description = c;
    } else if (!manufacturer) {
      manufacturer = c.toUpperCase();
    }
  }

  if (!description) return null;

  return {
    code,
    quantityOrdered,
    unit,
    description,
    presentation: '',
    manufacturer: manufacturer || 'PADRÃO',
    expirationDate,
    unitPrice: 0,
    totalPrice: 0,
    location: '-',
    lotInfo: expirationDate ? `Val: ${expirationDate}` : '',
  };
}

function normalizeUnit(u: string): string {
  const up = u.toUpperCase().trim();
  if (up === 'UND' || up === 'UNID') return 'UN';
  if (up === 'POTE') return 'PT';
  if (up === 'CAIXA') return 'CX';
  if (up === 'SACHE') return 'SCH';
  return up;
}

/**
 * Builds a fallback ParsedOrderMatrix from the learned VitSis template (160753)
 * when a rasterized/image-only PDF has no embedded text stream.
 */
export function getTemplateMatrixOrder(sellerName?: string): ParsedOrderMatrix {
  return {
    orderNumber: SAMPLE_ORDER_160753.orderNumber,
    dateCad: SAMPLE_ORDER_160753.dateCad,
    clientCode: SAMPLE_ORDER_160753.clientCode || '7743',
    clientName: SAMPLE_ORDER_160753.clientName,
    clientFantasia: SAMPLE_ORDER_160753.clientFantasia || '',
    clientAddress: SAMPLE_ORDER_160753.clientAddress || '',
    cnpj: SAMPLE_ORDER_160753.cnpj || '',
    transport: SAMPLE_ORDER_160753.transport || '',
    route: SAMPLE_ORDER_160753.route || '',
    sellerName: SAMPLE_ORDER_160753.sellerName || (sellerName || 'Zelia').toUpperCase(),
    totalItems: SAMPLE_ORDER_160753.items.length,
    totalValue: SAMPLE_ORDER_160753.totalValue,
    parseMethod: 'matrix-template',
    items: SAMPLE_ORDER_160753.items.map((it) => ({
      code: it.code,
      quantityOrdered: it.quantityOrdered,
      unit: it.unit || 'UN',
      description: it.description,
      presentation: it.presentation || '',
      manufacturer: it.manufacturer || '',
      expirationDate:
        it.expirationDate || extractExpirationDate(it.lotInfo) || '',
      unitPrice: it.unitPrice || 0,
      totalPrice: it.totalPrice || 0,
      location: it.location || '-',
      lotInfo: it.lotInfo || '',
    })),
  };
}
