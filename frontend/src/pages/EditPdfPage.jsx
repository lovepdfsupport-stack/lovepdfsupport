import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Save, Download, Loader2, X, CheckCircle2, MousePointerClick,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type,
  ZoomIn, ZoomOut, PenLine, Shapes, StickyNote, FormInput, Image as ImageIcon,
  RotateCcw, Minus, Plus,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileDrop from '../components/FileDrop';
import * as pdf from '../lib/pdfUtils';

const TABS = [
  { id: 'annotate', label: 'Annotate', icon: StickyNote },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'insert', label: 'Insert', icon: ImageIcon },
  { id: 'edit-text', label: 'Edit Text', icon: Type },
  { id: 'forms', label: 'Forms', icon: FormInput },
];

const FAMILIES = [
  { id: 'sans', label: 'Sans · Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { id: 'serif', label: 'Serif · Times', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono · Courier', css: 'ui-monospace, "Courier New", monospace' },
];
const famCss = (id) => (FAMILIES.find((f) => f.id === id) || FAMILIES[0]).css;

const StyleToggle = ({ active, onClick, title, children }) => (
  <button type="button" onClick={onClick} title={title}
    className={`grid place-items-center w-9 h-9 rounded-lg border transition-colors ${active ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
    {children}
  </button>
);

const deriveStyle = (it) => ({
  family: it.mono ? 'mono' : it.serif ? 'serif' : 'sans',
  size: Math.max(6, Math.round(it.sizePt)),
  bold: !!it.bold,
  italic: !!it.italic,
  underline: false,
  color: (it.color || '#0f172a').slice(0, 7),
  align: 'left',
});

const EditPdfPage = () => {
  const [file, setFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [thumbs, setThumbs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('edit-text');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (f, idx) => {
    setLoading(true); setError('');
    try {
      const p = await pdf.extractPageText(f, idx, 780);
      setPreview(p); setTotal(p.total);
    } catch (e) {
      setError('Could not read this PDF. It may be scanned (image-only) or password protected.');
    }
    setLoading(false);
  }, []);

  const onFiles = async (list) => {
    const f = list[0];
    setFile(f); setDocName(f.name || 'document.pdf');
    setPageIndex(0); setEdits({}); setSelectedId(null); setResult(null); setZoom(1);
    await loadPage(f, 0);
    try {
      const t = await pdf.renderThumbnails(f, 60, 0.28);
      setThumbs(t.thumbs); setTotal(t.total);
    } catch (e) { /* thumbnails optional */ }
  };

  const goPage = async (idx) => {
    if (idx === pageIndex || idx < 0 || idx >= total) return;
    setSelectedId(null); setPageIndex(idx);
    await loadPage(file, idx);
  };

  const selectItem = (it) => {
    setActiveTab('edit-text');
    setSelectedId(it.id);
    setEdits((prev) => (prev[it.id] ? prev : { ...prev, [it.id]: { pageIndex, item: it, text: it.str, style: deriveStyle(it), touched: false } }));
  };

  const patchText = (id, text) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], text, touched: true } }));
  const patchStyle = (id, patch) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], style: { ...prev[id].style, ...patch }, touched: true } }));
  const resetOne = (id) => {
    setEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedId === id) setSelectedId(null);
  };

  const touchedList = Object.entries(edits).filter(([, e]) => e.touched);
  const editedCount = touchedList.length;

  const save = async () => {
    if (!editedCount) return;
    setBusy(true); setError('');
    try {
      const list = touchedList.map(([, e]) => ({
        pageIndex: e.pageIndex,
        xPt: e.item.xPt, yPt: e.item.yPt, widthPt: e.item.widthPt, bg: e.item.bg,
        text: e.text,
        family: e.style.family, bold: e.style.bold, italic: e.style.italic,
        underline: e.style.underline, size: e.style.size, color: e.style.color, align: e.style.align,
      }));
      const bytes = await pdf.applyPdfTextEdits(file, list);
      const name = (docName || 'document').replace(/\.pdf$/i, '') + '-edited.pdf';
      pdf.download(bytes, name);
      setResult({ name });
    } catch (e) {
      setError('Something went wrong while saving your changes. Please try again.');
    }
    setBusy(false);
  };

  const scale = preview ? preview.pxW / preview.ptW : 1;
  const selectedEntry = selectedId ? edits[selectedId] : null;

  const renderEditTextPanel = () => {
    if (!selectedEntry) {
      return (
        <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          <div className="grid place-items-center w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 mb-3"><MousePointerClick className="w-6 h-6" /></div>
          Click any text on the page to select it. Then change its words, font, size, colour, weight and alignment here.
        </div>
      );
    }
    const st = selectedEntry.style;
    const id = selectedId;
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Text</label>
          <textarea value={selectedEntry.text} onChange={(e) => patchText(id, e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-rose-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Font</label>
          <select value={st.family} onChange={(e) => patchStyle(id, { family: e.target.value })}
            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-rose-400">
            {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Size</label>
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
              <button type="button" onClick={() => patchStyle(id, { size: Math.max(6, st.size - 1) })} className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><Minus className="w-4 h-4" /></button>
              <input type="number" min={6} max={200} value={st.size} onChange={(e) => patchStyle(id, { size: Math.max(6, Math.min(200, parseInt(e.target.value || '0', 10) || 6)) })}
                className="w-full text-center text-sm bg-transparent outline-none py-2" />
              <button type="button" onClick={() => patchStyle(id, { size: Math.min(200, st.size + 1) })} className="px-2.5 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Colour</label>
            <input type="color" value={st.color} onChange={(e) => patchStyle(id, { color: e.target.value })}
              className="w-11 h-10 rounded-lg border border-slate-200 dark:border-white/10 bg-white cursor-pointer" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Style</label>
          <div className="flex gap-2">
            <StyleToggle active={st.bold} onClick={() => patchStyle(id, { bold: !st.bold })} title="Bold"><Bold className="w-4 h-4" /></StyleToggle>
            <StyleToggle active={st.italic} onClick={() => patchStyle(id, { italic: !st.italic })} title="Italic"><Italic className="w-4 h-4" /></StyleToggle>
            <StyleToggle active={st.underline} onClick={() => patchStyle(id, { underline: !st.underline })} title="Underline"><Underline className="w-4 h-4" /></StyleToggle>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Alignment</label>
          <div className="flex gap-2">
            <StyleToggle active={st.align === 'left'} onClick={() => patchStyle(id, { align: 'left' })} title="Align left"><AlignLeft className="w-4 h-4" /></StyleToggle>
            <StyleToggle active={st.align === 'center'} onClick={() => patchStyle(id, { align: 'center' })} title="Align center"><AlignCenter className="w-4 h-4" /></StyleToggle>
            <StyleToggle active={st.align === 'right'} onClick={() => patchStyle(id, { align: 'right' })} title="Align right"><AlignRight className="w-4 h-4" /></StyleToggle>
          </div>
        </div>
        <button type="button" onClick={() => resetOne(id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-500"><RotateCcw className="w-4 h-4" /> Reset this text</button>
      </div>
    );
  };

  const comingSoon = (label) => (
    <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
      <div className="grid place-items-center w-12 h-12 rounded-xl bg-slate-500/10 text-slate-400 mb-3"><Shapes className="w-6 h-6" /></div>
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      This workspace is coming soon. For now, use <span className="font-semibold text-rose-500">Edit Text</span> to change any text in your PDF.
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0d16] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />

      {!file ? (
        <section className="relative overflow-hidden grid-hero border-b border-slate-200 dark:border-white/10">
          <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-rose-500/15 blur-[110px]" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
            <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-6">
              <Link to="/" className="hover:text-rose-500">Home</Link><ChevronRight className="w-4 h-4" /><span className="text-slate-700 dark:text-slate-200 font-medium">Edit PDF</span>
            </div>
            <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-rose-500/12 text-rose-500 dark:text-rose-400"><PenLine className="w-8 h-8" /></div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-5">Edit PDF</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">A professional PDF editor in your browser. Click any text to change its words, font, size, colour and style — then save a fresh PDF.</p>
            <div className="mt-8"><FileDrop accept=".pdf" multiple={false} onFiles={onFiles} label="Select PDF file" /></div>
          </div>
        </section>
      ) : result ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/[0.06] p-8 text-center">
            <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-8 h-8" /></div>
            <h3 className="font-display font-bold text-2xl mt-5">Your edited PDF is ready!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Saved {editedCount} change{editedCount === 1 ? '' : 's'} to <span className="font-medium">{result.name}</span>.</p>
            <button onClick={save} className="mt-6 inline-flex items-center gap-2 btn-primary text-white font-semibold px-7 py-3.5 rounded-xl transition"><Download className="w-5 h-5" /> Download again</button>
            <button onClick={() => setResult(null)} className="mt-5 block mx-auto text-sm font-semibold text-slate-500 hover:text-rose-500">Keep editing</button>
          </div>
        </section>
      ) : (
        <section className="max-w-[1400px] mx-auto px-3 sm:px-4 py-5">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => { setFile(null); setPreview(null); setEdits({}); setThumbs([]); }} className="text-sm font-medium text-slate-500 hover:text-rose-500 flex items-center gap-1 shrink-0"><X className="w-4 h-4" /> Close</button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{docName}</span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 order-3 sm:order-2 w-full sm:w-auto overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-white dark:bg-white/10 shadow-sm text-rose-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={busy || editedCount === 0}
              className="order-2 sm:order-3 inline-flex items-center gap-2 btn-primary text-white font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes{editedCount > 0 ? ` (${editedCount})` : ''}
            </button>
          </div>

          {error && <div className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

          <div className="flex gap-4">
            {/* Left: thumbnails */}
            <aside className="hidden md:block w-36 shrink-0">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-2 h-[74vh] overflow-y-auto">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-2 py-1.5">Pages</p>
                <div className="space-y-2">
                  {(thumbs.length ? thumbs : [{ index: pageIndex, url: null }]).map((th) => (
                    <button key={th.index} onClick={() => goPage(th.index)}
                      className={`block w-full rounded-lg overflow-hidden border-2 transition ${th.index === pageIndex ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-white/10 hover:border-rose-300'}`}>
                      {th.url ? <img src={th.url} alt={`Page ${th.index + 1}`} className="w-full block" /> : <div className="aspect-[3/4] bg-white" />}
                      <span className="block text-[11px] font-medium text-slate-500 py-1">{th.index + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Center: canvas + zoom */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 mb-3">
                <MousePointerClick className="w-4 h-4 text-rose-500 shrink-0" />
                Click any highlighted text to edit and restyle it. Changes save into a fresh PDF.
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/20 overflow-auto h-[68vh] grid place-items-start justify-center p-6">
                {loading || !preview ? (
                  <div className="flex items-center gap-2 text-slate-500 place-self-center"><Loader2 className="w-5 h-5 animate-spin" /> Reading page…</div>
                ) : (
                  <div style={{ width: preview.pxW * zoom, height: preview.pxH * zoom }}>
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: preview.pxW, height: preview.pxH }}
                      className="relative bg-white shadow-xl" onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                      <img src={preview.dataUrl} alt={`page ${pageIndex + 1}`} className="block select-none pointer-events-none" style={{ width: preview.pxW, height: preview.pxH }} draggable={false} />
                      {preview.items.map((it) => {
                        const entry = edits[it.id];
                        const st = entry ? entry.style : deriveStyle(it);
                        const text = entry ? entry.text : it.str;
                        const active = selectedId === it.id || (entry && entry.touched);
                        const fontPx = st.size * scale;
                        const baselinePx = it.top + it.fontPx;
                        const top = baselinePx - fontPx;
                        if (active) {
                          const w = Math.max(it.widthPx, (text.length + 1) * fontPx * 0.5, 14);
                          return (
                            <input key={it.id} value={text}
                              onChange={(e) => patchText(it.id, e.target.value)}
                              onFocus={() => selectItem(it)}
                              spellCheck={false}
                              style={{
                                position: 'absolute', left: it.left, top,
                                width: w, height: fontPx * 1.32,
                                fontFamily: famCss(st.family), fontSize: fontPx * 0.92,
                                lineHeight: `${fontPx * 1.32}px`,
                                fontWeight: st.bold ? 700 : 400, fontStyle: st.italic ? 'italic' : 'normal',
                                textDecoration: st.underline ? 'underline' : 'none',
                                textAlign: st.align, color: st.color, background: it.bg,
                                border: selectedId === it.id ? '1px solid rgba(244,63,94,0.9)' : '1px dashed rgba(244,63,94,0.45)',
                                borderRadius: 3, padding: 0, paddingLeft: 1, outline: 'none',
                                boxSizing: 'content-box', zIndex: selectedId === it.id ? 30 : 10,
                              }} />
                          );
                        }
                        return (
                          <div key={it.id} onClick={() => selectItem(it)} title="Click to edit"
                            style={{
                              position: 'absolute', left: it.left, top: it.top,
                              width: it.widthPx, height: it.fontPx * 1.25,
                              fontSize: it.fontPx * 0.92, lineHeight: `${it.fontPx * 1.25}px`,
                              fontFamily: famCss(st.family), color: 'transparent',
                              cursor: 'text', borderRadius: 3, whiteSpace: 'pre', overflow: 'hidden',
                            }}
                            className="hover:bg-rose-400/20 hover:outline hover:outline-1 hover:outline-rose-400/60">
                            {it.str}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* Bottom zoom bar */}
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-sm text-slate-500">Page {pageIndex + 1} of {total}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="grid place-items-center w-9 h-9 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><ZoomOut className="w-4 h-4" /></button>
                  <span className="text-sm font-semibold w-14 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="grid place-items-center w-9 h-9 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={() => setZoom(1)} className="text-sm font-medium text-slate-500 hover:text-rose-500 ml-1">Fit</button>
                </div>
              </div>
            </div>

            {/* Right: styling panel */}
            <aside className="w-72 shrink-0 hidden lg:block">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 h-[74vh] overflow-y-auto">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  {(TABS.find((t) => t.id === activeTab) || {}).label}
                </h3>
                {activeTab === 'edit-text' ? renderEditTextPanel()
                  : activeTab === 'annotate' ? comingSoon('Annotate')
                  : activeTab === 'shapes' ? comingSoon('Shapes')
                  : activeTab === 'insert' ? comingSoon('Insert')
                  : comingSoon('Forms')}
              </div>
            </aside>
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
};

export default EditPdfPage;
