import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDocumentProxy, extractText } from 'unpdf';
import Tesseract, { createWorker } from 'tesseract.js';
import dotenv from 'dotenv';
import {
  parseOrderMatrixText,
  getEmptyParsedOrder,
} from './src/services/orderMatrixParser';

dotenv.config();

// Pre-warmed Tesseract OCR worker configured for tabular order sheets (VitSis frmRelPedido2)
let ocrWorkerPromise: Promise<Tesseract.Worker> | null = null;

function getOcrWorker(): Promise<Tesseract.Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker('por');
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((err) => {
      ocrWorkerPromise = null;
      throw err;
    });
  }
  return ocrWorkerPromise;
}

// Pre-warm worker in background on startup
getOcrWorker().catch(() => {});

/**
 * Extracts visual horizontal rows from a PDF buffer using exact (x, y) coordinates of text elements.
 * Preserves the exact tabular matrix structure of the VitSis order sheet.
 */
async function extractStructuredLinesFromPdf(
  uint8Array: Uint8Array
): Promise<{ lines: string[]; rawText: string }> {
  const lines: string[] = [];
  let rawText = '';

  try {
    const pdf = await getDocumentProxy(uint8Array);
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      interface PositionedItem {
        str: string;
        x: number;
        y: number;
      }

      const items: PositionedItem[] = [];
      for (const item of textContent.items as any[]) {
        if (item && typeof item.str === 'string' && item.str.trim().length > 0) {
          const x = item.transform ? Number(item.transform[4]) || 0 : 0;
          const y = item.transform ? Number(item.transform[5]) || 0 : 0;
          items.push({ str: item.str, x, y });
        }
      }

      // Group items that sit on the same horizontal row (within 4pt vertical tolerance)
      const rows: { y: number; cells: PositionedItem[] }[] = [];
      for (const it of items) {
        const existingRow = rows.find((r) => Math.abs(r.y - it.y) <= 4.0);
        if (existingRow) {
          existingRow.cells.push(it);
        } else {
          rows.push({ y: it.y, cells: [it] });
        }
      }

      // Sort rows top-to-bottom (PDF y-axis goes bottom-to-top, so descending y)
      rows.sort((a, b) => b.y - a.y);

      for (const row of rows) {
        // Sort cells left-to-right (ascending x)
        row.cells.sort((a, b) => a.x - b.x);
        const lineStr = row.cells.map((c) => c.str.trim()).join('   ');
        if (lineStr.trim()) {
          lines.push(lineStr.trim());
        }
      }
    }
  } catch (err) {
    console.warn('Coordinate PDF extraction warning:', err);
  }

  try {
    const extracted = await extractText(uint8Array, { mergePages: true });
    rawText =
      typeof extracted.text === 'string'
        ? extracted.text
        : Array.isArray(extracted.text)
        ? extracted.text.join('\n')
        : '';
  } catch (err) {
    rawText = lines.join('\n');
  }

  if (!rawText && lines.length > 0) {
    rawText = lines.join('\n');
  }

  return { lines, rawText };
}

async function runImageOcrWithLayout(
  buffer: Buffer,
  sellerName?: string
) {
  try {
    const worker = await getOcrWorker();
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });
    const resBlock = await worker.recognize(buffer);
    const textBlock = resBlock?.data?.text || '';

    if (textBlock.trim().length > 0) {
      const parsedBlock = parseOrderMatrixText(textBlock, undefined, sellerName);
      if (parsedBlock.items.length > 0) {
        parsedBlock.parseMethod = 'matrix-ocr';
        return parsedBlock;
      }

      // Try AUTO page segmentation if SINGLE_BLOCK didn't find items
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      const resAuto = await worker.recognize(buffer);
      const textAuto = resAuto?.data?.text || '';
      if (textAuto.trim().length > 0) {
        const parsedAuto = parseOrderMatrixText(
          textBlock + '\n' + textAuto,
          undefined,
          sellerName
        );
        parsedAuto.parseMethod = 'matrix-ocr';
        return parsedAuto;
      }

      parsedBlock.parseMethod = 'matrix-ocr';
      return parsedBlock;
    }
  } catch (workerErr) {
    console.warn('Worker OCR error, retrying direct Tesseract.recognize:', workerErr);
  }

  const direct = await Tesseract.recognize(buffer, 'por');
  const directText = direct?.data?.text || '';
  if (directText.trim().length > 0) {
    const parsed = parseOrderMatrixText(directText, undefined, sellerName);
    parsed.parseMethod = 'matrix-ocr';
    return parsed;
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for high-res base64 images / PDFs
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Order Parser Endpoint (Processes the exact uploaded PDF, Pasted Image, or Photograph)
  app.post('/api/parse-order', async (req, res) => {
    try {
      const { fileDataUrl, rawText: bodyRawText, sellerName } = req.body;

      // 1. If raw text was directly pasted/submitted
      if (bodyRawText && typeof bodyRawText === 'string' && bodyRawText.trim()) {
        const parsed = parseOrderMatrixText(
          bodyRawText,
          undefined,
          sellerName
        );
        return res.json({ success: true, data: parsed });
      }

      if (!fileDataUrl || typeof fileDataUrl !== 'string') {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      // Parse data URL (data:image/png;base64,... or data:application/pdf;base64,...)
      const matches = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      let mimeType = 'application/pdf';
      let base64Data = fileDataUrl;

      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }

      const buffer = Buffer.from(base64Data, 'base64');

      // 2. If PDF: Extract text coordinates deterministically via unpdf
      if (mimeType.includes('pdf')) {
        const uint8Array = new Uint8Array(buffer);
        const { lines, rawText } = await extractStructuredLinesFromPdf(uint8Array);

        if (lines.length > 0 || rawText.trim().length > 0) {
          const parsed = parseOrderMatrixText(rawText, lines, sellerName);
          parsed.parseMethod = 'matrix-pdf';
          return res.json({ success: true, data: parsed });
        }

        const emptyData = getEmptyParsedOrder(sellerName);
        return res.json({ success: true, data: emptyData });
      }

      // 3. If Image (PNG/JPG from Ctrl+V, Gallery, or Camera): Run horizontal-line OCR on the image
      try {
        const parsedOcr = await Promise.race([
          runImageOcrWithLayout(buffer, sellerName),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 35000)
          ),
        ]);

        if (parsedOcr) {
          return res.json({ success: true, data: parsedOcr });
        }
      } catch (ocrErr) {
        console.warn('Erro ao processar OCR da imagem:', ocrErr);
      }

      const emptyData = getEmptyParsedOrder(sellerName);
      return res.json({ success: true, data: emptyData });
    } catch (err: any) {
      console.error('Erro na rota /api/parse-order:', err);
      const emptyData = getEmptyParsedOrder(req.body?.sellerName);
      return res.json({ success: true, data: emptyData });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
