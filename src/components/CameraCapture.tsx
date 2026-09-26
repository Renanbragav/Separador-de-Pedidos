import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, Upload, AlertCircle, RotateCcw } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64DataUrl: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const startCamera = async () => {
    setIsInitializing(true);
    setError(null);

    // Stop existing stream tracks if any
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        'Este navegador não suporta acesso direto à câmera em tempo real. Use a captura nativa abaixo.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      // First attempt with environment/back camera
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback with basic constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
    } catch (err: any) {
      // Handled gracefully without triggering unhandled errors
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (errName === 'NotAllowedError' || errMsg.toLowerCase().includes('permission denied')) {
        setError(
          'Permissão de câmera não concedida no navegador. Você pode liberar a permissão ou utilizar o botão abaixo para fotografar diretamente pelo celular/dispositivo.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('Nenhuma câmera foi detectada neste dispositivo.');
      } else {
        setError(
          'Não foi possível abrir o vídeo ao vivo da câmera. Use a opção de foto do aparelho abaixo.'
        );
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleNativeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedImage(reader.result);
        setError(null);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Camera className="w-5 h-5 text-emerald-400" />
            <span>Fotografar Pedido de Expedição</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden native input with camera capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeFileInput}
          className="hidden"
        />

        {/* Main Content Area */}
        <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[320px]">
          {error ? (
            <div className="text-center space-y-4 p-6 max-w-md bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">Acesso à Câmera Bloqueado</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
              </div>

              {/* Native device camera fallback */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Fotografar pelo Celular / Aparelho</span>
                </button>

                <div className="flex items-center gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Tentar Novamente</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 bg-transparent hover:bg-slate-800 text-slate-400 text-xs font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-black">
              <img
                src={capturedImage}
                alt="Foto do pedido"
                className="w-full h-auto max-h-[400px] object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-black aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border-2 border-dashed border-emerald-400/50 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-xs bg-slate-900/80 px-3 py-1 rounded-full text-emerald-300 font-medium">
                  {isInitializing ? 'Iniciando câmera...' : 'Enquadre a folha do pedido'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
          {capturedImage ? (
            <>
              <button
                onClick={retakePhoto}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tirar Outra Foto</span>
              </button>
              <button
                onClick={confirmPhoto}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4" />
                <span>Importar Esta Fotografia</span>
              </button>
            </>
          ) : !error ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Escolher foto da galeria ou arquivo"
              >
                <Upload className="w-4 h-4" />
                <span>Enviar Imagem</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={takePhoto}
                  disabled={isInitializing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Agora</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
