import { useState } from 'react';
import { Link } from 'react-router';
import { cx } from './ui';

/** Muted brand series palette (petroleum, ochre, slate blue). Always paired with legends and labels. */
export const SERIES = { a: '#185a63', b: '#c08a3e', c: '#5f86b0' } as const;

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export type WeekDay = { label: string; sub: string; today: boolean; values: number[] };

/** Stacked daily columns for the next 7 days. Values stack in series order; today is highlighted. */
export function WeekColumns({ days, series }: { days: WeekDay[]; series: { label: string; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const H = 96;
  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const total = d.values.reduce((a, b) => a + b, 0);
          return (
            <div
              key={i}
              className={cx('relative flex flex-col items-center rounded-md px-1 pb-1.5 pt-2', d.today && 'bg-[var(--color-subtle)] ring-1 ring-[var(--color-line-strong)]')}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="tnum mb-1 text-[12px] font-medium text-ink">{total || ''}</span>
              <div className="flex w-full max-w-[26px] flex-col-reverse gap-[2px]" style={{ height: H }}>
                {total === 0 && <div className="h-[2px] w-full rounded-full bg-[var(--color-line)]" />}
                {d.values.map((v, s) =>
                  v > 0 ? (
                    <div
                      key={s}
                      className={cx('w-full', s === d.values.length - 1 || d.values.slice(s + 1).every((x) => x === 0) ? 'rounded-t-[4px]' : '')}
                      style={{ height: (v / max) * (H - 8), background: series[s].color }}
                    />
                  ) : null,
                )}
              </div>
              <span className={cx('mt-1.5 text-[11.5px] capitalize', d.today ? 'font-semibold text-ink' : 'text-muted')}>{d.label}</span>
              <span className="tnum text-[11px] text-[var(--color-faint)]">{d.sub}</span>
              {hover === i && total > 0 && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] shadow-sm">
                  {series.map((s, k) => (
                    <div key={s.label} className="flex items-center gap-1.5 text-muted">
                      <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                      {s.label}: <span className="tnum font-medium text-ink">{d.values[k]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type Segment = { label: string; n: number; color: string; to?: string };

/** One horizontal 100% stacked bar with a labeled legend below (answers: how is the whole split?). */
export function StackedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.n, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-[var(--color-line)]">
        {segments.filter((s) => s.n > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.n}`} style={{ width: `${(s.n / (total || 1)) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((s) => {
          const body = (
            <>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tnum text-[13px] font-medium text-ink">
                {s.n}
                <span className="ml-1 text-[11.5px] font-normal text-[var(--color-faint)]">{total ? Math.round((s.n / total) * 100) : 0}%</span>
              </span>
            </>
          );
          return (
            <li key={s.label}>
              {s.to ? (
                <Link to={s.to} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-subtle">{body}</Link>
              ) : (
                <div className="flex items-center justify-between gap-2 px-1 py-0.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars, single series (answers: which category is largest?). */
export function HBars({ data, color = SERIES.a, to, max: maxItems = 6 }: { data: { nome: string; n: number; flag?: boolean }[]; color?: string; to?: (nome: string) => string; max?: number }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  if (!data.length) return <p className="py-4 text-center text-[13px] text-muted">Sem dados.</p>;
  return (
    <ul className="space-y-2.5">
      {data.slice(0, maxItems).map((r) => {
        const inner = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
              <span className="truncate text-ink group-hover:text-[var(--color-teal)]">{r.nome}</span>
              <span className={cx('tnum font-medium', r.flag ? 'text-[var(--color-warning)]' : 'text-ink')}>{r.n}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-[4px] bg-[var(--color-line)]/60">
              <div className="h-full rounded-r-[4px]" style={{ width: `${(r.n / max) * 100}%`, background: r.flag ? 'var(--color-accent)' : color }} />
            </div>
          </>
        );
        return <li key={r.nome}>{to ? <Link to={to(r.nome)} className="group block">{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}

/** Tiny proportion meter for a count (e.g. overdue share). */
export function Meter({ parts }: { parts: { n: number; color: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return (
    <div className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-[var(--color-line)]">
      {parts.filter((p) => p.n > 0).map((p) => (
        <div key={p.label} title={`${p.label}: ${p.n}`} style={{ width: `${(p.n / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}
