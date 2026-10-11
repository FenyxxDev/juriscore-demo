import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowUpRight, ChevronDown, CircleSlash, ExternalLink, FileSearch, HelpCircle, Lightbulb, PowerOff, RotateCw, Sparkles } from 'lucide-react';
import { cx } from './ui';
import type { AIResult, AISection } from '../ai';

const CONF: Record<string, { label: string; cls: string }> = {
  alta: { label: 'Resposta com fontes', cls: 'text-[var(--color-success)]' },
  parcial: { label: 'Resposta parcial', cls: 'text-[var(--color-warning)]' },
  baixa: { label: 'Baixa confiança', cls: 'text-[var(--color-warning)]' },
};

const KIND: Partial<Record<AIResult['kind'], { label: string; Icon: typeof Sparkles; cls: string }>> = {
  'sem-resultado': { label: 'Nenhum resultado', Icon: CircleSlash, cls: 'text-muted' },
  'contexto-insuficiente': { label: 'Contexto insuficiente', Icon: FileSearch, cls: 'text-[var(--color-warning)]' },
  ambiguidade: { label: 'Mais de um contexto', Icon: HelpCircle, cls: 'text-[var(--color-info)]' },
  'baixa-confianca': { label: 'Baixa confiança', Icon: AlertTriangle, cls: 'text-[var(--color-warning)]' },
  indisponivel: { label: 'Serviço indisponível', Icon: PowerOff, cls: 'text-[var(--color-danger)]' },
};

/** Estado "processando" compartilhado. */
export function AIWorking({ label = 'Consultando os registros…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-line bg-white px-3.5 py-3 text-[13px] text-muted">
      <span className="juris-dot-typing flex gap-1" aria-hidden><span /><span /><span /></span>
      {label}
    </div>
  );
}

/** Falha técnica: nunca apresentada como "nenhum resultado". */
export function AIFailed({ retry, manual }: { retry: () => void; manual?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/6 px-3.5 py-3 text-[13px]">
      <p className="font-medium text-[var(--color-danger)]">Não foi possível consultar o assistente neste momento.</p>
      <p className="mt-0.5 text-muted">Isso não significa que não existam registros.</p>
      <div className="mt-2 flex gap-4">
        <button onClick={retry} className="inline-flex items-center gap-1.5 font-medium text-[var(--color-teal)] hover:underline"><RotateCw size={13} /> Tentar novamente</button>
        {manual && <Link to={manual} className="font-medium text-muted hover:text-ink hover:underline">Consultar os registros manualmente</Link>}
      </div>
    </div>
  );
}

export function AIResultView({
  result,
  at,
  onNavigate,
  onChoose,
  manual,
  flat,
  retry,
}: {
  result: AIResult;
  at?: string;
  onNavigate?: () => void;
  onChoose?: (query: string, numero?: string) => void;
  retry?: () => void;
  manual?: string;
  flat?: boolean;
}) {
  const k = KIND[result.kind];
  const conf = k ?? { ...CONF[result.confidence], Icon: Sparkles };
  const [open, setOpen] = useState(false);
  const more = result.more?.filter((s) => s.body || s.lines?.length) ?? [];
  const muted = result.kind === 'sem-resultado' || result.kind === 'contexto-insuficiente' || result.kind === 'indisponivel';
  return (
    <div className={cx('overflow-hidden bg-white', !flat && 'rounded-md border border-line')}>
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
        <span className="eyebrow flex items-center gap-1.5 text-[var(--color-teal)]"><Sparkles size={11} /> Gerado por IA</span>
        <span className={cx('flex items-center gap-1 text-[11px] font-medium', conf.cls)}>
          {k && <k.Icon size={12} />} {conf.label}
        </span>
      </div>

      <div className="px-3.5 py-3">
        {result.title && <p className="mb-1 text-[13.5px] font-semibold text-ink">{result.title}</p>}
        {result.text && <p className={cx('text-[13px] leading-relaxed', muted ? 'text-muted' : 'text-ink')}>{result.text}</p>}

        {result.lines && result.lines.length > 0 && <Bullets lines={result.lines} />}

        {result.sections?.map((s) => <Section key={s.title} s={s} onNavigate={onNavigate} />)}

        {result.insights && result.insights.length > 0 && (
          <Section s={{ title: 'Insight da IA', tone: 'insight', ...(result.insights.length === 1 ? { body: result.insights[0] } : { lines: result.insights }) }} />
        )}

        {open && more.map((s) => <Section key={s.title} s={s} />)}

        {result.choices && (
          <div className="mt-3 flex flex-col gap-1.5">
            {result.choices.map((c) => (
              <button key={c.label} onClick={() => onChoose?.(c.query, c.numero)} className="rounded-md border border-line-strong px-3 py-2 text-left transition-colors hover:border-[var(--color-teal)]">
                <span className="block text-[13px] font-medium text-ink">{c.label}</span>
                {c.hint && <span className="block text-[12px] text-muted">{c.hint}</span>}
              </button>
            ))}
          </div>
        )}

        {((result.actions && result.actions.length > 0) || more.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {result.actions?.map((a, i) =>
              a.to ? (
                <Link key={i} to={a.to} onClick={onNavigate} className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
                  {a.label} <ArrowUpRight size={12} />
                </Link>
              ) : (
                <button key={i} onClick={a.run} className="rounded-md bg-[var(--color-teal)] px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-[var(--color-teal-hover)]">{a.label}</button>
              ),
            )}
            {more.length > 0 && (
              <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 px-1 py-1.5 text-[12.5px] font-medium text-[var(--color-teal)] hover:underline">
                {open ? 'Ver menos' : 'Ver mais'} <ChevronDown size={13} className={cx('transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>
        )}

        {result.kind === 'indisponivel' ? (
          <div className="mt-2.5 flex gap-4 text-[12.5px]">
            {retry && <button onClick={retry} className="inline-flex items-center gap-1.5 font-medium text-[var(--color-teal)] hover:underline"><RotateCw size={13} /> Tentar novamente</button>}
            {manual && <Link to={manual} onClick={onNavigate} className="font-medium text-muted hover:text-ink hover:underline">Consultar os registros manualmente</Link>}
          </div>
        ) : (
          muted && manual && <Link to={manual} onClick={onNavigate} className="mt-2.5 inline-block text-[12.5px] font-medium text-[var(--color-teal)] hover:underline">Consultar os registros manualmente</Link>
        )}
      </div>

      {result.sources && result.sources.length > 0 && (
        <div className="border-t border-line bg-subtle px-3.5 py-2.5">
          <p className="eyebrow mb-1.5">Fontes</p>
          <div className="flex flex-col gap-1">
            {result.sources.map((s, i) => (
              <Link key={i} to={s.to} onClick={onNavigate} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-teal)] hover:underline">
                <ExternalLink size={12} className="shrink-0" /> <span className="truncate">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-line px-3.5 py-1.5">
        <p className="text-[10.5px] text-[var(--color-faint)]">
          {at ? `Gerado em ${at} · ` : ''}Baseado apenas em registros do JurisCore. Não constitui parecer jurídico.
        </p>
      </div>
    </div>
  );
}

function Section({ s, onNavigate }: { s: AISection; onNavigate?: () => void }) {
  if (s.items)
    return (
      <div className="mt-3 first:mt-0">
        <p className="text-[13px] font-semibold text-ink">{s.title}</p>
        <ul className="mt-1.5 space-y-1">
          {s.items.map((it, i) => (
            <li key={i}>
              <Link to={it.to} onClick={onNavigate} className="inline-flex items-start gap-1.5 text-[12.5px] font-medium leading-relaxed text-[var(--color-teal)] hover:underline">
                <ExternalLink size={12} className="mt-1 shrink-0" /> <span>{it.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  if (s.tone === 'insight')
    return (
      <div className="mt-3 rounded-md border border-[var(--color-teal)]/20 bg-[var(--color-teal)]/5 px-3 py-2.5">
        <p className="eyebrow mb-1 flex items-center gap-1.5 text-[var(--color-teal)]"><Lightbulb size={11} /> {s.title}</p>
        {s.body && <p className="text-[12.5px] leading-relaxed text-ink">{s.body}</p>}
        {s.lines && <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink">{s.lines.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        <p className="mt-2 text-[11.5px] text-muted">Gerado por IA. Revise antes de utilizar na condução do caso.</p>
      </div>
    );
  return (
    <div className="mt-3">
      <p className="eyebrow mb-1">{s.title}</p>
      {s.body && <p className="text-[13px] leading-relaxed text-ink">{s.body}</p>}
      {s.lines && <Bullets lines={s.lines} />}
    </div>
  );
}

function Bullets({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5 text-[12.5px] text-muted">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-teal)]" />
          <span className="leading-relaxed">{l}</span>
        </li>
      ))}
    </ul>
  );
}
