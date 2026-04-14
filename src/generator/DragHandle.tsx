import { cn } from '../lib/utils';

export function DragHandle({
  label,
  style,
  ariaLabel,
  className,
  onPointerDown,
}: {
  label: string;
  style: React.CSSProperties;
  ariaLabel: string;
  className?: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white/90 bg-black/70 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_6px_18px_rgba(0,0,0,0.35)] transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#89a2ff]',
        className,
      )}
      style={style}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    >
      <span className="pointer-events-none absolute left-1/2 -top-[18px] -translate-x-1/2 text-[9px] tracking-[0.08em] text-white/70">
        {label}
      </span>
    </button>
  );
}
