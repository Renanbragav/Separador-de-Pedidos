import React from 'react';
import { CheckCircle2, FileText, Camera, Loader2 } from 'lucide-react';

export interface ImportProgressState {
  active: boolean;
  percent: number;
  stageText: string;
  sourceType: 'pdf' | 'image' | 'camera' | 'paste';
  fileName?: string;
}

interface ImportProgressModalProps {
  progress: ImportProgressState;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  progress,
}) => {
  if (!progress.active) return null;

  const isComplete = progress.percent >= 100;

  const getSourceLabel = () => {
    switch (progress.sourceType) {
      case 'camera':
        return 'Importação por Fotografia (Câmera)';
      case 'image':
        return 'Importação de Fotografia / Imagem';
      case 'paste':
        return 'Importação por Área de Transferência (Ctrl+V)';
      default:
        return 'Importação de Folha de Pedido (PDF)';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Icon & Percentage Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                isComplete
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              ) : progress.sourceType === 'camera' ||
                progress.sourceType === 'image' ? (
                <Camera className="w-6 h-6 animate-pulse" />
              ) : (
                <FileText className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                {getSourceLabel()}
              </span>
              <h3 className="text-base font-black text-slate-900">
                {isComplete ? 'Pedido Importado!' : 'Importando Pedido...'}
              </h3>
              {progress.fileName && (
                <p className="text-xs text-slate-400 truncate max-w-[210px]">
                  {progress.fileName}
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-2xl font-black font-mono ${
                isComplete ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {Math.min(100, Math.max(0, Math.round(progress.percent)))}%
            </span>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                isComplete
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-blue-600 via-emerald-500 to-emerald-400'
              }`}
              style={{
                width: `${Math.min(100, Math.max(3, progress.percent))}%`,
              }}
            />
          </div>

          {/* Step Milestones */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
            <span className={progress.percent >= 10 ? 'text-emerald-700' : ''}>
              1. Leitura
            </span>
            <span className={progress.percent >= 45 ? 'text-emerald-700' : ''}>
              2. Extração da Matriz
            </span>
            <span className={progress.percent >= 80 ? 'text-emerald-700' : ''}>
              3. Validação
            </span>
            <span className={progress.percent >= 100 ? 'text-emerald-700' : ''}>
              4. Concluído
            </span>
          </div>
        </div>

        {/* Current Stage Description Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs font-semibold text-slate-700">
          {!isComplete ? (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{progress.stageText}</span>
        </div>
      </div>
    </div>
  );
};
