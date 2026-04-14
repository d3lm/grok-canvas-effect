import { SectionLabel } from './SectionLabel';

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </label>
  );
}
