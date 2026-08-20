# PDFPro Studio (LOVEPDF) — PRD

## Original Problem Statement
ilovepdf-style PDF tools website (repo: sanjusaharan10704-svg/LOVEPDF). Bug fix (PDF→Word on scanned PDFs), phir new features (Sign PDF drag-drop editor, Batch processing, Image tools, Name/DOB photo tool), aur `lovepdf.co.in` pe live deploy (Railway/Render Docker + MongoDB Atlas).

## User Choices
- Phase scope: SIRF bug fix pehle, baaki features baad me
- Background remover (future): rembg / remove.bg
- Deployment: Emergent preview pe ready + Railway/Render + DNS step-by-step guide (user khud karega)
- Light mode default (explicit requirement)

## Architecture
- Frontend: React (CRA), pdf-lib + pdfjs-dist@4.4.168 (client-side tools), Tailwind + shadcn
- Backend: FastAPI (/api/pdf/* router in pdf_tools.py), LibreOffice, Ghostscript, Tesseract, Poppler, pikepdf, ocrmypdf, pdf2docx, pdfplumber
- DB: MongoDB (status checks only for now)
- System deps recorded in /app/.emergent/system_deps.txt (libreoffice, ghostscript, tesseract-ocr, poppler-utils)

## Implemented (June 2026)
### Phase C — UX round (testing agent verified 100%)
- Merge PDF ab PDFs + images (JPG/PNG/WebP) mix accept karta hai (images full pages bante hain)
- Auto-download on completion (download button bhi rehta hai) — ToolPage + image tools
- Word download bug fixed: CORS expose Content-Disposition, OCR text XML-sanitize, pdf2docx output validation + OCR fallback
- Hero search suggestions dropdown (solid bg, z-40 stacking fix, polished look with category chips)
- Header: Image Tools dropdown (NEW badge), All Tools grouped by category, logo→home+scroll-top
- ScrollToTop on route change/refresh; rebrand PDFPro → LovePDF (logo, footer, title); outline default off in photo-text

### Phase B — File Preview + Image Tools (testing agent verified 100%)
- File Preview: PDF first-page render + image preview before processing (ToolPage single + multi-file thumbnails via MultiThumb)
- Compress Image (/tool/compress-image): backend Pillow, quality slider + max-width presets, before/after size
- Crop Image (/tool/crop-image): react-easy-crop, preset aspects + exact custom px output, client-side
- Remove Background (/tool/remove-background): remove.bg API via backend (/api/image/remove-bg, REMOVEBG_API_KEY in backend/.env, 50 calls/month free quota)
- Photo Name & DOB (/tool/photo-text): live canvas, 9 position presets, 6 fonts, color picker, size slider, outline toggle, JPG download
- New backend router /app/backend/image_tools.py (/api/image/*); new page /app/frontend/src/pages/ImageToolPage.jsx
- Home: 'Image tools' category, 30 tools total

### Phase A — Bug fix
- Repo cloned from GitHub into this environment (backend + frontend code)
- All Python/Node deps installed; pdfjs-dist pinned to 4.4.168 (node 20 compatible)
- **BUG FIX (root cause):** pdf2docx scanned/image-only PDFs pe text extract nahi karta tha
  - `_has_text_layer()` (pdfplumber) detects missing text layer
  - `_scanned_pdf_to_docx()` runs ocrmypdf (sidecar) → builds editable docx via python-docx
  - Same OCR fallback in pdf-to-excel
- Default theme changed dark → light (ThemeContext.jsx)
- Testing agent verified E2E: real UI upload for text + scanned PDFs → valid docx with correct text; merge, protect, repair, health all pass (backend 6/6, frontend 100% critical)
- Regression suite: /app/backend/tests/test_pdf_tools.py (pytest)

## Known / Notes
- Landing stats/reviews are MOCK (sample data) — user aware
- qpdf not installed (not needed by current tools)
- No file-size limits on uploads (noted, not MVP-blocking)
- Some tools marked "soon" badge if not ready && no server config; all 26 slugs routable

## Backlog (priority order)
- DONE (July 2025): Edit PDF (/tool/edit-pdf) — click any text to edit inline, matched standard font (size/color/position/bold/italic/serif), pdf-lib cover+redraw export. Client-side (pdfjs extractPageText + applyPdfTextEdits in lib/pdfUtils.js). NOTE: original text is visually covered but still remains in the file's text layer (copy/search reveals old text) — true content-stream removal is a future enhancement.
- DONE (July 2025): Reinstalled system tools (LibreOffice, Ghostscript, Tesseract, Poppler) — /api/pdf/health now true for soffice/gs/tesseract/pdftoppm. Recreated missing backend/.env + frontend/.env.
- P0: Batch processing (multi-file upload → same tool on all → zip download)
- P1: Edit PDF v2 — add-new-text-box + delete/whiteout regions; true text removal
- P2: Deployment guide — Railway/Render Docker image, MongoDB Atlas, lovepdf.co.in DNS (A/CNAME + api subdomain), SSL
- P2: Replace mock stats/reviews or label as "sample"
