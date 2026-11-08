import { useMemo, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, Search } from 'lucide-react';
import { Link } from 'react-router';
import { Card, cx } from '../components/ui';
import { diasAte } from '../data';
import { procLink, useStore } from '../store';

/** Mesa de revisão do advogado; os registros vêm do workspace privado da conta. */
export function AttorneyReviewDesk() {
  const { role, user, processos } = useStore();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => processos.filter((p) => `${p.numero} ${p.cliente} ${p.area} ${p.resumo}`.toLowerCase().includes(query.toLowerCase())), [processos, query]);
  if (role !== 'Advogado') return <main className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-xl font-semibold text-ink">Acesso restrito</h1><p className="mt-2 text-sm text-muted">Esta mesa de revisão é exclusiva para advogados.</p></main>;
  const dueSoon = processos.filter((p) => p.prazos.some((d) => d.status !== 'concluido' && diasAte(d.data) >= 0 && diasAte(d.data) <= 7)).length;
  return <main className="mx-auto max-w-[1200px] px-6 py-7 md:px-8">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Prática jurídica · {user.nome}</p><h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Mesa de análise</h1><p className="mt-1 text-[13.5px] text-muted">Revise o contexto e os próximos marcos dos processos desta conta.</p></div><div className="border-l-2 border-[var(--color-teal)] pl-3"><p className="text-[11px] uppercase tracking-wide text-muted">Processos com prazo nos próximos 7 dias</p><p className="mt-1 text-xl font-semibold text-ink">{dueSoon}</p></div></header>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-muted"><ClipboardCheck size={16}/><span>{processos.length} processos da conta</span></div><label className="flex h-9 min-w-[240px] items-center gap-2 rounded border border-line bg-white px-3"><Search size={15}/><input aria-label="Buscar processo para análise" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente, processo ou área" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
    <section className="divide-y divide-line border-y border-line bg-white" aria-label="Processos para revisão">{rows.map((p) => {
      const next = p.prazos.filter((d) => d.status !== 'concluido').sort((a,b) => diasAte(a.data) - diasAte(b.data))[0];
      const late = next ? diasAte(next.data) < 0 : false;
      return <article key={p.numero} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_210px_165px] md:items-center hover:bg-slate-50/70"><div className="min-w-0"><p className="font-mono text-[12px] font-medium text-[var(--color-brand)]">{p.numero}</p><h2 className="mt-1 truncate text-[15px] font-semibold text-ink">{p.cliente}</h2><p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-muted">{p.resumo}</p><p className="mt-2 text-[11px] text-muted">{p.area} · Atualizado {p.atualizacao}</p></div><div className="border-l border-line pl-3"><p className="text-[10px] uppercase tracking-wide text-muted">Próximo marco</p>{next ? <><p className="mt-1 text-sm font-medium text-ink">{next.descricao}</p><p className={cx('mt-0.5 text-xs',late ? 'text-rose-700' : 'text-muted')}>{next.data}{late ? ' · vencido' : ''}</p></> : <p className="mt-1 text-sm text-muted">Sem prazo pendente</p>}</div><Link to={procLink(p.numero)} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-brand)] hover:underline">Abrir processo <ArrowUpRight size={14}/></Link></article>;
    })}{rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted">Nenhum processo corresponde à busca.</p>}</section>
    <p className="mt-3 text-[11px] text-muted">O campo “responsável” identifica o registo do processo e não concede acesso a outras contas.</p>
  </main>;
}
