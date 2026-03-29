import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Upload,
  Clipboard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCcw,
  Lock,
  Info,
  Search,
} from 'lucide-react';
import { postText, postImage } from './api/analyses.api.js';
import { useAnalysisStream } from './hooks/useAnalysisStream.js';
import { useSmsShield } from './hooks/useSmsShield.js';
import { SseEventType, Verdict } from '@marie/shared';
import type { AnalysisResult } from '@marie/shared';

// ── Capacitor Clipboard (native Android) ─────────────────────────────────────
type CapClipboard = { read(): Promise<{ type: string; value: string }> };
function getCapClipboard(): CapClipboard | null {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?(): boolean; Plugins?: Record<string, unknown> } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.Clipboard as CapClipboard) ?? null;
}

import marieVertSrc from './assets/marie-vert.svg';
import marieJauneSrc from './assets/marie-jaune.svg';
import marieRougeSrc from './assets/marie-rouge.svg';

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'web' | 'mobile';

interface UICheck {
  title: string;
  status: 'safe' | 'suspicious' | 'danger';
  explanation: string;
}

interface UIResult {
  score: number;
  level: 1 | 2 | 3;
  summary: string;
  actions: string[];
  checks: UICheck[];
  notice?: string;
}

function mapResult(r: AnalysisResult): UIResult {
  const level: 1 | 2 | 3 =
    r.verdict === Verdict.LikelySafe ? 1 : r.verdict === Verdict.Suspicious ? 2 : 3;
  const checks: UICheck[] = r.auditSections.map((s) => ({
    title: s.label,
    status: s.severity === 'info' ? 'safe' : s.severity === 'warning' ? 'suspicious' : 'danger',
    explanation: s.summary,
  }));
  return {
    score: Math.min(99, Math.max(1, r.riskScore)),
    level,
    summary: r.shortSummary,
    actions: r.recommendedActions,
    checks,
    notice: r.notice,
  };
}

// ── Marie character ───────────────────────────────────────────────────────────

interface MarieFigureProps {
  phase: 'input' | 'analyzing' | 'result';
  result: UIResult | null;
}

function MarieFigure({ phase, result }: MarieFigureProps) {
  let src = marieJauneSrc;
  if (phase === 'result' && result) {
    if (result.level === 1) src = marieVertSrc;
    else if (result.level === 3) src = marieRougeSrc;
  }
  const isAnalyzing = phase === 'analyzing';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={src}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.35 }}
      >
        <motion.img
          src={src}
          alt="Marie"
          className="h-28 w-auto drop-shadow-md"
          animate={{ y: [0, isAnalyzing ? -14 : -7, 0] }}
          transition={{
            repeat: Infinity,
            duration: isAnalyzing ? 0.9 : 3,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

// ── CircularGauge ─────────────────────────────────────────────────────────────

function CircularGauge({ score, level }: { score: number; level: 1 | 2 | 3 }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = level === 1 ? '#22c55e' : level === 2 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-200" />
        <motion.circle
          cx="96" cy="96" r={radius}
          stroke={color} strokeWidth="12" fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold text-marie-dark">{score}</span>
        <span className="text-xs uppercase tracking-widest text-marie-dark/60 font-semibold">Risque</span>
      </div>
    </div>
  );
}

// ── AnalysisStep ──────────────────────────────────────────────────────────────

interface AnalysisStepProps {
  label: string;
  active: boolean;
  completed: boolean;
  failed?: boolean;
  depth?: number;
}

function AnalysisStep({ label, active, completed, failed = false, depth = 0 }: AnalysisStepProps) {
  return (
    <div
      className={`flex items-center gap-3 py-1 transition-opacity ${active || completed || failed ? 'opacity-100' : 'opacity-30'}`}
      style={{ paddingLeft: depth ? `${depth * 1.5 + 0.25}rem` : undefined }}
    >
      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
        failed ? 'bg-red-400' : completed ? 'bg-green-500' : active ? 'bg-marie-blue animate-pulse' : 'bg-gray-200'
      }`}>
        {failed ? (
          <XCircle className="w-3 h-3 text-white" />
        ) : completed ? (
          <CheckCircle2 className="w-3 h-3 text-white" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-white' : 'bg-gray-400'}`} />
        )}
      </div>
      <span className={`text-sm leading-tight ${active ? 'font-semibold text-marie-dark' : failed ? 'text-red-500' : 'text-marie-dark/60'}`}>
        {label}
      </span>
    </div>
  );
}

// ── ConfirmSheet ──────────────────────────────────────────────────────────────

function ConfirmSheet({ preview, onConfirm, onCancel }: { preview: string; onConfirm: () => void; onCancel: () => void }) {
  const short = preview.length > 200 ? preview.slice(0, 200) + '…' : preview;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-t-3xl p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
        <h3 className="text-lg font-semibold text-marie-dark text-center">Analyser ce message ?</h3>
        <p className="text-sm text-marie-dark/60 bg-gray-50 rounded-2xl p-4 leading-relaxed">{short}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 py-3 text-sm">Annuler</button>
          <button onClick={onConfirm} className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2">
            Analyser <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── AnalysisStreamView ────────────────────────────────────────────────────────

interface OpState {
  id: string;
  label: string;
  status: 'running' | 'completed' | 'failed';
  parentId?: string;
}

interface AnalysisStreamViewProps {
  analysisId: string;
  viewMode: ViewMode;
  onComplete: (result: UIResult) => void;
  onError: (error: string) => void;
}

function AnalysisStreamView({ analysisId, viewMode, onComplete, onError }: AnalysisStreamViewProps) {
  const { events, result, status, error } = useAnalysisStream(analysisId);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    if (status === 'completed' && result) {
      calledRef.current = true;
      onComplete(mapResult(result));
    } else if (status === 'failed' && error) {
      calledRef.current = true;
      onError(error);
    }
  }, [status, result, error, onComplete, onError]);

  const ops = useMemo(() => {
    const map = new Map<string, OpState>();
    for (const ev of events) {
      if (ev.event === SseEventType.OperationStarted) {
        map.set(ev.data.operationId, {
          id: ev.data.operationId,
          label: ev.data.label,
          status: 'running',
          parentId: ev.data.parentOperationId,
        });
      } else if (ev.event === SseEventType.OperationCompleted) {
        const op = map.get(ev.data.operationId);
        if (op) map.set(op.id, { ...op, status: 'completed' });
      } else if (ev.event === SseEventType.OperationFailed) {
        const op = map.get(ev.data.operationId);
        if (op) map.set(op.id, { ...op, status: 'failed' });
      }
    }
    return [...map.values()];
  }, [events]);

  return (
    <motion.div
      key="analyzing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`glass-card p-6 space-y-4 ${viewMode === 'web' ? 'max-w-2xl mx-auto' : ''}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-marie-blue/10 rounded-full flex items-center justify-center">
          <Search className="w-6 h-6 text-marie-blue animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-marie-dark">Analyse en cours...</h2>
      </div>

      <div className="space-y-1">
        {ops.length === 0 ? (
          <AnalysisStep label="Connexion à l'API…" active={true} completed={false} />
        ) : (
          ops.map((op) => (
            <AnalysisStep
              key={op.id}
              label={op.label}
              active={op.status === 'running'}
              completed={op.status === 'completed'}
              failed={op.status === 'failed'}
              depth={op.parentId ? 1 : 0}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── EmergencyScreen ───────────────────────────────────────────────────────────

function EmergencyScreen({ viewMode, onBack }: { viewMode: ViewMode; onBack: () => void }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className={`min-h-screen mx-auto px-6 py-8 flex flex-col gap-8 ${viewMode === 'mobile' ? 'max-w-md' : 'max-w-5xl'}`}>
      <header className="flex items-center justify-between">
        <h1 className="text-[2.15rem] font-semibold text-red-600 leading-[1.1] tracking-tight">
          Un risque semble être présent,<br />
          <span className="text-2xl opacity-90">je vous aide à réagir</span>
        </h1>
        {viewMode === 'web' && (
          <button onClick={onBack} className="p-3 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors text-marie-dark font-semibold">
            Retour à l'accueil
          </button>
        )}
      </header>

      <main className={viewMode === 'web' ? 'grid grid-cols-1 md:grid-cols-2 gap-12 items-start' : 'space-y-8'}>
        <div className="space-y-8">
          <section className="space-y-4 text-left">
            <h2 className="text-lg font-semibold text-marie-dark flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              À faire tout de suite
            </h2>
            <ul className="space-y-3">
              <li className="flex gap-3 p-4 bg-red-600 rounded-2xl border border-red-700 text-sm text-white shadow-md">
                <span className="font-semibold">•</span>
                Contactez votre banque si vous avez donné des informations ou effectué un paiement
              </li>
              <li className="flex gap-3 p-4 bg-red-600 rounded-2xl border border-red-700 text-sm text-white shadow-md">
                <span className="font-semibold">•</span>
                Changez vos mots de passe si vous en avez saisi
              </li>
            </ul>
          </section>

          <section className="space-y-4 text-left">
            <h2 className="text-lg font-semibold text-marie-dark flex items-center gap-2">
              <Shield className="w-5 h-5 text-marie-blue" />
              Pour limiter les risques
            </h2>
            <ul className="space-y-3">
              {['Ne cliquez plus sur le lien', 'Bloquez l\'expéditeur', 'Conservez le message comme preuve'].map((item) => (
                <li key={item} className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-100 text-sm">
                  <span className="font-semibold text-marie-blue">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-8">
          <section className="space-y-4 text-left">
            <h2 className="text-lg font-semibold text-marie-dark flex items-center gap-2">
              <Info className="w-5 h-5 text-marie-blue" />
              Pour aller plus loin
            </h2>
            <ul className="space-y-3">
              {['Signalez le SMS au 33700', 'Vous pouvez déposer plainte si nécessaire'].map((item) => (
                <li key={item} className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-100 text-sm">
                  <span className="font-semibold text-marie-blue">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center gap-6 p-8 bg-white rounded-3xl text-left shadow-lg border border-marie-blue/10">
            <div className="w-20 h-20 flex-shrink-0">
              <img src={marieRougeSrc} alt="Marie" className="w-full h-full object-contain" />
            </div>
            <p className="text-lg font-semibold text-marie-dark leading-snug">
              Je suis là pour vous aider, vous n'êtes pas seul. Des solutions existent et vous pouvez agir rapidement.
            </p>
          </div>

          {viewMode === 'mobile' && (
            <button onClick={onBack} className="btn-primary w-full mt-4">
              Retour à l'accueil
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [viewMode] = useState<ViewMode>('mobile');
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [result, setResult] = useState<UIResult | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [showInteractionPopup, setShowInteractionPopup] = useState(false);
  const [showEmergencyHelp, setShowEmergencyHelp] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pending: smsPending, clearPending: clearSmsPending } = useSmsShield();

  // SMS reçu via le plugin natif → reset complet puis pré-remplir + confirmation
  useEffect(() => {
    if (!smsPending) return;
    clearSmsPending();
    setAnalysisId(null);
    setResult(null);
    setImageFile(null);
    setImagePreview(null);
    setPostError(null);
    setPosting(false);
    setShowInteractionPopup(false);
    setShowEmergencyHelp(false);
    setInput(smsPending.body);
    setPendingConfirm(smsPending.body);
  }, [smsPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase: 'input' | 'analyzing' | 'result' = result
    ? 'result'
    : analysisId
      ? 'analyzing'
      : 'input';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!input && !imageFile) return;
    setPosting(true);
    setPostError(null);
    try {
      const data = imageFile ? await postImage(imageFile) : await postText(input);
      setAnalysisId(data.id);
    } catch (e) {
      setPostError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleStreamComplete = (r: UIResult) => {
    setResult(r);
    if (r.level >= 2) setShowInteractionPopup(true);
  };

  const handleStreamError = (err: string) => {
    setAnalysisId(null);
    setPostError(err);
  };

  const reset = () => {
    setInput('');
    setImageFile(null);
    setImagePreview(null);
    setAnalysisId(null);
    setResult(null);
    setPosting(false);
    setPostError(null);
    setShowInteractionPopup(false);
    setShowEmergencyHelp(false);
    setPendingConfirm(null);
  };

  if (pendingConfirm) {
    return (
      <AnimatePresence>
        <ConfirmSheet
          preview={pendingConfirm}
          onConfirm={async () => {
            const t = pendingConfirm;
            setPendingConfirm(null);
            setPosting(true);
            setPostError(null);
            try {
              const data = await postText(t);
              setAnalysisId(data.id);
            } catch (e) {
              setPostError((e as Error).message);
            } finally {
              setPosting(false);
            }
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      </AnimatePresence>
    );
  }

  if (showEmergencyHelp) {
    return <EmergencyScreen viewMode={viewMode} onBack={reset} />;
  }

  const titleText = phase === 'analyzing'
    ? 'J\'analyse votre message'
    : phase === 'result'
      ? 'J\'ai analysé votre message'
      : 'Bonjour, je suis Marie.';

  return (
    <div className={`min-h-screen mx-auto px-6 py-8 flex flex-col gap-4 ${viewMode === 'mobile' ? 'max-w-md' : 'max-w-5xl'}`}>
      {/* Header */}
      <header className="text-center flex flex-col items-center gap-3">
        <MarieFigure phase={phase} result={result} />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-marie-dark">{titleText}</h1>
          {phase === 'input' && (
            <p className="text-marie-dark/70 leading-tight text-sm">
              Copiez-collez un message ou téléchargez une image. Je vous dirai s'il y a un risque.
            </p>
          )}
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">

          {/* ── Input ── */}
          {phase === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {postError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
                  {postError}
                </div>
              )}

              <div className="glass-card p-4 space-y-4">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAnalyze();
                      }
                    }}
                    placeholder="Collez le texte du message ici..."
                    className="w-full h-32 p-4 bg-transparent border-none focus:ring-0 outline-none resize-none text-marie-dark placeholder:text-marie-dark/40"
                  />
                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={async () => {
                        const capClip = getCapClipboard();
                        if (capClip) {
                          try {
                            const { type, value } = await capClip.read();
                            if ((type === 'image/png' || type === 'image') && value) {
                              const res = await fetch(value);
                              const blob = await res.blob();
                              const f = new File([blob], 'paste.png', { type: 'image/png' });
                              setImageFile(f);
                              const reader = new FileReader();
                              reader.onloadend = () => setImagePreview(reader.result as string);
                              reader.readAsDataURL(f);
                            } else if (value.trim()) {
                              setInput(value);
                            }
                          } catch { /* permission refusée */ }
                          return;
                        }
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setInput(text);
                        } catch { /* non disponible */ }
                      }}
                      className="p-2 hover:bg-marie-blue/5 rounded-full transition-colors text-marie-dark/40 hover:text-marie-blue"
                      title="Coller depuis le presse-papier"
                    >
                      <Clipboard className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-marie-dark/10 rounded-2xl text-marie-dark/60 hover:border-marie-blue hover:text-marie-blue transition-colors"
                  >
                    {imagePreview ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-medium">Image ajoutée</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span className="text-sm font-medium">Télécharger une capture d'écran</span>
                      </>
                    )}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={(!input && !imageFile) || posting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {posting ? 'Envoi en cours…' : 'Analyser le message'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ── Analyzing ── */}
          {phase === 'analyzing' && analysisId && (
            <AnalysisStreamView
              key={analysisId}
              analysisId={analysisId}
              viewMode={viewMode}
              onComplete={handleStreamComplete}
              onError={handleStreamError}
            />
          )}

          {/* ── Result ── */}
          {phase === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`pb-8 ${viewMode === 'web' ? 'grid grid-cols-1 md:grid-cols-2 gap-8' : 'space-y-4'}`}
            >
              {/* Left column: gauge + notice + interaction popup */}
              <div className="space-y-4">
                <div className="glass-card p-6 text-center space-y-3">
                  <CircularGauge score={result.score} level={result.level} />

                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-sm font-semibold uppercase tracking-wider text-marie-dark ${
                      result.level === 1 ? 'bg-green-100' : result.level === 2 ? 'bg-orange-100' : 'bg-red-100'
                    }`}>
                      {result.level === 1 && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      {result.level === 2 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      {result.level === 3 && <XCircle className="w-4 h-4 text-red-500" />}
                      Niveau {result.level} : {result.level === 1 ? 'Sûr' : result.level === 2 ? 'Suspect' : 'Frauduleux'}
                    </div>
                    <p className="text-marie-dark/80 font-medium px-4 text-sm">{result.summary}</p>
                  </div>

                  {result.notice && (
                    <p className="text-xs text-marie-dark/50 italic px-2">{result.notice}</p>
                  )}
                </div>

                {/* Interaction popup — embedded in web view */}
                {viewMode === 'web' && showInteractionPopup && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-red-600 text-white space-y-3 shadow-xl rounded-3xl border-4 border-white/20"
                  >
                    <div className="flex justify-center">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-center text-base leading-tight">
                      Avez-vous déjà interagi avec ce message ?
                    </h3>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { setShowInteractionPopup(false); setShowEmergencyHelp(true); }}
                        className="w-full py-3 bg-white text-red-600 hover:bg-red-50 rounded-2xl font-semibold transition-all shadow-lg text-sm"
                      >
                        Oui, j'ai besoin d'aide
                      </button>
                      <button
                        onClick={() => setShowInteractionPopup(false)}
                        className="w-full py-2 bg-transparent hover:bg-white/10 text-white/90 rounded-xl font-medium transition-colors border border-white/30 text-xs"
                      >
                        Non, je n'ai rien fait
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right column: actions + checks + reset */}
              <div className="space-y-6">
                {result.actions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-marie-dark flex items-center gap-2">
                      <Shield className="w-5 h-5 text-marie-blue" />
                      Actions à réaliser
                    </h3>
                    <div className="space-y-3">
                      {result.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                          <span className="flex-shrink-0 w-8 h-8 bg-marie-dark text-white rounded-full flex items-center justify-center text-sm font-semibold shadow-sm">
                            {i + 1}
                          </span>
                          <p className="text-sm text-marie-dark/80 leading-relaxed">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.checks.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-marie-dark flex items-center gap-2">
                      <Info className="w-5 h-5 text-marie-blue" />
                      Ce que j'ai vérifié
                    </h3>
                    <div className="space-y-3">
                      {result.checks.map((check, i) => (
                        <div key={i} className="glass-card p-5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-marie-dark text-sm">{check.title}</span>
                            {check.status === 'safe' && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                            {check.status === 'suspicious' && <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />}
                            {check.status === 'danger' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                          </div>
                          <p className="text-sm text-marie-dark/70 leading-relaxed font-extralight italic">
                            "{check.explanation}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={reset} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <RefreshCcw className="w-5 h-5" />
                  Nouvelle analyse
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Interaction popup — overlay for mobile */}
      {viewMode === 'mobile' && result && (
        <AnimatePresence>
          {showInteractionPopup && (
            <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md p-5 bg-red-600 text-white space-y-3 shadow-2xl rounded-3xl border-4 border-white/20 pointer-events-auto"
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <div className="relative space-y-3">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-center text-base leading-tight">
                    Avez-vous déjà interagi avec ce message ?
                  </h3>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setShowInteractionPopup(false); setShowEmergencyHelp(true); }}
                      className="w-full py-4 bg-white text-red-600 hover:bg-red-50 rounded-2xl font-semibold transition-all shadow-lg active:scale-[0.98] text-base"
                    >
                      Oui, j'ai besoin d'aide
                    </button>
                    <button
                      onClick={() => setShowInteractionPopup(false)}
                      className="w-full py-2 bg-transparent hover:bg-white/10 text-white/90 rounded-xl font-medium transition-colors border border-white/30 text-sm"
                    >
                      Non, je n'ai rien fait
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      <footer className="text-center text-xs text-marie-dark/40 py-4 flex items-center justify-center gap-2 font-extralight italic">
        <Lock className="w-3 h-3" />
        Vos données sont analysées de manière sécurisée.
      </footer>
    </div>
  );
}
