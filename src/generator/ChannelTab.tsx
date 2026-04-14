import { Tabs } from '@base-ui/react/tabs';

export function ChannelTab({
  value,
  label,
  title,
  color,
}: {
  value: string;
  label: string;
  title: string;
  color: string;
}) {
  return (
    <Tabs.Tab
      value={value}
      title={title}
      className="group relative cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 font-mono text-[13px] font-semibold text-zinc-500 transition-all hover:bg-white/8 hover:text-zinc-300 data-active:bg-white/10 data-active:text-zinc-100"
    >
      <span
        className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full transition-all group-data-active:w-3/5"
        style={{ backgroundColor: color }}
      />
      {label}
    </Tabs.Tab>
  );
}
