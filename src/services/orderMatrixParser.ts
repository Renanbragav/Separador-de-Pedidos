import { VENDEDORES } from '../types';

export interface ParsedMatrixItem {
  code: string; // SKU / Cdgo
  quantityOrdered: number; // Quantidade / Qtde
  unit: string;
  description: string; // Produto
  presentation: string; // Apresentação
  manufacturer: string; // Fornecedor / Fornec./Fab.
  expirationDate: string; // Validade (L->DD/MM/YYYY)
  unitPrice: number; // Vr. Unit.
  totalPrice: number; // Total
  location: string; // Local.
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
  parseMethod: 'matrix-pdf' | 'matrix-text' | 'matrix-ocr' | 'matrix-empty';
}

export const KNOWN_SUPPLIERS = [
  'INTEGRALMEDICA',
  'INTEGRAL MEDICA',
  'INTEGRALME',
  'MAX TITANIUM',
  'MAX TITANI',
  'BODYACTION',
  'BODY ACTION',
  'BODYACTIO',
  'BENDU',
  'PROBIOTICA',
  'PROBIOTIC',
  'DARKNESS',
  'NUTRATA',
  'DUX NUTRITION',
  'DUX NUTRIT',
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
  'BLACK SKUL',
  'ADAPTOGEN',
  'BOLD',
  'PINATI',
  'DR PEANUT',
  'DR. PEANUT',
  'MAIS MU',
  '+MU',
  'SUAVIPAN',
  'TRUE SOURCE',
  'TRUE SOURC',
  'PURAVIDA',
  'PURA VIDA',
  'OCEAN DROP',
  'SANAVITA',
  'CATARINENSE',
  'CATARINENS',
  'NATULAB',
  'CIMED',
  'NEO QUIMICA',
  'NEO QUIMIC',
  'EUROFARMA',
  'EMS',
  'OPTIMUM NUTRITION',
  'OPTIMUM NU',
  'DYMATIZE',
  'MUSCLETECH',
  'UNIVERSAL',
  'DRAGON PHARMA',
  'DRAGON PHA',
  'UNDER LABZ',
  'FTW',
  'PRO CORPS',
  'PROCORPS',
  'LEADER NUTRITION',
  'LEADER NUT',
  'PROFIT',
  'CANIBAL INC',
  'CANIBAL',
  '3VS NUTRITION',
  '3VS NUTRIT',
  '3VS',
  'SHARK PRO',
  'SOLDIERS NUTRITION',
  'SOLDIERS N',
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
  'SH',
  'SC',
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
 * Extracts clean expiration date (Validade) from VitSis lot info
 * e.g. "Local.: ESTOQUE1-BLOCO-G / L->26/12/2027 Lt 083400 Qt 20,"
 * or any OCR variation of it ("L->26/12/2027", "l->26/12/2027", "L-26/12/2027").
 */
export function extractExpirationDate(text?: string): string {
  if (!text) return '';
  // Pattern 1: VitSis lot arrow "L->26/12/2027", "l->26/12/2027", "1->26/12/2027", "L-26/12/2027", "L > 26/12/2027"
  const lotArrowMatch = text.match(
    /[LlI1|]\s*[-=~>›]+\s*(\d{2}\/\d{2}\/\d{2,4})/i
  );
  if (lotArrowMatch) return lotArrowMatch[1];

  // Pattern 2: Explicit "Val: 26/12/2027" or "Validade: 26/12/2027"
  const valMatch = text.match(
    /(?:VAL(?:IDADE)?|VENC(?:IMENTO)?)\s*[\s.:;-]*(\d{2}\/\d{2}\/\d{2,4}|\d{2}\/\d{4})/i
  );
  if (valMatch) return valMatch[1];

  // Pattern 3: Any DD/MM/YYYY or MM/YYYY inside the string
  const genericDate = text.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})\b/);
  if (genericDate) return genericDate[1];

  return '';
}

/**
 * Parses Brazilian formatted numbers, including 3-decimal unit prices like "42,900" -> 42.90
 * and totals like "858,00" -> 858.00 or "2.290,79" -> 2290.79.
 */
function parseBrNumber(raw?: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/[oO]/g, '0');
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
      /(?:\s+-\s+|\s+)(?:DATA\s*CAD|EMISS[AÃ]O|HORA|P[ÁA]GINA|PRAZO|CAD\.|NOME\s*FANTASIA|FANTASIA|CNPJ(?:\/CPF)?|CPF|INSC(?:R)?\.?\s*EST|IE|FONE|TELEFONE|CELULAR|ROTA|RAMO|ENTREGA|PRIORIDADE|AGEN\.?|STATUS|VENDEDOR(?:\(A\))?|TRANSP(?:ORT(?:\.|ADORA)?)?|CEP|BAIRRO|CIDADE|UF|CONDI[CÇ][AÃ]O|FORMA\s*PAG)[\s.:;-]+.*$/i,
      ''
    )
    .replace(/^[\s.:;-]+/, '')
    .replace(/\s+-\s*$/, '')
    .trim();
}

/**
 * Deterministic Matrix Parser for VitSis "Folha de Pedido" (`frmRelPedido2` & standard layouts).
 * Supports PDF text, pasted screenshots (Ctrl+V), and camera photographs.
 */
export function parseOrderMatrixText(
  rawText: string,
  structuredLines?: string[],
  defaultSellerName = 'Vendedor'
): ParsedOrderMatrix {
  const normalizedText = (rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

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

    // Ignore company title header line ("CAROL DISTRIBUIDORA LTDA" / "VitSis - Sistema de Gestão Comercial")
    if (
      /CAROL\s+DISTRIBUIDORA|SISTEMA\s+DE\s+GEST[AÃ]O\s+COMERCIAL|FRMRELPEDIDO/i.test(
        line
      )
    ) {
      if (!dateCad) {
        const mEmissao = line.match(
          /EMISS[AÃ]O[\s.:;-]*(\d{2}\/\d{2}\/\d{2,4}(?:\s*[-–às]*\s*\d{2}:\d{2}(?::\d{2})?)?)/i
        );
        if (mEmissao) {
          dateCad = mEmissao[1].trim();
        }
      }
      continue;
    }

    // Order Number:
    // Matches "Numero......: 161076 - Data Cad.: 26/09/2026"
    // Or "Pedido...: 160753"
    // Or OCR variations "Nmero...: 161076", "Mumero...: 161076", "161076 - Data Cad"
    if (!orderNumber) {
      const mOrder =
        line.match(
          /(?:N[ÚU]?M(?:ERO)?|MUMERO|PEDIDO(?:\s+DE\s+VENDA)?|OR[CÇ]AMENTO)[\s.º°o#:-]*?(\d{4,10})\b/i
        ) ||
        line.match(/\b(\d{5,8})\s*[-–]\s*DATA\s*CAD/i) ||
        line.match(/N[º°o.]*\s*(?:DO\s+)?PEDIDO[\s.:;-]*(\d{4,10})\b/i);
      if (mOrder) {
        orderNumber = mOrder[1].trim();
      }
    }

    // Date Cad / Emissão:
    // Matches "Data Cad.: 26/09/2026 - 09:52:11" or "Emissão: 26/09/2026"
    if (!dateCad || !dateCad.includes(':')) {
      const mDate = line.match(
        /(?:DATA\s*(?:CAD\.?|DE\s*CADASTRO|EMISS[AÃ]O|DO\s*PEDIDO)?|EMISS[AÃ]O)[\s.:;-]*(\d{2}\/\d{2}\/\d{2,4}(?:\s*[-–às]*\s*\d{2}:\d{2}(?::\d{2})?)?)/i
      );
      if (mDate) {
        dateCad = mDate[1].trim();
      }
    }

    // Client Code & Client Name:
    // Matches "Cliente.......: 5492 - SUPERMERCADO MSB EIRELI ME - Fantasia: SUPERMERCADO MSB EIRELI ME"
    if (!clientName) {
      const mClient = line.match(
        /(?:CLIENTE|CLLENTE|CLIENTE|RAZ[AÃ]O\s*SOCIAL|DESTINAT[AÁ]RIO|SACADO|NOME\s*DO\s*CLIENTE)[\s.:;-]+(?:(\d{1,8})\s*[-–/]\s*)?(.+)/i
      );
      if (mClient) {
        if (mClient[1]) clientCode = mClient[1].trim();
        let rawClient = cleanHeaderValue(mClient[2]);
        const codePrefix = rawClient.match(/^(\d{1,8})\s*[-–/]\s*(.+)$/);
        if (codePrefix) {
          if (!clientCode) clientCode = codePrefix[1].trim();
          rawClient = codePrefix[2].trim();
        }
        if (
          rawClient &&
          rawClient.length >= 2 &&
          !/^CAROL\s+DISTRIBUIDORA/i.test(rawClient)
        ) {
          clientName = rawClient;
        }
      }
    }

    // Client Fantasia (can be on same line as Cliente or separate line)
    if (!clientFantasia) {
      const mFantasia = line.match(/(?:NOME\s*)?FANTASIA[\s.:;-]+(.+)/i);
      if (mFantasia) {
        clientFantasia = cleanHeaderValue(mFantasia[1]);
      }
    }

    // CNPJ / CPF (can be on same line as Rota)
    if (!cnpj) {
      const mCnpj = line.match(
        /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/
      );
      if (mCnpj) {
        cnpj = mCnpj[1];
      }
    }

    // Client Address ("Endereço....: AV. AGUANAMBI 880 - JOSE BONIFACIO - FORTALEZA-CE")
    if (!clientAddress) {
      const mAddr = line.match(/ENDERE[CÇG]O[\s.:;-]+(.+)/i);
      if (mAddr) {
        clientAddress = cleanHeaderValue(mAddr[1]);
      }
    }

    // Transportadora ("- Transport.: 1 - PROPRIO" or "Transportadora: ...")
    if (!transport) {
      const mTransp = line.match(
        /TRANSP(?:ORT(?:\.|ADORA)?)?[\s.:;-]+(.+)/i
      );
      if (mTransp) {
        transport = cleanHeaderValue(mTransp[1]);
      }
    }

    // Rota ("Rota...........: 1 - LOCAL - Ramo: 8 - INDEFINIDO")
    if (!route) {
      const mRoute = line.match(/\bROTA[\s.:;-]+(.+)/i);
      if (mRoute) {
        route = cleanHeaderValue(mRoute[1]);
      }
    }

    // Seller Name ("Vendedor: 22 - ZELIA CAVALCANTE - Agen.: 1 - CARTEIRA")
    if (!sellerName) {
      const mSeller = line.match(
        /(?:VENDEDOR(?:\(A\))?|REPR(?:ESENTANTE)?)[\s.:;-]+(?:\d+\s*[-–/]\s*)?([A-ZÀ-Úa-zà-ú\s]+)/i
      );
      if (mSeller) {
        const cleanedSeller = cleanHeaderValue(mSeller[1]);
        if (cleanedSeller.length >= 2) {
          sellerName = cleanedSeller;
        }
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

  // 2. EXTRACT ITEMS MATRIX (Cdgo/SKU, Qtde, Und, Produto, Apresentação, Fornec./Fab., Vr. Unit., Total, Local., L->Validade)
  const items: ParsedMatrixItem[] = [];
  const consumedLineIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineClean = rawLine
      .replace(/\t+/g, ' ')
      .replace(/[|¦]+/g, '  ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if this line is a VitSis `Local.: ... / L->...` or `L->...` sub-row:
    // Example from user screenshot:
    // "Local.: ESTOQUE1-BLOCO-G / L->26/12/2027 Lt 083400 Qt 20,"
    const isLocalOrLotSubRow =
      /^LOCAL[\s.:;-]+/i.test(lineClean) ||
      /^[LlI1|]\s*[-=~>›]+\s*\d{2}\/\d{2}\/\d{2,4}/i.test(lineClean) ||
      /^(?:LOTE|VAL(?:IDADE)?|VENC(?:IMENTO)?)\s*[\s.:;-]+/i.test(lineClean) ||
      (/[LlI1|]\s*[-=~>›]+\s*\d{2}\/\d{2}\/\d{2,4}/i.test(lineClean) &&
        /\b(?:Lt|Qt)\b/i.test(lineClean)) ||
      (/\bLt\.?\s*[A-Za-z0-9\/_-]+/i.test(lineClean) &&
        /\bQt\.?\s*\d+/i.test(lineClean));

    if (isLocalOrLotSubRow) {
      // If the previous line (i - 1) wasn't parsed as an item yet (e.g. due to OCR quirks),
      // recover it now because in VitSis `Local.: ... / L->...` ALWAYS follows an item line!
      if (i > 0 && !consumedLineIndices.has(i - 1)) {
        const prevLine = lines[i - 1];
        if (!isHeaderOrFooterLine(prevLine)) {
          const recoveredItem = parseForgivingVitSisItemLine(prevLine, lineClean);
          if (recoveredItem) {
            items.push(recoveredItem);
            consumedLineIndices.add(i - 1);
          }
        }
      }

      if (items.length > 0) {
        const lastItem = items[items.length - 1];

        // Extract Local.: ESTOQUE1-BLOCO-G
        const localMatch = lineClean.match(
          /LOCAL[\s.:;-]+([^\/]+?)(?:\s*\/\s*|\s+[LlI1|]\s*[-=~>›]+|$)/i
        );
        if (localMatch && localMatch[1].trim()) {
          lastItem.location = localMatch[1].trim().toUpperCase();
        } else {
          const fallbackLoc = lineClean.match(
            /\b(ESTOQUE\s*\d*\s*[-–]?\s*BLOCO\s*[-–]?\s*[A-Z0-9]+|GELADEIRA\s*\d+|PRATELEIRA\s*[A-Z0-9]+)\b/i
          );
          if (fallbackLoc) {
            lastItem.location = fallbackLoc[1].trim().toUpperCase();
          }
        }

        // Extract Expiration Date (Validade) from L->26/12/2027
        const expDate = extractExpirationDate(lineClean);
        if (expDate) {
          lastItem.expirationDate =
            lastItem.expirationDate &&
            lastItem.expirationDate !== '-' &&
            !lastItem.expirationDate.includes(expDate)
              ? `${lastItem.expirationDate} | ${expDate}`
              : expDate;
        }

        // Store Lot info
        const lotPartMatch = lineClean.match(
          /([LlI1|]\s*[-=~>›]+\s*\d{2}\/\d{2}\/\d{2,4}.*)$/i
        );
        const cleanLotStr = (lotPartMatch ? lotPartMatch[1] : lineClean)
          .replace(/,\s*$/, '')
          .trim();
        lastItem.lotInfo = lastItem.lotInfo
          ? `${lastItem.lotInfo} / ${cleanLotStr}`
          : cleanLotStr;

        // Check Qt in lot line if quantityOrdered is missing
        const qtMatch = lineClean.match(/Qt\.?\s*(\d+(?:[.,]\d+)?)/i);
        if (
          qtMatch &&
          (!lastItem.quantityOrdered || lastItem.quantityOrdered <= 1)
        ) {
          const parsedQt = parseBrNumber(qtMatch[1]);
          if (parsedQt > 0) {
            lastItem.quantityOrdered = parsedQt;
          }
        }

        consumedLineIndices.add(i);
        continue;
      }
    }

    // Skip non-item header/footer lines
    if (isHeaderOrFooterLine(lineClean)) {
      continue;
    }

    // Check if the line is pipe-separated or semicolon-separated
    if (rawLine.includes('|') || rawLine.includes(';')) {
      const sep = rawLine.includes('|') ? '|' : ';';
      const cols = rawLine
        .split(sep)
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 3 && /^\d{1,8}$/.test(cols[0].replace(/^#/, ''))) {
        const parsedFromDelimited = parseDelimitedItemColumns(cols);
        if (parsedFromDelimited) {
          items.push(parsedFromDelimited);
          consumedLineIndices.add(i);
          continue;
        }
      }
    }

    // Standard & frmRelPedido2 VitSis Matrix Item Line detection
    const parsedItem = parseVitSisMatrixRow(rawLine);
    if (parsedItem) {
      items.push(parsedItem);
      consumedLineIndices.add(i);
    }
  }

  // Secondary OCR pass if no items were matched yet
  if (items.length === 0 && lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      if (consumedLineIndices.has(i)) continue;
      const cleanedOcrLine = lines[i]
        .replace(/^[|!lI\[\]•·\-_=+*~<>:;.,\s]+/, '')
        .replace(/[|!\[\]]+/g, '  ')
        .trim();
      if (!cleanedOcrLine || cleanedOcrLine.length < 6) continue;
      if (isHeaderOrFooterLine(cleanedOcrLine)) continue;

      const retryItem =
        parseVitSisMatrixRow(cleanedOcrLine) ||
        parseForgivingVitSisItemLine(cleanedOcrLine);
      if (retryItem) {
        items.push(retryItem);
      }
    }
  }

  // Calculate total value & total items
  const calculatedTotal = items.reduce(
    (acc, item) =>
      acc + (item.totalPrice || item.unitPrice * item.quantityOrdered || 0),
    0
  );

  // Check if total value is explicitly stated in the text ("Valor Bruto....: 858,00" or "Valor Liquido: 858,00")
  let explicitTotal = 0;
  const totalMatch =
    normalizedText.match(
      /(?:VALOR\s*L[ÍI]QUIDO|VALOR\s*BRUTO|VALOR\s*TOTAL|TOTAL\s*DO\s*PEDIDO|TOTAL\s*GERAL|VLR\.?\s*TOTAL)[\s.:;-]*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*[.,]\d{2})\b/i
    ) ||
    normalizedText.match(
      /TOTAL\s*R\$[\s.:;-]*(\d{1,3}(?:\.\d{3})*[.,]\d{2})\b/i
    );
  if (totalMatch) {
    explicitTotal = parseBrNumber(totalMatch[1]);
  }

  return {
    orderNumber:
      orderNumber || String(Math.floor(160000 + Math.random() * 9000)),
    dateCad: dateCad || new Date().toLocaleString('pt-BR'),
    clientCode: clientCode || '',
    clientName: clientName || 'Cliente Importado',
    clientFantasia: clientFantasia || '',
    clientAddress: clientAddress || '',
    cnpj: cnpj || '',
    transport: transport || '1 - PROPRIO',
    route: route || '1 - LOCAL',
    sellerName: sellerName || defaultSellerName.toUpperCase(),
    totalItems: items.length,
    totalValue: Number((calculatedTotal || explicitTotal || 0).toFixed(2)),
    items,
    parseMethod: 'matrix-text',
  };
}

function isHeaderOrFooterLine(lineClean: string): boolean {
  return /^(?:CAROL\s+DISTRIBUIDORA|\.?:\s*VITSIS|\*\s*VITSIS|PEDIDO\s+DE\s+VENDA|FRMRELPEDIDO|N[ÚU]?MERO\.|MUMERO|PEDIDO[\s.:]|CLIENTE[\s.:]|CLLENTE|RAZ[AÃ]O|FANTASIA|NOME\s*FANTASIA|ENDERE[CÇG]O|PRIORIDADE|CNPJ|CPF|TRANSP|VENDEDOR|ROTA|DATA\s*CAD|EMISS[AÃ]O|HORA\.|OBSERVA|OBS\.?\s*INTERNA|TOTAIS\s*==|T[ÍI]TULOS\s*==|MG\s*===|VALOR\s*BRUTO|VALOR\s*L[ÍI]QUIDO|TOTAL\s*DESC|OUTRAS\s*DESP|QTD\.?\s*ITENS|PESO\s*L[ÍI]QUIDO|VALOR\s*TOTAL|SUBTOTAL|DESCONTO|FRETE|ASSINATURA|CONFERENTE|SEPARADOR|CDGO\s+QTDE|C[ÓO]D(?:IGO)?[\s.]|SKU\s|ITEM\s+C[ÓO]D|P[ÁA]GINA|FONE|TELEFONE|CIDADE|BAIRRO|CEP|CONDI[CÇ][AÃ]O|FORMA\s*DE\s*PAG)/i.test(
    lineClean.trim()
  );
}

function detectSupplierInString(text: string): {
  matchedToken: string;
  normalizedSupplier: string;
} | null {
  const sortedSuppliers = [...KNOWN_SUPPLIERS].sort(
    (a, b) => b.length - a.length
  );
  for (const sup of sortedSuppliers) {
    const escaped = sup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`\\b(${escaped})\\b`, 'i'));
    if (match) {
      let norm = sup.toUpperCase();
      if (norm === 'INTEGRALME') norm = 'INTEGRALMEDICA';
      if (norm === 'MAX TITANI') norm = 'MAX TITANIUM';
      if (norm === 'BODYACTIO') norm = 'BODYACTION';
      if (norm === 'BLACK SKUL') norm = 'BLACK SKULL';
      return { matchedToken: match[1], normalizedSupplier: norm };
    }
  }
  return null;
}

/**
 * Parses a single VitSis matrix row (`frmRelPedido2` or standard layout):
 * Example (`frmRelPedido2`):
 * "2188   20 ______ UN  IM CREATINA 300G   300G   INTEGRALME   42,900   0,00   858,00"
 */
function parseVitSisMatrixRow(rawLine: string): ParsedMatrixItem | null {
  let working = rawLine
    .replace(/\t+/g, '  ')
    .replace(/[|¦]+/g, '  ')
    .replace(/^[!lI\[\]•·\-_=+*~<>:;.,\s]+/, '')
    .trim();

  // Avoid matching dates like 26/09/2026 or phone numbers or CNPJs or "1,3400" (MG ====>)
  if (
    /^\d{2}\/\d{2}\//.test(working) ||
    /^\d{2}\.\d{3}\./.test(working) ||
    /^\d{5}-\d{3}/.test(working) ||
    /^\d+,\d{3,4}$/.test(working)
  ) {
    return null;
  }

  // Match leading SKU / Cdgo (1 to 8 digits or alphanumeric code)
  const skuMatch = working.match(/^(\d{1,8}|[A-Z]{1,3}\d{2,6})\s+(.+)$/i);
  if (!skuMatch) return null;

  let code = skuMatch[1].trim();
  working = skuMatch[2].trim();

  // Remove Q. Sep underline blank ("______", "____", "---", "—", "...") or short OCR noise between Qtde and Und in frmRelPedido2!
  working = working.replace(
    /^(\d+(?:[.,]\d+)?)\s+[^\w\s]{1,12}\s*(UN|UND|UNID|UIV|UNI|PT|POTE|CX|CAIXA|SCH|SH|SC|SACHE|LATA|LT|KG|GR|G|ML|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\b/i,
    '$1 $2'
  );
  working = working.replace(/(\d+)\s*[_\-.=~—–]{2,}\s*/g, '$1 ');

  // If the line starts with a 1-2 digit item index followed by a 3-6 digit SKU and then quantity+unit, shift to SKU
  const seqThenSkuMatch = working.match(
    /^(\d{3,7})\s+(\d+(?:[.,]\d+)?\s*(?:UN|UND|UNID|PT|POTE|CX|CAIXA|SCH|SH|SC|SACHE|LATA|LT|KG|GR|G|ML|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\b.+)$/i
  );
  if (seqThenSkuMatch && code.length <= 2) {
    code = seqThenSkuMatch[1].trim();
    working = seqThenSkuMatch[2].trim();
  }

  let lotInfo = '';
  let expirationDate = '';

  // 1. Check if inline Lot / Validade info is present on the same line
  const inlineLotMatch = working.match(
    /([LlI1|]\s*[-=~>›]+\s*\d{2}\/\d{2}\/\d{2,4}(?:\s+Lt\.?\s*[A-Za-z0-9\/_-]+)?(?:\s+Qt\.?\s*[\d.,]+)?)/i
  );
  if (inlineLotMatch) {
    lotInfo = inlineLotMatch[1].trim();
    expirationDate = extractExpirationDate(lotInfo);
    working = working.replace(inlineLotMatch[0], ' ').trim();
  }

  // Check for inline "Val: DD/MM/YYYY" or standalone date column DD/MM/YYYY
  const inlineDateMatch = working.match(
    /(?:VAL(?:IDADE)?\s*[\s.:;-]*)?(\b\d{2}\/\d{2}\/\d{4}\b)/i
  );
  if (inlineDateMatch && !expirationDate) {
    expirationDate = inlineDateMatch[1];
    working = working.replace(inlineDateMatch[0], ' ').trim();
  }

  // 2. Extract Location if on the main line (e.g., ESTOQUE2-BLOCO-K, GELADEIRA 01, PRATELEIRA B)
  let location = '-';
  const locMatch = working.match(
    /\b(ESTOQUE\s*\d*\s*[-–]?\s*BLOCO\s*[-–]?\s*[A-Z0-9]+|GELADEIRA\s*\d+|PRATELEIRA\s*[A-Z0-9]+|CORREDOR\s*[A-Z0-9]+|GONDOLA\s*[A-Z0-9]+)\b/i
  );
  if (locMatch) {
    location = locMatch[1].trim().toUpperCase();
    working = working.replace(locMatch[0], ' ').trim();
  }

  // 3. Extract Quantity (Qtde) and Unit (Und)
  // Supports "20 UN", "20 ______ UN" (already cleaned above), or OCR variations like "20 U1V", "20 UN."
  let quantityOrdered = 0;
  let unit = 'UN';

  const leadingQtyUnit = working.match(
    /^(\d+(?:[.,]\d+)?)\s*[_\-.=~]*\s*(UN|UND|UNID|UIV|UNI|PT|POTE|CX|CAIXA|SCH|SH|SC|SACHE|LATA|LT|KG|GR|G|ML|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\.?\b\s*(.+)$/i
  );

  if (leadingQtyUnit) {
    quantityOrdered = parseBrNumber(leadingQtyUnit[1]);
    unit = normalizeUnit(leadingQtyUnit[2]);
    working = leadingQtyUnit[3].trim();
  } else {
    const leadingQtyOnly = working.match(/^(\d{1,5})\s*[_\-.=~]*\s+([A-ZÀ-Ú].+)$/i);
    const middleQtyUnit = working.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(UN|UND|UNID|PT|POTE|CX|CAIXA|SCH|SH|SC|SACHE|LATA|LT|KG|PC|PCT|DP|DISP|FD|FR|BL|TB|KIT)\.?\b(.*)$/i
    );

    if (middleQtyUnit && !/^\d+$/.test(middleQtyUnit[1].trim())) {
      quantityOrdered = parseBrNumber(middleQtyUnit[2]);
      unit = normalizeUnit(middleQtyUnit[3]);
      working = `${middleQtyUnit[1].trim()}   ${middleQtyUnit[4].trim()}`.trim();
    } else if (leadingQtyOnly) {
      quantityOrdered = parseBrNumber(leadingQtyOnly[1]);
      working = leadingQtyOnly[2].trim();
      // If the first word of working is an OCR-garbled unit right before the product name, strip it
      working = working.replace(/^(?:UN|UND|PT|CX|SCH|UIV|UNI)\s+/i, '');
    }
  }

  // 4. Extract Prices at the end of the row:
  // In frmRelPedido2: "Vr. Unit.  %Desc.  Total" -> e.g. "42,900   0,00   858,00" (3 numbers, Vr. Unit. has 2 or 3 decimals!)
  // Or in standard layout: "Vr. Unit.  Total" -> e.g. "7,76   124,16" (2 numbers)
  let unitPrice = 0;
  let totalPrice = 0;

  const trailingThreePrices = working.match(
    /^(.*?)\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s*$/
  );
  if (trailingThreePrices) {
    working = trailingThreePrices[1].trim();
    unitPrice = Number(parseBrNumber(trailingThreePrices[2]).toFixed(2));
    // trailingThreePrices[3] is %Desc. (e.g. 0,00)
    totalPrice = Number(parseBrNumber(trailingThreePrices[4]).toFixed(2));
  } else {
    const trailingTwoPrices = working.match(
      /^(.*?)\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s*$/
    );
    if (trailingTwoPrices) {
      working = trailingTwoPrices[1].trim();
      unitPrice = Number(parseBrNumber(trailingTwoPrices[2]).toFixed(2));
      totalPrice = Number(parseBrNumber(trailingTwoPrices[3]).toFixed(2));
    } else {
      const trailingOnePrice = working.match(
        /^(.*?)\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})\s*$/
      );
      if (trailingOnePrice) {
        working = trailingOnePrice[1].trim();
        totalPrice = Number(parseBrNumber(trailingOnePrice[2]).toFixed(2));
        unitPrice =
          quantityOrdered > 0
            ? Number((totalPrice / quantityOrdered).toFixed(2))
            : totalPrice;
      }
    }
  }

  if (quantityOrdered <= 0) {
    const standaloneQty = working.match(/^(.*?)\s+(\d{1,4})\s*$/);
    if (standaloneQty && standaloneQty[1].trim().length >= 3) {
      working = standaloneQty[1].trim();
      quantityOrdered = parseInt(standaloneQty[2], 10) || 1;
    } else {
      quantityOrdered = 1;
    }
  }

  // 5. Extract Fornecedor (Fornec./Fab.), Apresentação, and Produto (description)
  let manufacturer = '';
  let presentation = '';
  let description = working.replace(/\s+/g, ' ').trim();

  // Check if any KNOWN_SUPPLIERS (including truncated ones like INTEGRALME) is at the end of description
  const sortedSuppliers = [...KNOWN_SUPPLIERS].sort(
    (a, b) => b.length - a.length
  );
  for (const sup of sortedSuppliers) {
    const escaped = sup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const supEndRegex = new RegExp(`^(.+?)\\s+(${escaped})\\s*$`, 'i');
    const matchSup = description.match(supEndRegex);
    if (matchSup) {
      description = matchSup[1].trim();
      const detected = detectSupplierInString(sup);
      manufacturer = detected ? detected.normalizedSupplier : sup.toUpperCase();
      break;
    }
  }

  // Check if Presentation column (e.g. "300G", "40G", "900G", "12X45G") is repeated or precedes Supplier
  // Example: "IM CREATINA 300G 300G INTEGRALME" -> after stripping INTEGRALME, description is "IM CREATINA 300G 300G"
  const presAndSupplierMatch = description.match(
    /^(.+?\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP|UN)))\s+\2(?:\s+([A-ZÀ-Ú0-9\s.&+-]{2,25}))?$/i
  );
  if (presAndSupplierMatch) {
    description = presAndSupplierMatch[1].trim();
    presentation = presAndSupplierMatch[2].toUpperCase().replace(/\s+/g, '');
    if (!manufacturer && presAndSupplierMatch[3]) {
      const rawSup = presAndSupplierMatch[3].trim().toUpperCase();
      const detected = detectSupplierInString(rawSup);
      manufacturer = detected ? detected.normalizedSupplier : rawSup;
    }
  } else {
    // Also check if there is a standalone Presentation + Supplier at the end even if Produto didn't repeat Presentation
    // e.g. "IM CREATINA POTE   300G   INTEGRALME"
    const trailingPresSupplier = description.match(
      /^(.+?)\s+\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP))\s+([A-ZÀ-Ú]{3,20})$/i
    );
    if (trailingPresSupplier && !manufacturer) {
      description = `${trailingPresSupplier[1].trim()} ${trailingPresSupplier[2].trim()}`;
      presentation = trailingPresSupplier[2].toUpperCase().replace(/\s+/g, '');
      const rawSup = trailingPresSupplier[3].trim().toUpperCase();
      const detected = detectSupplierInString(rawSup);
      manufacturer = detected ? detected.normalizedSupplier : rawSup;
    }
  }

  // Clean duplicated trailing presentation in description if still present (e.g. "IM CREATINA 300G 300G")
  const dupPres = description.match(
    /^(.+\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP)))\s+\2$/i
  );
  if (dupPres) {
    description = dupPres[1].trim();
    if (!presentation) presentation = dupPres[2].toUpperCase();
  }

  if (!manufacturer) {
    const detected = detectSupplierInString(description);
    if (detected) {
      manufacturer = detected.normalizedSupplier;
    } else {
      manufacturer = 'PADRÃO';
    }
  }

  // Ensure description has actual letters and is not a header/footer line
  if (
    !description ||
    !/[A-Za-zÀ-ú]{2,}/.test(description) ||
    isHeaderOrFooterLine(description)
  ) {
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

/**
 * Forgiving item parser used when a line is immediately followed by `Local.: ... / L->...`
 * or during the secondary OCR recovery pass.
 */
function parseForgivingVitSisItemLine(
  rawLine: string,
  subRowLine?: string
): ParsedMatrixItem | null {
  const std = parseVitSisMatrixRow(rawLine);
  if (std) return std;

  let working = rawLine
    .replace(/\t+/g, ' ')
    .replace(/[|¦_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!working || working.length < 5 || isHeaderOrFooterLine(working)) {
    return null;
  }

  // Extract trailing prices (1 to 3 decimal numbers)
  let unitPrice = 0;
  let totalPrice = 0;
  const priceMatch = working.match(
    /^(.*?)\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4})(?:\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4}))?(?:\s+(\d{1,3}(?:\.\d{3})*[.,]\d{2,4}))?\s*$/
  );
  if (priceMatch && priceMatch[1].trim().length >= 4) {
    working = priceMatch[1].trim();
    if (priceMatch[4]) {
      unitPrice = Number(parseBrNumber(priceMatch[2]).toFixed(2));
      totalPrice = Number(parseBrNumber(priceMatch[4]).toFixed(2));
    } else if (priceMatch[3]) {
      unitPrice = Number(parseBrNumber(priceMatch[2]).toFixed(2));
      totalPrice = Number(parseBrNumber(priceMatch[3]).toFixed(2));
    } else {
      totalPrice = Number(parseBrNumber(priceMatch[2]).toFixed(2));
    }
  }

  // Extract leading SKU and Quantity
  let code = 'S/N';
  let quantityOrdered = 1;
  let unit = 'UN';

  const leadNums = working.match(
    /^(\d{2,8})\s+(\d{1,5})\s*(?:(UN|UND|PT|CX|SCH|SH|SC|LATA|LT|KG|PC|PCT|FD|FR)\b)?\s*(.+)$/i
  );
  if (leadNums) {
    code = leadNums[1];
    quantityOrdered = parseInt(leadNums[2], 10) || 1;
    if (leadNums[3]) unit = normalizeUnit(leadNums[3]);
    working = leadNums[4].trim();
  } else {
    const singleLeadNum = working.match(/^(\d{1,8})\s+(.+)$/);
    if (singleLeadNum) {
      code = singleLeadNum[1];
      working = singleLeadNum[2].trim();
    }
    // Check subRowLine for Qt (e.g. "Qt 20")
    if (subRowLine) {
      const qtSub = subRowLine.match(/Qt\.?\s*(\d+)/i);
      if (qtSub) {
        quantityOrdered = parseInt(qtSub[1], 10) || 1;
      }
    }
  }

  // Extract supplier & clean duplicate presentation
  let manufacturer = 'PADRÃO';
  let description = working.replace(/^(?:UN|UND|PT|CX|SCH)\s+/i, '').trim();

  const supInfo = detectSupplierInString(description);
  if (supInfo) {
    manufacturer = supInfo.normalizedSupplier;
    description = description
      .replace(new RegExp(`\\s+${supInfo.matchedToken}\\s*$`, 'i'), '')
      .trim();
  }

  const dupPres = description.match(
    /^(.+\b(\d+(?:X\d+)?\s*(?:G|GR|KG|ML|L|MG|CAPS|CP)))\s+\2$/i
  );
  if (dupPres) {
    description = dupPres[1].trim();
  }

  if (!/[A-Za-zÀ-ú]{2,}/.test(description)) return null;

  if (!unitPrice && totalPrice > 0 && quantityOrdered > 0) {
    unitPrice = Number((totalPrice / quantityOrdered).toFixed(2));
  }

  return {
    code,
    quantityOrdered,
    unit,
    description: description.toUpperCase(),
    presentation: '',
    manufacturer,
    expirationDate: extractExpirationDate(subRowLine) || '-',
    unitPrice,
    totalPrice,
    location: '-',
    lotInfo: '',
  };
}

function parseDelimitedItemColumns(cols: string[]): ParsedMatrixItem | null {
  const code = cols[0].replace(/^#/, '').trim();
  let quantityOrdered = 1;
  let unit = 'UN';
  let description = '';
  let manufacturer = '';
  let expirationDate = '';

  for (let i = 1; i < cols.length; i++) {
    const c = cols[i].trim();
    if (!c) continue;

    const exp = extractExpirationDate(c);
    if (exp && !expirationDate) {
      expirationDate = exp;
      continue;
    }

    const qMatch = c.match(
      /^(\d+(?:[.,]\d+)?)(?:\s*(UN|UND|PT|CX|SCH|SH|SC|LATA|KG|PC|PCT|FD|FR))?$/i
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
  const up = u.toUpperCase().replace(/\./g, '').trim();
  if (up === 'UND' || up === 'UNID' || up === 'UIV' || up === 'UNI') return 'UN';
  if (up === 'POTE') return 'PT';
  if (up === 'CAIXA') return 'CX';
  if (up === 'SACHE' || up === 'SH' || up === 'SC') return 'SCH';
  return up;
}

/**
 * Returns a clean, empty order structure (NEVER a hardcoded sample order!)
 * if an uploaded image/document had no recognizable text.
 */
export function getEmptyParsedOrder(sellerName?: string): ParsedOrderMatrix {
  return {
    orderNumber: String(Math.floor(160000 + Math.random() * 9000)),
    dateCad: new Date().toLocaleString('pt-BR'),
    clientCode: '',
    clientName: 'Novo Pedido Importado (Verificar Imagem)',
    clientFantasia: '',
    clientAddress: '',
    cnpj: '',
    transport: '1 - PROPRIO',
    route: '1 - LOCAL',
    sellerName: (sellerName || 'Vendedor').toUpperCase(),
    totalItems: 0,
    totalValue: 0,
    parseMethod: 'matrix-empty',
    items: [],
  };
}
