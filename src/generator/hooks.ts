import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GrokCanvasEffect } from '../GrokCanvasEffect';
import {
  channelToImageData,
  DEFAULT_GRADIENTS,
  DEFAULT_SETTINGS,
  generateTexture,
  packedToImageData,
  type BlueRadialControl,
  type GradientLine,
  type TextureChannels,
  type TextureSettings,
} from '../textureGen';
import { loadGoogleFont, parsePrimaryFamily, removeGoogleFont } from './googleFonts';
import { CHANNEL_META, type BlueHandle, type ChannelName, type DragState, type HandleEnd } from './types';
import { clamp01, distanceToBlueCenter, distanceToPoint, radiusToUnitX, radiusToUnitY } from './utils';

export function useTextureSettings() {
  const [settings, setSettings] = useState<TextureSettings>(() => ({
    ...DEFAULT_SETTINGS,
    blueRadial: { ...DEFAULT_SETTINGS.blueRadial },
    gradients: DEFAULT_SETTINGS.gradients.map((gradient) => {
      return {
        ...gradient,
      };
    }),
  }));

  const update = <K extends keyof TextureSettings>(key: K, value: TextureSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateGradient = useCallback((index: number, patch: Partial<GradientLine>) => {
    setSettings((prev) => {
      const gradients = prev.gradients.map((gradient, idx) => (idx === index ? { ...gradient, ...patch } : gradient));

      return { ...prev, gradients };
    });
  }, []);

  const updateBlueRadial = useCallback((patch: Partial<BlueRadialControl>) => {
    setSettings((prev) => ({
      ...prev,
      blueRadial: {
        ...prev.blueRadial,
        ...patch,
      },
    }));
  }, []);

  return { settings, setSettings, update, updateGradient, updateBlueRadial };
}

export function useGradientList(
  setSettings: React.Dispatch<React.SetStateAction<TextureSettings>>,
  setSelectedGradient: React.Dispatch<React.SetStateAction<number>>,
) {
  const addGradient = useCallback(() => {
    setSettings((prev) => {
      setSelectedGradient(prev.gradients.length);

      return {
        ...prev,
        gradients: [...prev.gradients, { ...DEFAULT_GRADIENTS[0] }],
      };
    });
  }, [setSettings, setSelectedGradient]);

  const removeGradient = useCallback(
    (index: number) => {
      setSettings((prev) => {
        if (prev.gradients.length <= 1) {
          return prev;
        }

        const gradients = prev.gradients.filter((_, idx) => idx !== index);

        setSelectedGradient((sel) => Math.min(sel, gradients.length - 1));

        return { ...prev, gradients };
      });
    },
    [setSettings, setSelectedGradient],
  );

  return { addGradient, removeGradient };
}

export type FontLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function useFontLoader(fontFamily: string, fontWeight: number) {
  const [status, setStatus] = useState<FontLoadStatus>('idle');
  const prevFamilyRef = useRef<string | null>(null);

  useEffect(() => {
    const family = parsePrimaryFamily(fontFamily);

    if (prevFamilyRef.current && prevFamilyRef.current !== family) {
      removeGoogleFont(prevFamilyRef.current);
    }

    prevFamilyRef.current = family;

    if (!family) {
      setStatus('idle');

      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setStatus('loading');

      try {
        const ok = await loadGoogleFont(family, fontWeight);

        if (cancelled) {
          return;
        }

        setStatus(ok ? 'loaded' : 'error');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fontFamily, fontWeight]);

  return { fontLoadStatus: status };
}

export function useTextureGeneration(settings: TextureSettings) {
  const [channels, setChannels] = useState<TextureChannels | null>(null);
  const [fontGeneration, setFontGeneration] = useState(0);

  useEffect(() => {
    const onDone = () => setFontGeneration((prev) => prev + 1);

    document.fonts.addEventListener('loadingdone', onDone);

    return () => document.fonts.removeEventListener('loadingdone', onDone);
  }, []);

  const regenerate = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;

    return (settings: TextureSettings) => {
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        const result = generateTexture(settings);

        setChannels(result);
      }, 60);
    };
  }, []);

  useEffect(() => {
    regenerate(settings);
  }, [settings, fontGeneration, regenerate]);

  return channels;
}

export function useChannelCanvases(channels: TextureChannels | null) {
  const canvasRefs = useRef<Map<ChannelName, HTMLCanvasElement>>(new Map());

  const setCanvasRef = useCallback(
    (key: ChannelName) => (element: HTMLCanvasElement | null) => {
      if (element) {
        canvasRefs.current.set(key, element);
      } else {
        canvasRefs.current.delete(key);
      }
    },
    [],
  );

  useEffect(() => {
    if (!channels) {
      return;
    }

    for (const meta of CHANNEL_META) {
      const canvas = canvasRefs.current.get(meta.key);

      if (!canvas) {
        continue;
      }

      canvas.width = channels.width;
      canvas.height = channels.height;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        continue;
      }

      if (meta.key === 'packed') {
        ctx.putImageData(packedToImageData(channels.packed, channels.width, channels.height), 0, 0);
      } else {
        ctx.putImageData(channelToImageData(channels[meta.key], channels.width, channels.height), 0, 0);
      }
    }
  }, [channels]);

  return { setCanvasRef };
}

export function useLivePreview(channels: TextureChannels | null, showLive: boolean) {
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectRef = useRef<GrokCanvasEffect | null>(null);

  useEffect(() => {
    if (!showLive || !channels) {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }

      return;
    }

    const canvas = liveCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (effectRef.current) {
      effectRef.current.destroy();
      effectRef.current = null;
    }

    const effect = new GrokCanvasEffect(canvas);

    effectRef.current = effect;

    const ratio = channels.width / channels.height;

    effect.initWithRawTexture(channels.packed, channels.width, channels.height, ratio).catch(console.error);

    return () => {
      effect.destroy();

      if (effectRef.current === effect) {
        effectRef.current = null;
      }
    };
  }, [showLive, channels]);

  return { liveCanvasRef };
}

export function useDragHandlers(
  updateGradient: (index: number, patch: Partial<GradientLine>) => void,
  updateBlueRadial: (patch: Partial<BlueRadialControl>) => void,
  setSettings: React.Dispatch<React.SetStateAction<TextureSettings>>,
  settings: TextureSettings,
  setSelectedGradient: React.Dispatch<React.SetStateAction<number>>,
) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const alphaEditorRef = useRef<HTMLDivElement | null>(null);
  const blueEditorRef = useRef<HTMLDivElement | null>(null);

  const moveAlphaHandle = useCallback(
    (gradientIndex: number, handle: HandleEnd, clientX: number, clientY: number) => {
      const editor = alphaEditorRef.current;

      if (!editor) {
        return;
      }

      const rect = editor.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const rawX = (clientX - rect.left) / rect.width;
      const rawY = (clientY - rect.top) / rect.height;

      if (handle === 'start' || handle === 'end') {
        const nextX = clamp01(rawX);
        const nextY = clamp01(rawY);

        const patch: Partial<GradientLine> =
          handle === 'start' ? { startX: nextX, startY: nextY } : { endX: nextX, endY: nextY };

        updateGradient(gradientIndex, patch);

        return;
      }

      setSettings((prev) => {
        const grad = prev.gradients[gradientIndex];
        const dx = grad.endX - grad.startX;
        const dy = grad.endY - grad.startY;
        const len = Math.hypot(dx, dy);

        if (len < 1e-6) {
          return prev;
        }

        const midX = (grad.startX + grad.endX) / 2;
        const midY = (grad.startY + grad.endY) / 2;
        const perpDist = Math.min(1, Math.max(0.005, Math.abs((-dy * (rawX - midX) + dx * (rawY - midY)) / len)));

        let patch: Partial<GradientLine>;

        if (grad.widthLocked) {
          patch = { widthA: perpDist, widthB: perpDist };
        } else if (handle === 'widthA') {
          patch = { widthA: perpDist };
        } else {
          patch = { widthB: perpDist };
        }

        const gradients = prev.gradients.map((grad, i) => (i === gradientIndex ? { ...grad, ...patch } : grad));

        return { ...prev, gradients };
      });
    },
    [updateGradient, setSettings],
  );

  const moveBlueHandle = useCallback(
    (handle: BlueHandle, clientX: number, clientY: number) => {
      const editor = blueEditorRef.current;

      if (!editor) {
        return;
      }

      const rect = editor.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const rawX = (clientX - rect.left) / rect.width;
      const rawY = (clientY - rect.top) / rect.height;

      if (handle === 'center') {
        updateBlueRadial({ centerX: clamp01(rawX), centerY: clamp01(rawY) });

        return;
      }

      if (handle === 'innerV' || handle === 'outerV') {
        setSettings((prev) => {
          const dy = Math.abs(rawY - prev.blueRadial.centerY) * rect.height;
          const minDim = Math.max(1, Math.min(rect.width, rect.height));
          const baseRadius = handle === 'innerV' ? prev.blueRadial.innerRadius : prev.blueRadial.outerRadius;
          const newScaleY = baseRadius > 1e-4 ? Math.max(0.05, dy / (baseRadius * minDim)) : prev.blueRadial.scaleY;

          return { ...prev, blueRadial: { ...prev.blueRadial, scaleY: newScaleY } };
        });

        return;
      }

      setSettings((prev) => {
        const radius = distanceToBlueCenter(rawX, rawY, prev.blueRadial, rect.width, rect.height);

        const blueRadial =
          handle === 'inner'
            ? { ...prev.blueRadial, innerRadius: Math.min(radius, prev.blueRadial.outerRadius - 0.01) }
            : { ...prev.blueRadial, outerRadius: Math.max(radius, prev.blueRadial.innerRadius + 0.01) };

        return { ...prev, blueRadial };
      });
    },
    [updateBlueRadial, setSettings],
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (event: PointerEvent) => {
      if (dragging.kind === 'alpha') {
        moveAlphaHandle(dragging.gradientIndex, dragging.handle, event.clientX, event.clientY);
      } else {
        moveBlueHandle(dragging.handle, event.clientX, event.clientY);
      }
    };

    const onUp = () => setDragging(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, moveAlphaHandle, moveBlueHandle]);

  const handleAlphaEditorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const editor = alphaEditorRef.current;

      if (!editor) {
        return;
      }

      const rect = editor.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const posX = clamp01((event.clientX - rect.left) / rect.width);
      const posY = clamp01((event.clientY - rect.top) / rect.height);

      let bestDist = Infinity;
      let bestIndex = 0;
      let bestHandle: HandleEnd = 'start';

      for (let i = 0; i < settings.gradients.length; i++) {
        const gradient = settings.gradients[i];
        const dStart = (posX - gradient.startX) ** 2 + (posY - gradient.startY) ** 2;
        const dEnd = (posX - gradient.endX) ** 2 + (posY - gradient.endY) ** 2;

        if (dStart < bestDist) {
          bestDist = dStart;
          bestIndex = i;
          bestHandle = 'start';
        }

        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestIndex = i;
          bestHandle = 'end';
        }

        const dx = gradient.endX - gradient.startX;
        const dy = gradient.endY - gradient.startY;

        const len = Math.hypot(dx, dy);

        if (len > 1e-6 && (gradient.widthA < 2 || gradient.widthB < 2)) {
          const perpX = dy / len;
          const perpY = -dx / len;

          const midX = (gradient.startX + gradient.endX) / 2;
          const midY = (gradient.startY + gradient.endY) / 2;

          const waX = midX + perpX * gradient.widthA;
          const waY = midY + perpY * gradient.widthA;
          const wbX = midX - perpX * gradient.widthB;
          const wbY = midY - perpY * gradient.widthB;

          const dWa = (posX - waX) ** 2 + (posY - waY) ** 2;
          const dWb = (posX - wbX) ** 2 + (posY - wbY) ** 2;

          if (dWa < bestDist) {
            bestDist = dWa;
            bestIndex = i;
            bestHandle = 'widthA';
          }

          if (dWb < bestDist) {
            bestDist = dWb;
            bestIndex = i;
            bestHandle = 'widthB';
          }
        }
      }

      setSelectedGradient(bestIndex);
      setDragging({ kind: 'alpha', gradientIndex: bestIndex, handle: bestHandle });

      moveAlphaHandle(bestIndex, bestHandle, event.clientX, event.clientY);

      event.preventDefault();
    },
    [settings.gradients, moveAlphaHandle, setSelectedGradient],
  );

  const handleAlphaHandlePointerDown = useCallback(
    (gradientIndex: number, handle: HandleEnd) => (event: React.PointerEvent<HTMLButtonElement>) => {
      setSelectedGradient(gradientIndex);
      setDragging({ kind: 'alpha', gradientIndex, handle });

      moveAlphaHandle(gradientIndex, handle, event.clientX, event.clientY);

      event.preventDefault();
      event.stopPropagation();
    },
    [moveAlphaHandle, setSelectedGradient],
  );

  const handleBlueEditorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const editor = blueEditorRef.current;

      if (!editor) {
        return;
      }

      const rect = editor.getBoundingClientRect();

      if (!rect.width || !rect.height) {
        return;
      }

      const posX = clamp01((event.clientX - rect.left) / rect.width);
      const posY = clamp01((event.clientY - rect.top) / rect.height);
      const blue = settings.blueRadial;
      const centerDist = distanceToPoint(posX, posY, blue.centerX, blue.centerY);
      const innerHandleX = blue.centerX + radiusToUnitX(blue.innerRadius, rect.width, rect.height);
      const outerHandleX = blue.centerX + radiusToUnitX(blue.outerRadius, rect.width, rect.height);
      const innerHandleY = blue.centerY - radiusToUnitY(blue.innerRadius * blue.scaleY, rect.width, rect.height);
      const outerHandleY = blue.centerY - radiusToUnitY(blue.outerRadius * blue.scaleY, rect.width, rect.height);
      const innerDist = distanceToPoint(posX, posY, innerHandleX, blue.centerY);
      const outerDist = distanceToPoint(posX, posY, outerHandleX, blue.centerY);
      const innerVDist = distanceToPoint(posX, posY, blue.centerX, innerHandleY);
      const outerVDist = distanceToPoint(posX, posY, blue.centerX, outerHandleY);

      let handle: BlueHandle = 'center';
      let best = centerDist;

      if (innerDist < best) {
        best = innerDist;
        handle = 'inner';
      }

      if (outerDist < best) {
        best = outerDist;
        handle = 'outer';
      }

      if (innerVDist < best) {
        best = innerVDist;
        handle = 'innerV';
      }

      if (outerVDist < best) {
        best = outerVDist;
        handle = 'outerV';
      }

      setDragging({ kind: 'blue', handle });
      moveBlueHandle(handle, event.clientX, event.clientY);

      event.preventDefault();
    },
    [moveBlueHandle, settings.blueRadial],
  );

  const handleBlueHandlePointerDown = useCallback(
    (handle: BlueHandle) => (event: React.PointerEvent<HTMLButtonElement>) => {
      setDragging({ kind: 'blue', handle });
      moveBlueHandle(handle, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    },
    [moveBlueHandle],
  );

  return {
    dragging,
    alphaEditorRef,
    blueEditorRef,
    handleAlphaEditorPointerDown,
    handleAlphaHandlePointerDown,
    handleBlueEditorPointerDown,
    handleBlueHandlePointerDown,
  };
}

export function useMaximizeEscape(
  maximizeLive: boolean,
  setMaximizeLive: React.Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (!maximizeLive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMaximizeLive(false);
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [maximizeLive, setMaximizeLive]);
}
