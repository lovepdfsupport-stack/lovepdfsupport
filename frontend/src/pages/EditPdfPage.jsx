import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ChevronRight as ChevRight, PenLine, Download, Loader2, CheckCircle2, X, RotateCcw, MousePointerClick } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileDrop from '../components/FileDrop';
import * as pdf from '../lib/pdfUtils';

const fontCss = (it) => {
  const weight = it.bold ? 700 : 400;
  const style = it.italic ? 'italic' : 'normal';
  const family = it.mono
    ? 'ui-monospace, "Courier New", monospace'
    : it.serif
    ? 'Georgia, "Times New Roman", serif'
    : 'Helvetica, Arial, sans-serif';
  return { fontWeight: weight, fontStyle: style, fontFamily: family };
};

const EditPdfPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // extractPageText result for current page
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({}); // key -> { pageIndex, item, text }
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (f, idx) => {
    setLoading(true);
    setError('');
    try {
      const p = await pdf.extractPageText(f, idx, 760);
      setPreview(p);
      setTotal(p.total);
    } catch (e) {
      setError('Could not read this PDF. It may be scanned (image-only) or password protected.');
    }
    setLoading(false);
  }, []);

  const onFiles = async (list) => {
    const f = list[0];
    setFile(f);
    setPageIndex(0);
    setEdits({});
    setResult(null);
    setEditingId(null);
    await loadPage(f, 0);
  };

  const goPage = async (dir) => {
    const next = Math.min(Math.max(0, pageIndex + dir), total - 1);
    if (next === pageIndex) return;
    setEditingId(null);
    setPageIndex(next);
    await loadPage(file, next);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEdits((prev) =>
      prev[item.id] ? prev : { ...prev, [item.id]: { pageIndex, item, text: item.str } }
    );
  };

  const changeText = (item, value) => {
    setEdits((prev) => ({ ...prev, [item.id]: { pageIndex, item, text: value } }));
  };

  const editedCount = Object.values(edits).filter((e) => e.text !== e.item.str).length;

  const resetAll = () => {
    setEdits({});
    setEditingId(null);
    setResult(null);
  };

  const download = async () => {
    const list = Object.values(edits)
      .filter((e) => e.text !== e.item.str)
      .map((e) => ({
        pageIndex: e.pageIndex,
        xPt: e.item.xPt,
        yPt: e.item.yPt,
        sizePt: e.item.sizePt,
        widthPt: e.item.widthPt,
        color: e.item.color,
        bg: e.item.bg,
        bold: e.item.bold,
        italic: e.item.italic,
        serif: e.item.serif,
        mono: e.item.mono,
        text: e.text,
      }));
    if (!list.length) return;
    setBusy(true);
    setError('');
    try {
      const bytes = await pdf.applyPdfTextEdits(file, list);
      const name = (file.name || 'document').replace(/\.pdf$/i, '') + '-edited.pdf';
      pdf.download(bytes, name);
      setResult({ name });
    } catch (e) {
      setError('Something went wrong while saving your edits. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0d16] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />
      <section className="relative overflow-hidden grid-hero border-b border-slate-200 dark:border-white/10">
        <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-rose-500/15 blur-[110px]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-6">
            <Link to="/" className="hover:text-rose-500">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-700 dark:text-slate-200 font-medium">Edit PDF</span>
          </div>
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-rose-500/12 text-rose-500 dark:text-rose-400">
            <PenLine className="w-8 h-8" />
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-5">Edit PDF</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">
            Click any text in your document to edit it inline. We keep the size, colour and style close to the original, then export a fresh PDF.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {result ? (
          <div className="rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/[0.06] p-8 text-center">
            <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-8 h-8" /></div>
            <h3 className="font-display font-bold text-2xl mt-5">Your edited PDF is ready!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Saved {editedCount} edit{editedCount === 1 ? '' : 's'} to <span className="font-medium">{result.name}</span>.</p>
            <button onClick={download} className="mt-6 inline-flex items-center gap-2 btn-primary text-white font-semibold px-7 py-3.5 rounded-xl transition"><Download className="w-5 h-5" /> Download again</button>
            <button onClick={() => setResult(null)} className="mt-5 block mx-auto text-sm font-semibold text-slate-500 hover:text-rose-500">Keep editing</button>
          </div>
        ) : !file ? (
          <FileDrop accept=".pdf" multiple={false} onFiles={onFiles} label="Select PDF file" />
        ) : (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => { setFile(null); setPreview(null); setEdits({}); }} className="text-sm font-medium text-slate-500 hover:text-rose-500 flex items-center gap-1"><X className="w-4 h-4" /> Change file</button>
              <div className="flex items-center gap-3">
                <button onClick={() => goPage(-1)} disabled={pageIndex === 0} className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium">Page {pageIndex + 1} / {total}</span>
                <button onClick={() => goPage(1)} disabled={pageIndex >= total - 1} className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"><ChevRight className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3">
                {editedCount > 0 && (
                  <button onClick={resetAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-500"><RotateCcw className="w-4 h-4" /> Reset</button>
                )}
                <button onClick={download} disabled={busy || editedCount === 0} className="inline-flex items-center gap-2 btn-primary text-white font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download{editedCount > 0 ? ` (${editedCount})` : ''}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5">
              <MousePointerClick className="w-4 h-4 text-rose-500 shrink-0" />
              Click any highlighted text on the page to edit it. Edited text is re-drawn with the closest matching standard font.
            </div>

            {error && <div className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-2.5">{error}</div>}

            {/* Stage */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] p-4 sm:p-6 overflow-auto">
              <div className="flex justify-center">
                {loading || !preview ? (
                  <div className="flex items-center gap-2 text-slate-500 py-24"><Loader2 className="w-5 h-5 animate-spin" /> Reading page…</div>
                ) : (
                  <div className="relative shadow-xl rounded-md overflow-hidden bg-white" style={{ width: preview.pxW, height: preview.pxH }}>
                    <img src={preview.dataUrl} alt={`page ${pageIndex + 1}`} className="block select-none pointer-events-none" style={{ width: preview.pxW, height: preview.pxH }} draggable={false} />
                    {preview.items.map((it) => {
                      const edit = edits[it.id];
                      const isEdited = edit && edit.text !== it.str;
                      const isActive = editingId === it.id || isEdited;
                      const css = fontCss(it);
                      const commonStyle = {
                        position: 'absolute',
                        left: it.left,
                        top: it.top,
                        height: it.fontPx * 1.25,
                        fontSize: it.fontPx * 0.92,
                        lineHeight: `${it.fontPx * 1.25}px`,
                        ...css,
                      };
                      if (isActive) {
                        const val = edit ? edit.text : it.str;
                        const w = Math.max(it.widthPx, (val.length + 1) * it.fontPx * 0.5, 12);
                        return (
                          <input
                            key={it.id}
                            autoFocus={editingId === it.id}
                            value={val}
                            onChange={(e) => changeText(it, e.target.value)}
                            onFocus={() => setEditingId(it.id)}
                            onBlur={() => setEditingId(null)}
                            spellCheck={false}
                            style={{
                              ...commonStyle,
                              width: w,
                              color: it.color,
                              background: it.bg,
                              border: editingId === it.id ? '1px solid rgba(244,63,94,0.9)' : '1px dashed rgba(244,63,94,0.45)',
                              borderRadius: 3,
                              padding: 0,
                              paddingLeft: 1,
                              outline: 'none',
                              boxSizing: 'content-box',
                              zIndex: editingId === it.id ? 30 : 10,
                            }}
                          />
                        );
                      }
                      return (
                        <div
                          key={it.id}
                          onClick={() => startEdit(it)}
                          title="Click to edit"
                          style={{
                            ...commonStyle,
                            width: it.widthPx,
                            color: 'transparent',
                            cursor: 'text',
                            borderRadius: 3,
                            whiteSpace: 'pre',
                            overflow: 'hidden',
                          }}
                          className="hover:bg-rose-400/20 hover:outline hover:outline-1 hover:outline-rose-400/60"
                        >
                          {it.str}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

export default EditPdfPage;
