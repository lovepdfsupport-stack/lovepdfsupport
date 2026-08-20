import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronRight, ChevronLeft, ChevronRight as ChevRight, PenTool, Type, Eraser, Download, Loader2, CheckCircle2, X, Trash2, Move, Image as ImageIcon, UploadCloud, Wand2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FileDrop from '../components/FileDrop';
import * as pdf from '../lib/pdfUtils';

const IMG_API = `${process.env.REACT_APP_BACKEND_URL}/api/image`;

const SIG_FONTS = [
  { id: "'Brush Script MT', cursive", label: 'Signature' },
  { id: "'Segoe Script', cursive", label: 'Script' },
  { id: "'Sora', sans-serif", label: 'Modern' },
];

const SignPad = ({ onChange }) => {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  const ctxOf = () => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ctxOf();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => { if (drawing.current) { drawing.current = false; onChange(ref.current.toDataURL('image/png')); } };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(null); };

  return (
    <div>
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white overflow-hidden">
        <canvas ref={ref} width={420} height={170} className="w-full touch-none cursor-crosshair"
          onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
      </div>
      <button onClick={clear} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-rose-500 transition-colors">
        <Eraser className="w-4 h-4" /> Clear
      </button>
    </div>
  );
};

const SignPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('draw');
  const [typed, setTyped] = useState('');
  const [font, setFont] = useState(SIG_FONTS[0].id);
  const [sig, setSig] = useState(null); // {dataUrl, ratio}
  const [box, setBox] = useState(null); // {x,y,w,h} in preview px
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  const imgInputRef = useRef(null);
  const stageRef = useRef(null);
  const drag = useRef(null);

  const loadPage = useCallback(async (f, idx) => {
    setLoading(true);
    try {
      const p = await pdf.renderPageImage(f, idx, 620);
      setPreview(p);
      setTotal(p.total);
    } catch (e) {
      setError('Could not read this PDF.');
    }
    setLoading(false);
  }, []);

  const onFiles = async (list) => {
    const f = list[0];
    setFile(f);
    setPageIndex(0);
    setResult(null);
    await loadPage(f, 0);
  };

  const goPage = async (dir) => {
    const next = Math.min(Math.max(0, pageIndex + dir), total - 1);
    if (next === pageIndex) return;
    setPageIndex(next);
    await loadPage(file, next);
  };

  const makeTyped = () => {
    if (!typed.trim()) return;
    const c = document.createElement('canvas');
    c.width = 500; c.height = 180;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `64px ${font}`;
    ctx.fillText(typed, c.width / 2, c.height / 2);
    setSig({ dataUrl: c.toDataURL('image/png'), ratio: c.height / c.width });
  };

  // Upload an image, auto-remove its background, and use it as the stamp.
  const onImagePick = async (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    setImgLoading(true); setError(''); setSig(null); setBox(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`${IMG_API}/remove-bg`, { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail || 'Could not remove the background from this image.');
      }
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const img = new Image();
      img.onload = () => setSig({ dataUrl, ratio: img.height / img.width });
      img.src = dataUrl;
    } catch (e) {
      setError(e.message || 'Background removal failed. Please try again.');
    }
    setImgLoading(false);
  };

  const addToPage = null; // placement handled automatically when a signature is created

  // place default box when a signature becomes available
  useEffect(() => {
    if (sig && preview && !box) {
      const w = Math.min(220, preview.pxW * 0.4);
      const h = w * (sig.ratio || 0.4);
      setBox({ x: (preview.pxW - w) / 2, y: preview.pxH - h - 40, w, h });
    }
  }, [sig, preview]);

  const onSigDraw = (dataUrl) => {
    if (!dataUrl) { setSig(null); setBox(null); return; }
    const img = new Image();
    img.onload = () => setSig({ dataUrl, ratio: img.height / img.width });
    img.src = dataUrl;
  };

  const startDrag = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    drag.current = { mode, startX: t.clientX, startY: t.clientY, box: { ...box } };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
  };
  const onDrag = (e) => {
    if (!drag.current) return;
    if (e.cancelable) e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - drag.current.startX;
    const dy = t.clientY - drag.current.startY;
    const b = drag.current.box;
    if (drag.current.mode === 'move') {
      let x = Math.max(0, Math.min(preview.pxW - b.w, b.x + dx));
      let y = Math.max(0, Math.min(preview.pxH - b.h, b.y + dy));
      setBox({ ...b, x, y });
    } else {
      let w = Math.max(50, Math.min(preview.pxW - b.x, b.w + dx));
      let h = w * (sig.ratio || 0.4);
      setBox({ ...b, w, h });
    }
  };
  const stopDrag = () => {
    drag.current = null;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('touchend', stopDrag);
  };

  const apply = async () => {
    if (!sig || !box) { setError('Create a signature and place it on the page first.'); return; }
    setBusy(true); setError('');
    try {
      const bytes = await pdf.placeSignature(file, {
        pageIndex, sigPngDataUrl: sig.dataUrl, box, preview,
      });
      setResult({ name: (file.name.replace(/\.pdf$/i, '') || 'document') + '_signed.pdf', bytes });
    } catch (e) {
      setError(e.message || 'Could not sign this PDF.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0d16] text-slate-900 dark:text-slate-100 transition-colors">
      <Header />
      <section className="relative overflow-hidden grid-hero border-b border-slate-200 dark:border-white/10">
        <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-violet-500/15 blur-[110px]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-6">
            <Link to="/" className="hover:text-rose-500">Home</Link><ChevronRight className="w-4 h-4" /><span className="text-slate-700 dark:text-slate-200 font-medium">Sign PDF</span>
          </div>
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-violet-500/12 text-violet-500 dark:text-violet-400"><PenTool className="w-8 h-8" /></div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-5">Sign PDF</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">Draw, type or upload an image (background removed automatically), then drag it exactly where you want on the page.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {result ? (
          <div className="rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/[0.06] p-8 text-center">
            <div className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-8 h-8" /></div>
            <h3 className="font-display font-bold text-2xl mt-5">Signed & ready!</h3>
            <button onClick={() => pdf.download(result.bytes, result.name)} className="mt-6 inline-flex items-center gap-2 btn-primary text-white font-semibold px-7 py-3.5 rounded-xl transition"><Download className="w-5 h-5" /> Download {result.name}</button>
            <button onClick={() => { setResult(null); }} className="mt-5 block mx-auto text-sm font-semibold text-slate-500 hover:text-rose-500">Sign another page</button>
          </div>
        ) : !file ? (
          <FileDrop accept=".pdf" multiple={false} onFiles={onFiles} label="Select PDF file" />
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            {/* Page preview */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { setFile(null); setPreview(null); setSig(null); setBox(null); }} className="text-sm font-medium text-slate-500 hover:text-rose-500 flex items-center gap-1"><X className="w-4 h-4" /> Change file</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => goPage(-1)} disabled={pageIndex === 0} className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-medium">Page {pageIndex + 1} / {total}</span>
                  <button onClick={() => goPage(1)} disabled={pageIndex >= total - 1} className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"><ChevRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex justify-center">
                {loading || !preview ? (
                  <div className="flex items-center gap-2 text-slate-500 py-20"><Loader2 className="w-5 h-5 animate-spin" /> Rendering page…</div>
                ) : (
                  <div ref={stageRef} className="relative shadow-lg rounded-md overflow-hidden" style={{ width: preview.pxW, height: preview.pxH }}>
                    <img src={preview.dataUrl} alt="page" width={preview.pxW} height={preview.pxH} draggable={false} />
                    {sig && box && (
                      <div className="absolute border-2 border-rose-500/80 border-dashed rounded-sm" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                        onMouseDown={(e) => startDrag(e, 'move')} onTouchStart={(e) => startDrag(e, 'move')}>
                        <img src={sig.dataUrl} alt="signature" className="w-full h-full pointer-events-none select-none" />
                        <span className="absolute -top-3 -left-3 grid place-items-center w-6 h-6 rounded-full bg-rose-500 text-white cursor-move"><Move className="w-3.5 h-3.5" /></span>
                        <span onMouseDown={(e) => startDrag(e, 'resize')} onTouchStart={(e) => startDrag(e, 'resize')}
                          className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-white border-2 border-rose-500 cursor-se-resize" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Signature panel */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 h-fit">
              <h3 className="font-display font-semibold mb-4">Your signature</h3>
              <div className="flex gap-2 mb-4 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
                {[{ id: 'draw', label: 'Draw', icon: PenTool }, { id: 'type', label: 'Type', icon: Type }, { id: 'image', label: 'Image', icon: ImageIcon }].map((t) => (
                  <button key={t.id} onClick={() => { setTab(t.id); setSig(null); setBox(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.id ? 'bg-white dark:bg-white/10 shadow-sm text-rose-500' : 'text-slate-500'}`}>
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>

              {tab === 'draw' && <SignPad onChange={onSigDraw} />}

              {tab === 'type' && (
                <div className="space-y-3">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" className="input" />
                  <div className="flex gap-2">
                    {SIG_FONTS.map((f) => (
                      <button key={f.id} onClick={() => setFont(f.id)} className={`flex-1 py-2 rounded-lg text-xs border ${font === f.id ? 'border-rose-400 text-rose-500' : 'border-slate-200 dark:border-white/10 text-slate-500'}`} style={{ fontFamily: f.id }}>Abc</button>
                    ))}
                  </div>
                  {typed && <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white p-3 text-center text-3xl text-slate-900" style={{ fontFamily: font }}>{typed}</div>}
                  <button onClick={makeTyped} disabled={!typed.trim()} className="w-full btn-primary text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">Use this signature</button>
                </div>
              )}

              {tab === 'image' && (
                <div className="space-y-3">
                  <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onImagePick(e.target.files)} />
                  {!sig && !imgLoading && (
                    <button onClick={() => imgInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-500/[0.05] transition-colors text-slate-500">
                      <UploadCloud className="w-7 h-7 text-rose-500" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Upload an image</span>
                      <span className="text-xs">JPG, PNG or WebP · background removed automatically</span>
                    </button>
                  )}
                  {imgLoading && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                      <span className="text-sm font-medium flex items-center gap-1.5"><Wand2 className="w-4 h-4" /> Removing background…</span>
                      <span className="text-xs">First run may take a few seconds.</span>
                    </div>
                  )}
                  {sig && !imgLoading && (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 grid place-items-center" style={{ backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' }}>
                        <img src={sig.dataUrl} alt="cutout" className="max-h-40 object-contain" />
                      </div>
                      <button onClick={() => imgInputRef.current?.click()} className="w-full text-sm font-semibold text-rose-500 hover:text-rose-600 py-1.5">Choose a different image</button>
                    </div>
                  )}
                </div>
              )}

              <p className="hint mt-4">{sig ? 'Drag the signature on the page, resize with the corner handle, then apply.' : 'Create a signature to place it on your document.'}</p>

              {error && <p className="text-sm text-rose-500 font-medium mt-3">{error}</p>}

              <button onClick={apply} disabled={busy || !sig} className="w-full mt-4 btn-primary text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing…</> : <><PenTool className="w-5 h-5" /> Apply & Download</>}
              </button>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

export default SignPage;
