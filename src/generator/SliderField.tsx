import { Slider } from '@base-ui/react/slider';

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const display = format ? format(value) : String(value);

  return (
    <Slider.Root
      className="flex flex-col gap-1"
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={(value) => onChange(value as number)}
    >
      <div className="flex items-center justify-between">
        <Slider.Label className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </Slider.Label>
        <Slider.Value className="min-w-10 text-right font-mono text-[11px] tabular-nums text-zinc-500">
          {() => display}
        </Slider.Value>
      </div>
      <Slider.Control className="flex h-4 items-center">
        <Slider.Track className="relative h-[3px] w-full rounded-full bg-white/10">
          <Slider.Indicator className="absolute h-full rounded-full bg-[#6670c0]" />
          <Slider.Thumb className="block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#6670c0] bg-zinc-900 shadow-sm transition-colors hover:bg-[#6670c0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#89a2ff] cursor-pointer" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
