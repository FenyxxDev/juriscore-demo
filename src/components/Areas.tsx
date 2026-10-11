import { Check } from 'lucide-react';
import { AREAS } from '../data';
import { cx } from './ui';

/** Multi-select of legal areas: typographic chips, one accent only when selected. */
export function AreaPicker({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  return (
    <div className={cx('flex flex-wrap gap-1.5 rounded-md', invalid && 'ring-2 ring-[var(--color-danger)]/20')}>
      {AREAS.map((a) => {
        const on = value.includes(a);
        return (
          <button
            type="button"
            key={a}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
              on
                ? 'border-[var(--color-teal)] bg-[var(--color-teal)]/[0.07] text-[var(--color-teal)]'
                : 'border-line-strong bg-white text-muted hover:border-[var(--color-faint)] hover:text-ink',
            )}
          >
            {on && <Check size={12} strokeWidth={2.5} />}
            {a}
          </button>
        );
      })}
    </div>
  );
}

/** Compact area indicator: formal name in a quiet outlined label, no separators. */
export function AreaTag({ area }: { area: string; full?: boolean }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-[4px] border border-line px-1.5 py-px text-[11.5px] text-muted">
      {area}
    </span>
  );
}

export function AreaList({ areas, full }: { areas: string[]; full?: boolean }) {
  if (!areas.length) return <span className="text-[12px] text-[var(--color-faint)]">Nenhuma área</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {areas.map((a) => (
        <AreaTag key={a} area={a} full={full} />
      ))}
    </span>
  );
}
