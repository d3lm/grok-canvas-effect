import { Tabs } from '@base-ui/react/tabs';
import { ArrowLeft, Copy, Link2, Loader2, Maximize2, Minimize2, Plus, Unlink2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CanvasPreview } from './generator/CanvasPreview';
import { ChannelTab } from './generator/ChannelTab';
import { Field } from './generator/Field';
import { PanelButton } from './generator/PanelButton';
import { SectionLabel } from './generator/SectionLabel';
import { SliderField } from './generator/SliderField';
import { TextInput } from './generator/TextInput';
import { BlueRadialHandles, GradientHandles } from './generator/editors';
import {
  useChannelCanvases,
  useDragHandlers,
  useFontLoader,
  useGradientList,
  useLivePreview,
  useMaximizeEscape,
  useTextureGeneration,
  useTextureSettings,
} from './generator/hooks';
import { CHANNEL_META, gradientColor, type ChannelName } from './generator/types';
import { radiusToPercent, radiusToPercentY } from './generator/utils';
import { useDeferredLoading } from './hooks/useDeferredLoading';
import { cn } from './lib/utils';

export function Generator() {
  const { settings, setSettings, update, updateGradient, updateBlueRadial } = useTextureSettings();

  const { fontLoadStatus } = useFontLoader(settings.fontFamily, settings.fontWeight);

  const showLoading = useDeferredLoading(fontLoadStatus === 'loading');

  const channels = useTextureGeneration(settings);

  const [activeChannel, setActiveChannel] = useState<ChannelName>('packed');
  const [showLive, setShowLive] = useState(true);
  const [maximizeLive, setMaximizeLive] = useState(false);
  const [selectedGradient, setSelectedGradient] = useState(0);
  const [splitRatio, setSplitRatio] = useState(0.35);
  const [resizing, setResizing] = useState(false);

  const splitContainerRef = useRef<HTMLDivElement>(null);

  useMaximizeEscape(maximizeLive, setMaximizeLive);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();

      const container = splitContainerRef.current;

      if (!container) {
        return;
      }

      const startX = event.clientX;
      const startRatio = splitRatio;

      const rect = container.getBoundingClientRect();

      const onMove = (event: PointerEvent) => {
        const delta = event.clientX - startX;
        const newRatio = Math.min(0.85, Math.max(0.15, startRatio + delta / rect.width));

        setSplitRatio(newRatio);
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);

        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        setResizing(false);

        window.dispatchEvent(new Event('resize'));
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      setResizing(true);

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [splitRatio],
  );

  const { setCanvasRef } = useChannelCanvases(channels);

  const { liveCanvasRef } = useLivePreview(channels, showLive);

  const { addGradient, removeGradient } = useGradientList(setSettings, setSelectedGradient);

  const {
    dragging,
    alphaEditorRef,
    blueEditorRef,
    handleAlphaEditorPointerDown,
    handleAlphaHandlePointerDown,
    handleBlueEditorPointerDown,
    handleBlueHandlePointerDown,
  } = useDragHandlers(updateGradient, updateBlueRadial, setSettings, settings, setSelectedGradient);

  const handleCopyGradients = () => {
    const data = settings.gradients.map((gradient) => {
      return {
        startX: +gradient.startX.toFixed(4),
        startY: +gradient.startY.toFixed(4),
        endX: +gradient.endX.toFixed(4),
        endY: +gradient.endY.toFixed(4),
        startOpacity: +gradient.startOpacity.toFixed(4),
        endOpacity: +gradient.endOpacity.toFixed(4),
        widthA: +gradient.widthA.toFixed(4),
        widthB: +gradient.widthB.toFixed(4),
        widthLocked: gradient.widthLocked,
        softnessA: +gradient.softnessA.toFixed(4),
        softnessB: +gradient.softnessB.toFixed(4),
        softnessLocked: gradient.softnessLocked,
      };
    });

    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const handleCopyBlurPositions = () => {
    const { centerX, centerY, innerRadius, outerRadius, scaleY } = settings.blueRadial;

    const data = {
      centerX: +centerX.toFixed(4),
      centerY: +centerY.toFixed(4),
      innerRadius: +innerRadius.toFixed(4),
      outerRadius: +outerRadius.toFixed(4),
      scaleY: +scaleY.toFixed(4),
      innerBlur: settings.blueInnerBlur,
      outerBlur: settings.blueOuterBlur,
    };

    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const handleDownload = () => {
    if (!channels) {
      return;
    }

    const fullCanvas = document.createElement('canvas');

    fullCanvas.width = channels.width;
    fullCanvas.height = channels.height;

    const fullCtx = fullCanvas.getContext('2d');

    if (!fullCtx) {
      return;
    }

    const imageData = fullCtx.createImageData(channels.width, channels.height);

    imageData.data.set(channels.packed);

    fullCtx.putImageData(imageData, 0, 0);

    const sizes = [
      { name: 'image.png', width: channels.width, height: channels.height },
      { name: 'logoHalf.png', width: Math.round(channels.width / 2), height: Math.round(channels.height / 2) },
      { name: 'logoQuart.png', width: Math.round(channels.width / 4), height: Math.round(channels.height / 4) },
    ];

    for (const [idx, size] of sizes.entries()) {
      setTimeout(() => {
        const canvas = document.createElement('canvas');

        canvas.width = size.width;
        canvas.height = size.height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return;
        }

        ctx.drawImage(fullCanvas, 0, 0, size.width, size.height);

        const link = document.createElement('a');

        link.download = size.name;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }, idx * 200);
    }
  };

  const ratio = channels ? channels.width / channels.height : 0;
  const activeGrad = settings.gradients[selectedGradient];

  return (
    <div className="grid h-screen grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-1">
      <aside className="flex flex-col gap-3 overflow-y-auto border-b border-white/5 p-5 md:border-b-0 md:border-r">
        <h2 className="mb-1 text-[15px] font-semibold text-zinc-200">Texture Generator</h2>

        <Field label="Text">
          <TextInput value={settings.text} onChange={(event) => update('text', event.target.value)} />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center">
              Font Family
              {showLoading && <Loader2 className="ml-1.5 h-3 w-3 animate-spin text-zinc-500" />}
            </span>
          }
        >
          <TextInput value={settings.fontFamily} onChange={(event) => update('fontFamily', event.target.value)} />
        </Field>

        <SliderField
          label="Weight"
          value={settings.fontWeight}
          min={100}
          max={900}
          step={100}
          onChange={(value) => update('fontWeight', value)}
        />

        <SliderField
          label="Font Size"
          value={settings.fontSize}
          min={40}
          max={600}
          step={1}
          onChange={(value) => update('fontSize', value)}
        />

        <SliderField
          label="Letter Spacing"
          value={settings.letterSpacing}
          min={-20}
          max={60}
          step={1}
          onChange={(value) => update('letterSpacing', value)}
        />

        <SliderField
          label="Edge Sharpness"
          value={settings.edgeSharpness}
          min={0}
          max={1}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) => update('edgeSharpness', value)}
        />

        <SliderField
          label="Softness"
          value={settings.softness}
          min={0}
          max={1}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(value) => update('softness', value)}
        />

        <SliderField
          label="Direction Strength"
          value={settings.normalStrength}
          min={0.005}
          max={0.6}
          step={0.005}
          format={(value) => value.toFixed(3)}
          onChange={(value) => update('normalStrength', value)}
        />

        <div className="mt-1 flex flex-col gap-2">
          <SectionLabel>Blue Blur</SectionLabel>
          <SliderField
            label="Inner Blur"
            value={settings.blueInnerBlur}
            min={0}
            max={48}
            step={1}
            onChange={(value) => update('blueInnerBlur', value)}
          />
          <SliderField
            label="Outer Blur"
            value={settings.blueOuterBlur}
            min={0}
            max={96}
            step={1}
            onChange={(value) => update('blueOuterBlur', value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <SectionLabel>Alpha Gradients</SectionLabel>
          <button
            className="grid size-[22px] place-items-center rounded border border-white/10 bg-white/5 text-sm leading-none text-zinc-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
            onClick={addGradient}
            title="Add gradient"
            type="button"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {settings.gradients.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-center rounded border border-white/10 transition-colors',
                idx === selectedGradient && 'bg-white/5',
              )}
            >
              <button
                className={cn(
                  'flex-1 rounded-l border-0 border-l-[3px] border-transparent bg-transparent px-2 py-1.5 text-left text-xs text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer',
                  idx === selectedGradient && 'text-zinc-200',
                )}
                onClick={() => setSelectedGradient(idx)}
                style={{ borderLeftColor: gradientColor(idx) }}
                type="button"
              >
                Gradient {idx + 1}
              </button>
              {settings.gradients.length > 1 && (
                <button
                  className="grid size-[22px] place-items-center rounded border-0 bg-transparent text-xs text-zinc-700 transition hover:bg-red-500/10 hover:text-red-400 cursor-pointer mr-1"
                  onClick={() => removeGradient(idx)}
                  title="Remove gradient"
                  type="button"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>

        {activeGrad && (
          <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
            <SliderField
              label="Start Opacity"
              value={activeGrad.startOpacity}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onChange={(startOpacity) => updateGradient(selectedGradient, { startOpacity })}
            />
            <SliderField
              label="End Opacity"
              value={activeGrad.endOpacity}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onChange={(endOpacity) => updateGradient(selectedGradient, { endOpacity })}
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 uppercase tracking-[0.05em]">Width Lock</span>
              <button
                type="button"
                className={cn(
                  'ml-auto flex items-center justify-center size-5 rounded text-[10px] leading-none transition cursor-pointer bg-transparent',
                  activeGrad.widthLocked ? 'text-white' : 'text-zinc-600 hover:text-zinc-400',
                )}
                title={activeGrad.widthLocked ? 'Unlock sides' : 'Lock sides'}
                onClick={() =>
                  updateGradient(selectedGradient, {
                    widthLocked: !activeGrad.widthLocked,
                    ...(activeGrad.widthLocked ? {} : { widthB: activeGrad.widthA }),
                  })
                }
              >
                {activeGrad.widthLocked ? <Link2 size={12} /> : <Unlink2 size={12} />}
              </button>
            </div>
            <SliderField
              label="WA"
              value={activeGrad.widthA}
              min={0.01}
              max={1}
              step={0.005}
              format={(value) => value.toFixed(3)}
              onChange={(widthA) =>
                updateGradient(selectedGradient, activeGrad.widthLocked ? { widthA, widthB: widthA } : { widthA })
              }
            />
            <SliderField
              label="WB"
              value={activeGrad.widthB}
              min={0.01}
              max={1}
              step={0.005}
              format={(value) => value.toFixed(3)}
              onChange={(widthB) =>
                updateGradient(selectedGradient, activeGrad.widthLocked ? { widthA: widthB, widthB } : { widthB })
              }
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 uppercase tracking-[0.05em]">Softness Lock</span>
              <button
                type="button"
                className={cn(
                  'ml-auto flex items-center justify-center size-5 rounded text-[10px] leading-none transition cursor-pointer bg-transparent',
                  activeGrad.softnessLocked ? 'text-white' : 'text-zinc-600 hover:text-zinc-400',
                )}
                title={activeGrad.softnessLocked ? 'Unlock softness' : 'Lock softness'}
                onClick={() =>
                  updateGradient(selectedGradient, {
                    softnessLocked: !activeGrad.softnessLocked,
                    ...(activeGrad.softnessLocked ? {} : { softnessB: activeGrad.softnessA }),
                  })
                }
              >
                {activeGrad.softnessLocked ? <Link2 size={12} /> : <Unlink2 size={12} />}
              </button>
            </div>
            <SliderField
              label="WA Softness"
              value={activeGrad.softnessA}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onChange={(softnessA) =>
                updateGradient(
                  selectedGradient,
                  activeGrad.softnessLocked ? { softnessA, softnessB: softnessA } : { softnessA },
                )
              }
            />
            <SliderField
              label="WB Softness"
              value={activeGrad.softnessB}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onChange={(softnessB) =>
                updateGradient(
                  selectedGradient,
                  activeGrad.softnessLocked ? { softnessA: softnessB, softnessB } : { softnessB },
                )
              }
            />
          </div>
        )}

        <div className="mt-auto flex flex-col gap-1.5 border-t border-white/5 pt-2">
          <PanelButton onClick={handleDownload} disabled={!channels}>
            Download Images
          </PanelButton>
          <PanelButton onClick={() => setShowLive((value) => !value)}>
            {showLive ? 'Hide Live Preview' : 'Show Live Preview'}
          </PanelButton>
        </div>
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
        <Tabs.Root
          value={activeChannel}
          onValueChange={(value) => setActiveChannel(value as ChannelName)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/5 bg-linear-to-b from-white/3 to-transparent px-3 py-2">
            {CHANNEL_META.map((meta) => (
              <ChannelTab key={meta.key} value={meta.key} label={meta.label} title={meta.desc} color={meta.color} />
            ))}

            <Link
              to="/"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-500 no-underline transition hover:bg-white/8 hover:text-zinc-200"
            >
              <ArrowLeft size={14} />
              Demo
            </Link>
          </Tabs.List>

          <div
            ref={splitContainerRef}
            className="grid min-h-0 min-w-0 flex-1"
            style={{
              gridTemplateColumns: showLive
                ? `minmax(0, ${splitRatio}fr) 0px minmax(0, ${1 - splitRatio}fr)`
                : 'minmax(0, 1fr)',
            }}
          >
            <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#151515_0%_50%)] bg-size-[20px_20px] p-6">
              {CHANNEL_META.map((meta) => (
                <CanvasPreview
                  key={meta.key}
                  channelKey={meta.key}
                  activeChannel={activeChannel}
                  setCanvasRef={setCanvasRef}
                >
                  {meta.key === 'alpha' && (
                    <div
                      ref={alphaEditorRef}
                      className={cn(
                        'absolute inset-0',
                        dragging?.kind === 'alpha' ? 'cursor-grabbing' : 'cursor-crosshair',
                      )}
                      onPointerDown={handleAlphaEditorPointerDown}
                    >
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {settings.gradients.map((grad, idx) => {
                          const dx = grad.endX - grad.startX;
                          const dy = grad.endY - grad.startY;
                          const len = Math.hypot(dx, dy);
                          const showBox =
                            idx === selectedGradient && len > 1e-6 && (grad.widthA < 2 || grad.widthB < 2);

                          return (
                            <g key={idx}>
                              {showBox &&
                                (() => {
                                  const perpXN = dy / len;
                                  const perpYN = -dx / len;
                                  const sx = grad.startX * 100;
                                  const sy = grad.startY * 100;
                                  const ex = grad.endX * 100;
                                  const ey = grad.endY * 100;
                                  const apx = perpXN * grad.widthA * 100;
                                  const apy = perpYN * grad.widthA * 100;
                                  const bpx = perpXN * grad.widthB * 100;
                                  const bpy = perpYN * grad.widthB * 100;

                                  return (
                                    <polygon
                                      points={`${sx + apx},${sy + apy} ${ex + apx},${ey + apy} ${ex - bpx},${ey - bpy} ${sx - bpx},${sy - bpy}`}
                                      fill="none"
                                      stroke={gradientColor(idx)}
                                      strokeOpacity={0.35}
                                      strokeWidth={1}
                                      strokeDasharray="4 4"
                                      vectorEffect="non-scaling-stroke"
                                    />
                                  );
                                })()}
                              <line
                                x1={grad.startX * 100}
                                y1={grad.startY * 100}
                                x2={grad.endX * 100}
                                y2={grad.endY * 100}
                                stroke={gradientColor(idx)}
                                strokeOpacity={idx === selectedGradient ? 1 : 0.45}
                                strokeWidth={idx === selectedGradient ? 2 : 1}
                                strokeLinecap="round"
                                strokeDasharray="6 6"
                                vectorEffect="non-scaling-stroke"
                                style={{ filter: 'drop-shadow(0 0 6px rgba(0, 0, 0, 0.45))' }}
                              />
                            </g>
                          );
                        })}
                      </svg>
                      {settings.gradients.map((grad, idx) => (
                        <GradientHandles
                          key={idx}
                          gradient={grad}
                          index={idx}
                          color={gradientColor(idx)}
                          selected={idx === selectedGradient}
                          onPointerDown={handleAlphaHandlePointerDown}
                        />
                      ))}
                      <button
                        type="button"
                        className="absolute right-2 bottom-2 flex items-center gap-1 rounded border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-zinc-400 backdrop-blur-sm transition hover:bg-black/80 hover:text-white cursor-pointer"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleCopyGradients}
                        title="Copy gradients array"
                      >
                        <Copy size={11} />
                        Copy Gradients
                      </button>
                    </div>
                  )}
                  {meta.key === 'blue' && (
                    <div
                      ref={blueEditorRef}
                      className={cn(
                        'absolute inset-0',
                        dragging?.kind === 'blue' ? 'cursor-grabbing' : 'cursor-crosshair',
                      )}
                      onPointerDown={handleBlueEditorPointerDown}
                    >
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <ellipse
                          cx={settings.blueRadial.centerX * 100}
                          cy={settings.blueRadial.centerY * 100}
                          rx={radiusToPercent(
                            settings.blueRadial.outerRadius,
                            channels?.width ?? 1,
                            channels?.height ?? 1,
                          )}
                          ry={radiusToPercentY(
                            settings.blueRadial.outerRadius * settings.blueRadial.scaleY,
                            channels?.width ?? 1,
                            channels?.height ?? 1,
                          )}
                          fill="none"
                          stroke="#8ad8ff"
                          strokeOpacity="0.55"
                          strokeWidth="1.2"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="8 6"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.45))' }}
                        />
                        <ellipse
                          cx={settings.blueRadial.centerX * 100}
                          cy={settings.blueRadial.centerY * 100}
                          rx={radiusToPercent(
                            settings.blueRadial.innerRadius,
                            channels?.width ?? 1,
                            channels?.height ?? 1,
                          )}
                          ry={radiusToPercentY(
                            settings.blueRadial.innerRadius * settings.blueRadial.scaleY,
                            channels?.width ?? 1,
                            channels?.height ?? 1,
                          )}
                          fill="none"
                          stroke="#d7f3ff"
                          strokeOpacity="0.9"
                          strokeWidth="1.6"
                          vectorEffect="non-scaling-stroke"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.45))' }}
                        />
                      </svg>

                      <BlueRadialHandles
                        radial={settings.blueRadial}
                        width={channels?.width ?? 1}
                        height={channels?.height ?? 1}
                        onPointerDown={handleBlueHandlePointerDown}
                      />
                      <button
                        type="button"
                        className="absolute right-2 bottom-2 flex items-center gap-1 rounded border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-zinc-400 backdrop-blur-sm transition hover:bg-black/80 hover:text-white cursor-pointer"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleCopyBlurPositions}
                        title="Copy blur positions"
                      >
                        <Copy size={11} />
                        Copy Blur
                      </button>
                    </div>
                  )}
                </CanvasPreview>
              ))}
            </div>

            {showLive && (
              <div className="group relative w-0">
                <div
                  className="absolute inset-y-0 -left-1 -right-1 z-10 flex cursor-col-resize items-center justify-center"
                  onPointerDown={handleResizePointerDown}
                >
                  <div
                    className={cn(
                      'h-full w-[2px] transition-colors delay-150 duration-150',
                      resizing ? 'bg-[#007fd4]' : 'group-hover:bg-[#007fd4] group-hover:delay-300',
                    )}
                  />
                </div>
              </div>
            )}

            {showLive && (
              <section
                className={cn(
                  'flex flex-col border border-white/10 border-r-0 bg-[#050505]',
                  maximizeLive ? 'fixed inset-0 z-200 md:left-[280px]' : 'min-h-0 min-w-0',
                )}
                aria-label="Live preview"
              >
                <div className="flex items-center justify-between border-b border-white/5 bg-linear-to-b from-white/5 to-transparent px-[18px] py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200">Live Preview</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMaximizeLive((value) => !value);
                        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
                      }}
                      className="flex size-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white cursor-pointer"
                      aria-label={maximizeLive ? 'Restore live preview' : 'Maximize live preview'}
                    >
                      {maximizeLive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLive(false);
                        setMaximizeLive(false);
                        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
                      }}
                      className="flex size-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white cursor-pointer"
                      aria-label="Close live preview"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <canvas
                    ref={liveCanvasRef}
                    className="block h-full w-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_18px_42px_rgba(0,0,0,0.35)]"
                  />
                </div>
              </section>
            )}
          </div>
        </Tabs.Root>
      </main>
    </div>
  );
}
