import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Use a CDN worker that matches the installed pdfjs-dist version.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

export const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

export const download = (bytes, filename, type = 'application/pdf') => {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const getPageCount = async (file) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return doc.getPageCount();
};

// Merge multiple PDFs (in given order) into one
export const mergePdfs = async (files) => {
  const out = await PDFDocument.create();
  for (const f of files) {
    if (f.type && f.type.startsWith('image/')) {
      let bytes = new Uint8Array(await readFile(f));
      let img;
      if (f.type === 'image/png') img = await out.embedPng(bytes);
      else if (f.type === 'image/jpeg') img = await out.embedJpg(bytes);
      else {
        const url = URL.createObjectURL(f);
        const el = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = el.naturalWidth; canvas.height = el.naturalHeight;
        canvas.getContext('2d').drawImage(el, 0, 0);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png');
        img = await out.embedPng(dataUrl);
      }
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      const src = await PDFDocument.load(await readFile(f), { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
  }
  return out.save();
};

// Parse a range string like "1-3, 5, 8-10" into 0-based unique indices
export const parseRanges = (str, total) => {
  const set = new Set();
  (str || '').split(',').forEach((part) => {
    const t = part.trim();
    if (!t) return;
    if (t.includes('-')) {
      let [a, b] = t.split('-').map((n) => parseInt(n.trim(), 10));
      if (isNaN(a)) a = 1;
      if (isNaN(b)) b = total;
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) set.add(i - 1);
    } else {
      const n = parseInt(t, 10);
      if (!isNaN(n) && n >= 1 && n <= total) set.add(n - 1);
    }
  });
  return [...set].sort((a, b) => a - b);
};

// Extract only the given 0-based indices into a new PDF
export const extractPages = async (file, indices) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Split into one PDF per range group -> returns array of {name, bytes}
export const splitByRanges = async (file, rangeStr) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const groups = (rangeStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const results = [];
  const base = file.name.replace(/\.pdf$/i, '');
  let idx = 1;
  for (const g of groups) {
    const indices = parseRanges(g, total);
    if (!indices.length) continue;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    results.push({ name: `${base}_part${idx}.pdf`, bytes: await out.save() });
    idx++;
  }
  return results;
};

export const removePages = async (file, indicesToRemove) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const total = src.getPageCount();
  const keep = [];
  for (let i = 0; i < total; i++) if (!indicesToRemove.includes(i)) keep.push(i);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Rebuild the PDF in the exact order given (array of 0-based indices)
export const reorderPages = async (file, order) => {
  const src = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach((p) => out.addPage(p));
  return out.save();
};

// Rotate: angle applied to all pages (or a subset of indices)
export const rotatePdf = async (file, angle, indices = null) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (indices && !indices.includes(i)) return;
    const current = p.getRotation().angle || 0;
    p.setRotation(degrees((current + angle) % 360));
  });
  return doc.save();
};

// Images -> single PDF
export const imagesToPdf = async (files, { fit = 'fit', margin = 24 } = {}) => {
  const out = await PDFDocument.create();
  for (const f of files) {
    const bytes = await readFile(f);
    let img;
    if (/png$/i.test(f.type) || /\.png$/i.test(f.name)) img = await out.embedPng(bytes);
    else img = await out.embedJpg(bytes);
    const iw = img.width;
    const ih = img.height;
    const page = out.addPage([iw + margin * 2, ih + margin * 2]);
    page.drawImage(img, { x: margin, y: margin, width: iw, height: ih });
  }
  return out.save();
};

// PDF -> array of JPG blobs (rendered via pdf.js)
export const pdfToImages = async (file, { scale = 2, quality = 0.92, onProgress } = {}) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const images = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    images.push({ blob, name: `page_${n}.jpg`, url: URL.createObjectURL(blob) });
    if (onProgress) onProgress(n, pdf.numPages);
  }
  return images;
};

// Render first N page thumbnails (data urls) for previews
export const renderThumbnails = async (file, max = 30, scale = 0.5) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const thumbs = [];
  const count = Math.min(pdf.numPages, max);
  for (let n = 1; n <= count; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbs.push({ index: n - 1, url: canvas.toDataURL('image/jpeg', 0.7) });
  }
  return { thumbs, total: pdf.numPages };
};

export const addPageNumbers = async (file, { position = 'bottom-center', start = 1, size = 11 } = {}) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    const label = `${start + i}`;
    const tw = font.widthOfTextAtSize(label, size);
    let x = width / 2 - tw / 2;
    let y = 18;
    if (position.includes('top')) y = height - 24;
    if (position.includes('left')) x = 28;
    if (position.includes('right')) x = width - tw - 28;
    p.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.3) });
  });
  return doc.save();
};

export const addWatermark = async (file, { text = 'CONFIDENTIAL', size = 48, opacity = 0.25, rotate = 45 } = {}) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((p) => {
    const { width, height } = p.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    p.drawText(text, {
      x: width / 2 - tw / 2,
      y: height / 2,
      size,
      font,
      color: rgb(1, 0.18, 0.33),
      opacity,
      rotate: degrees(rotate),
    });
  });
  return doc.save();
};

// Render a single page to a data URL at a target preview width (px).
// Returns pt dimensions so callers can map overlay coordinates back to PDF space.
export const renderPageImage = async (file, pageIndex = 0, previewWidth = 640) => {
  const data = await readFile(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = previewWidth / vp1.width;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    ptW: vp1.width,
    ptH: vp1.height,
    pxW: canvas.width,
    pxH: canvas.height,
    total: pdf.numPages,
  };
};

// Embed a PNG signature (data URL) onto one page at preview-space coordinates.
export const placeSignature = async (file, { pageIndex, sigPngDataUrl, box, preview }) => {
  const bytes = await readFile(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const png = await doc.embedPng(sigPngDataUrl);
  const page = doc.getPages()[pageIndex];
  const { width: ptW, height: ptH } = page.getSize();
  const sx = ptW / preview.pxW; // pt per preview px
  const sy = ptH / preview.pxH;
  const x = box.x * sx;
  const w = box.w * sx;
  const h = box.h * sy;
  const y = ptH - (box.y + box.h) * sy;
  page.drawImage(png, { x, y, width: w, height: h });
  return doc.save();
};

// Lightweight "compress": re-save with object streams. Real gains vary by source.
export const compressPdf = async (file) => {
  const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  return doc.save({ useObjectStreams: true });
};

// Render all pages once to canvases (kept in memory for re-encoding).
const renderPageCanvases = async (data, baseScale, onProgress) => {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const canvases = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 }); // points (72dpi)
    const vp = page.getViewport({ scale: baseScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    canvases.push({ canvas, ptW: vp1.width, ptH: vp1.height });
    if (onProgress) onProgress(Math.round((n / pdf.numPages) * 40));
  }
  return canvases;
};

const buildRasterPdf = async (canvases, scaleFactor, quality) => {
  const out = await PDFDocument.create();
  for (const c of canvases) {
    let src = c.canvas;
    if (scaleFactor < 0.999) {
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(c.canvas.width * scaleFactor));
      tmp.height = Math.max(1, Math.round(c.canvas.height * scaleFactor));
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(c.canvas, 0, 0, tmp.width, tmp.height);
      src = tmp;
    }
    const blob = await new Promise((r) => src.toBlob(r, 'image/jpeg', quality));
    const buf = await blob.arrayBuffer();
    const img = await out.embedJpg(buf);
    const page = out.addPage([c.ptW, c.ptH]);
    page.drawImage(img, { x: 0, y: 0, width: c.ptW, height: c.ptH });
  }
  return out.save({ useObjectStreams: true });
};

// ---------------------------------------------------------------------------
// EDIT PDF: extract clickable text items from a page + apply text edits.
// ---------------------------------------------------------------------------

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');

// Heuristically classify a font name into style buckets used for re-drawing.
const classifyFont = (name = '') => {
  const n = String(name).toLowerCase();
  const bold = /(bold|black|heavy|semibold|[-_ ]?(700|800|900))/.test(n);
  const italic = /(italic|oblique)/.test(n);
  const mono = /(mono|courier|consol|menlo|typewriter)/.test(n);
  const isSans = /sans/.test(n) || /(helvetica|arial|verdana|tahoma|calibri|segoe|roboto|open ?sans|lato)/.test(n);
  const serif = !mono && !isSans && /(times|serif|georgia|roman|garamond|minion|cambria|book antiqua|palatino|ming|song|nimbus ?rom)/.test(n);
  return { bold, italic, mono, serif };
};

// Render one page and return the rendered image + every text run on it with
// preview-space geometry (for the overlay) and PDF-space geometry (for export).
export const extractPageText = async (file, pageIndex = 0, previewWidth = 720) => {
  const data = await readFile(file);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = previewWidth / vp1.width;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  const tc = await page.getTextContent();
  const styles = tc.styles || {};
  const pix = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const cw = canvas.width;

  // Find the text color (darkest) and background (lightest) inside a box.
  const sampleColors = (bx, by, bw, bh) => {
    const x0 = Math.max(0, Math.floor(bx));
    const y0 = Math.max(0, Math.floor(by));
    const x1 = Math.min(canvas.width, Math.ceil(bx + bw));
    const y1 = Math.min(canvas.height, Math.ceil(by + bh));
    let dMin = 1e9, lMax = -1;
    let dark = [15, 23, 42];
    let light = [255, 255, 255];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * cw + x) * 4;
        const r = pix[i], g = pix[i + 1], b = pix[i + 2];
        const s = r + g + b;
        if (s < dMin) { dMin = s; dark = [r, g, b]; }
        if (s > lMax) { lMax = s; light = [r, g, b]; }
      }
    }
    return { color: toHex(dark[0], dark[1], dark[2]), bg: toHex(light[0], light[1], light[2]) };
  };

  const items = [];
  tc.items.forEach((it, idx) => {
    if (!it.str || !it.str.trim()) return;
    const t = pdfjsLib.Util.transform(vp.transform, it.transform);
    const fontPx = Math.hypot(t[2], t[3]);
    if (fontPx < 3) return; // ignore tiny/invisible runs
    const left = t[4];
    const top = t[5] - fontPx;
    const widthPx = (it.width || 0) * scale || fontPx * (it.str.length * 0.5);
    const st = styles[it.fontName] || {};
    const cls = classifyFont(st.fontFamily || it.fontName || '');
    const { color, bg } = sampleColors(left, top, Math.max(widthPx, fontPx * 0.6), fontPx * 1.25);
    items.push({
      id: `${pageIndex}-${idx}`,
      str: it.str,
      // preview-space (CSS px over the rendered image)
      left, top, widthPx, fontPx,
      // pdf-space (points, origin bottom-left) for export
      xPt: it.transform[4],
      yPt: it.transform[5],
      sizePt: Math.hypot(it.transform[0], it.transform[1]) || (fontPx / scale),
      widthPt: it.width || 0,
      color, bg,
      bold: cls.bold, italic: cls.italic, serif: cls.serif, mono: cls.mono,
    });
  });

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    pxW: canvas.width,
    pxH: canvas.height,
    ptW: vp1.width,
    ptH: vp1.height,
    total: doc.numPages,
    items,
  };
};

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return rgb(0.06, 0.09, 0.16);
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
};

// Apply a list of text edits to the original PDF and return saved bytes.
// edits: [{ pageIndex, xPt, yPt, sizePt, widthPt, text, color, bg, bold, italic, serif, mono }]
export const applyPdfTextEdits = async (file, edits) => {
  const docPdf = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
  const pages = docPdf.getPages();
  const cache = {};
  const pick = async ({ bold, italic, serif, mono }) => {
    let key;
    if (mono) key = bold ? (italic ? 'CourierBoldOblique' : 'CourierBold') : (italic ? 'CourierOblique' : 'Courier');
    else if (serif) key = bold ? (italic ? 'TimesRomanBoldItalic' : 'TimesRomanBold') : (italic ? 'TimesRomanItalic' : 'TimesRoman');
    else key = bold ? (italic ? 'HelveticaBoldOblique' : 'HelveticaBold') : (italic ? 'HelveticaOblique' : 'Helvetica');
    if (!cache[key]) cache[key] = await docPdf.embedFont(StandardFonts[key]);
    return cache[key];
  };

  for (const e of edits) {
    const page = pages[e.pageIndex];
    if (!page) continue;
    const font = await pick(e);
    const size = e.sizePt || 12;
    const coverW = Math.max(e.widthPt || 0, font.widthOfTextAtSize(e.text || '', size)) + 2;
    // cover the original glyphs with the sampled background colour
    page.drawRectangle({
      x: e.xPt - 1,
      y: e.yPt - size * 0.28,
      width: coverW,
      height: size * 1.32,
      color: hexToRgb(e.bg),
    });
    const drawWith = (txt) => page.drawText(txt, { x: e.xPt, y: e.yPt, size, font, color: hexToRgb(e.color) });
    try {
      drawWith(e.text || '');
    } catch (err) {
      // Standard fonts only encode WinAnsi; fall back to ASCII-safe text.
      drawWith((e.text || '').replace(/[^\x20-\x7E]/g, '?'));
    }
  }
  return docPdf.save();
};

// Compress a PDF trying to land at or below targetBytes. Returns { bytes, size }.
export const compressToTarget = async (file, targetBytes, { onProgress } = {}) => {
  const data = await readFile(file);
  // First, a cheap lossless re-save. If it already meets the target, use it.
  const lossless = await compressPdf(file);
  if (targetBytes && lossless.length <= targetBytes) {
    return { bytes: lossless, size: lossless.length };
  }

  const canvases = await renderPageCanvases(data, 2.0, onProgress);
  const scales = [1, 0.8, 0.62, 0.48, 0.36, 0.26];
  let best = null; // best <= target (highest quality)
  let smallest = null; // fallback: smallest overall

  const track = (bytes) => {
    if (!smallest || bytes.length < smallest.length) smallest = bytes;
  };

  outer: for (let si = 0; si < scales.length; si++) {
    const sf = scales[si];
    let lo = 0.28, hi = 0.9, found = null;
    for (let it = 0; it < 6; it++) {
      const q = (lo + hi) / 2;
      const bytes = await buildRasterPdf(canvases, sf, q);
      track(bytes);
      if (onProgress) onProgress(40 + Math.min(55, si * 9 + it * 1.5));
      if (!targetBytes || bytes.length <= targetBytes) {
        found = bytes; // meets target, try higher quality
        lo = q;
      } else {
        hi = q; // too big, lower quality
      }
    }
    if (found) { best = found; break outer; }
    // if even lowest quality at this scale is over target, go smaller scale
  }

  if (onProgress) onProgress(100);
  const chosen = best || smallest || lossless;
  return { bytes: chosen, size: chosen.length };
};
