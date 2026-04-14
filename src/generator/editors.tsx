import type { BlueRadialControl, GradientLine } from '../textureGen';
import { DragHandle } from './DragHandle';
import type { BlueHandle, HandleEnd } from './types';
import { pointStyle, radiusToUnitX, radiusToUnitY } from './utils';

export function GradientHandles({
  gradient,
  index,
  color,
  selected,
  onPointerDown,
}: {
  gradient: GradientLine;
  index: number;
  color: string;
  selected: boolean;
  onPointerDown: (gradientIndex: number, handle: HandleEnd) => (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const handleStyle = (x: number, y: number): React.CSSProperties => ({
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    borderColor: color,
    backgroundColor: selected ? color : undefined,
  });

  const dx = gradient.endX - gradient.startX;
  const dy = gradient.endY - gradient.startY;

  const len = Math.hypot(dx, dy);

  const showWidth = selected && len > 1e-6 && (gradient.widthA < 2 || gradient.widthB < 2);

  let widthHandleA: { x: number; y: number } | null = null;
  let widthHandleB: { x: number; y: number } | null = null;

  if (showWidth) {
    const perpX = dy / len;
    const perpY = -dx / len;

    const midX = (gradient.startX + gradient.endX) / 2;
    const midY = (gradient.startY + gradient.endY) / 2;

    widthHandleA = { x: midX + perpX * gradient.widthA, y: midY + perpY * gradient.widthA };
    widthHandleB = { x: midX - perpX * gradient.widthB, y: midY - perpY * gradient.widthB };
  }

  return (
    <>
      <DragHandle
        label="A"
        className={selected ? 'scale-125' : undefined}
        style={handleStyle(gradient.startX, gradient.startY)}
        ariaLabel={`Move gradient ${index + 1} start`}
        onPointerDown={onPointerDown(index, 'start')}
      />

      <DragHandle
        label="B"
        className={selected ? 'scale-125' : undefined}
        style={handleStyle(gradient.endX, gradient.endY)}
        ariaLabel={`Move gradient ${index + 1} end`}
        onPointerDown={onPointerDown(index, 'end')}
      />

      {widthHandleA && (
        <DragHandle
          label="WA"
          className="size-3! border-dashed!"
          style={{
            ...handleStyle(widthHandleA.x, widthHandleA.y),
            backgroundColor: undefined,
            opacity: 0.85,
          }}
          ariaLabel={`Move gradient ${index + 1} width A`}
          onPointerDown={onPointerDown(index, 'widthA')}
        />
      )}

      {widthHandleB && (
        <DragHandle
          label="WB"
          className="size-3! border-dashed!"
          style={{
            ...handleStyle(widthHandleB.x, widthHandleB.y),
            backgroundColor: undefined,
            opacity: 0.85,
          }}
          ariaLabel={`Move gradient ${index + 1} width B`}
          onPointerDown={onPointerDown(index, 'widthB')}
        />
      )}
    </>
  );
}

export function BlueRadialHandles({
  radial,
  width,
  height,
  onPointerDown,
}: {
  radial: BlueRadialControl;
  width: number;
  height: number;
  onPointerDown: (handle: BlueHandle) => (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <>
      <DragHandle
        label="C"
        className="bg-[#8ad8ff]"
        style={pointStyle(radial.centerX, radial.centerY)}
        ariaLabel="Move blue blur center"
        onPointerDown={onPointerDown('center')}
      />

      <DragHandle
        label="I"
        style={{
          ...pointStyle(radial.centerX + radiusToUnitX(radial.innerRadius, width, height), radial.centerY),
          borderColor: '#d7f3ff',
        }}
        ariaLabel="Move blue blur inner radius"
        onPointerDown={onPointerDown('inner')}
      />

      <DragHandle
        label="O"
        style={{
          ...pointStyle(radial.centerX + radiusToUnitX(radial.outerRadius, width, height), radial.centerY),
          borderColor: '#8ad8ff',
        }}
        ariaLabel="Move blue blur outer radius"
        onPointerDown={onPointerDown('outer')}
      />

      <DragHandle
        label="I"
        style={{
          ...pointStyle(
            radial.centerX,
            radial.centerY - radiusToUnitY(radial.innerRadius * radial.scaleY, width, height),
          ),
          borderColor: '#d7f3ff',
        }}
        ariaLabel="Move blue blur inner vertical radius"
        onPointerDown={onPointerDown('innerV')}
      />

      <DragHandle
        label="O"
        style={{
          ...pointStyle(
            radial.centerX,
            radial.centerY - radiusToUnitY(radial.outerRadius * radial.scaleY, width, height),
          ),
          borderColor: '#8ad8ff',
        }}
        ariaLabel="Move blue blur outer vertical radius"
        onPointerDown={onPointerDown('outerV')}
      />
    </>
  );
}
