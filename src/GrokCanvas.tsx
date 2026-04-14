import { useCallback, useEffect, useRef, useState } from 'react';
import { GrokCanvasEffect } from './GrokCanvasEffect';

export function GrokCanvas() {
  const effectRef = useRef<GrokCanvasEffect | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (effectRef.current) {
      effectRef.current.destroy();
      effectRef.current = null;
    }

    if (!canvas) {
      return;
    }

    const effect = new GrokCanvasEffect(canvas);

    effectRef.current = effect;

    effect.init().catch((err) => {
      console.error(err);
      setError('Unable to start the WebGL effect.');
    });
  }, []);

  useEffect(() => {
    return () => {
      effectRef.current?.destroy();
      effectRef.current = null;
    };
  }, []);

  if (error) {
    return <p className="app-error">{error}</p>;
  }

  return <canvas ref={canvasRef} className="demo-canvas" aria-label="Animated WebGL canvas" />;
}
