import { Input } from '@base-ui/react/input';
import { cn } from '../lib/utils';

export function TextInput({
  className,
  value,
  onChange,
}: {
  className?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      type="text"
      className={cn(
        'w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[13px] text-zinc-200 outline-none transition focus:border-indigo-300/40',
        className,
      )}
      value={value}
      onChange={onChange}
    />
  );
}
