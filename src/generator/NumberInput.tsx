import { NumberField } from '@base-ui/react/number-field';

export function NumberInput({
  value,
  min,
  max,
  step = 1,
  placeholder,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  onChange: (value: number) => void;
}) {
  return (
    <NumberField.Root value={value || null} onValueChange={(val) => onChange(val ?? 0)} min={min} max={max} step={step}>
      <NumberField.Input
        placeholder={placeholder}
        className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[13px] tabular-nums text-zinc-200 outline-none transition focus:border-indigo-300/40"
      />
    </NumberField.Root>
  );
}
