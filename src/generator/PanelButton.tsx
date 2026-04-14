export function PanelButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:cursor-default disabled:opacity-40 cursor-pointer"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
