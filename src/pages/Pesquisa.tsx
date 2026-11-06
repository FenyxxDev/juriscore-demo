import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Briefcase, FileText, Search, Sparkles, Users } from 'lucide-react';
import { Card, Select, StatusBadge, cx } from '../components/ui';
import { type AIResult, useAI } from '../ai';
import { procLink, useStore } from '../store';
import { AreaTag } from '../components/Areas';
import { AIFailed, AIResultView, AIWorking } from '../components/AIResult';
import { areaCurta, diasAte } from '../data';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(['quais', 'qual', 'processo', 'processos', 'cliente', 'clientes', 'possuem', 'prazo', 'prazos', 'esta', 'essa', 'semana', 'mostre', 'para', 'com', 'que', 'dos', 'das', 'meus', 'minhas', 'equipe', 'sem', 'atualizacao', 'recente', 'documentos', 'foram', 'adicionados', 'recentemente', 'estao', 'todos', 'onde', 'como', 'tem', 'hoje', 'direito', 'situacoes', 'situacao', 'semelhantes', 'similares', 'parecidos']);
const EXEMPLOS = ['Quais processos têm prazo esta semana?', 'Quais processos estão sem atualização recente?', 'Quais documentos foram adicionados recentemente?', 'Mostre os processos trabalhistas desta conta.', 'Quais processos possuem situações semelhantes?'];
type IAState = { s: 'working' } | { s: 'done'; r: AIResult } | { s: 'error' } | null;

export function Pesquisa() {
  const { processos, clientes, advogados, documentos } = useStore();
  const ai = useAI();
  const [params] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [ia, setIa] = useState<IAState>(null);
  const perguntar = (text: string) => {
    if (!text.trim()) return setIa(null);
    setIa({ s: 'working' });
    setTimeout(() => {
      try {
        setIa({ s: 'done', r: ai.answer({ scope: 'pesquisa' }, text) });
      } catch {
        setIa({ s: 'error' });
      }
    }, 600);
  };

  useEffect(() => {
    const p = params.get('q') ?? '';
    setQ(p);
    setSubmitted(p);
    perguntar(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Filtros combináveis (RF14)
  const [status, setStatus] = useState('todos');
  const [cliente, setCliente] = useState('todos');
  const [resp, setResp] = useState('todos');
  const [area, setArea] = useState('todos');
  const [tribunal, setTribunal] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');

  const areas = useMemo(() => [...new Set(processos.map((p) => p.area))], [processos]);
  const tribunais = useMemo(() => [...new Set(processos.map((p) => p.tribunal))], [processos]);

  // Correspondência por termos relevantes: perguntas em linguagem natural não zeram a lista.
  const terms = norm(submitted).split(/[^a-z0-9./-]+/).filter((t) => t.length > 2 && !STOP.has(t) && !/^(trabalhist|civel|civil|previdenci|familia|tributari|consumidor|penal|empresari)/.test(t));
  const hit = (s: string) => terms.length === 0 || terms.some((t) => norm(s).includes(t));
  const inPeriodo = (data: string) =>
    periodo === 'todos' || (periodo === '7' ? diasAte(data) >= -7 : periodo === '30' ? diasAte(data) >= -30 : diasAte(data) < -30);

  const procResults = processos.filter(
    (p) =>
      (status === 'todos' || p.status === status) &&
      (cliente === 'todos' || p.clienteId === cliente) &&
      (resp === 'todos' || p.responsavel === resp) &&
      (area === 'todos' || p.area === area) &&
      (tribunal === 'todos' || p.tribunal === tribunal) &&
      inPeriodo(p.atualizacao) &&
      (hit(p.numero) || hit(p.cliente) || hit(p.area) || hit(p.responsavel) || hit(p.tribunal) || p.partes.some((x) => hit(x.nome))),
  );
  const cliResults = submitted && terms.length ? clientes.filter((c) => hit(c.nome) || hit(c.documento)) : [];
  const docResults = submitted && terms.length ? documentos.filter((d) => (hit(d.nome) || hit(d.tipo) || hit(d.cliente)) && inPeriodo(d.data)) : [];

  const run = (text = q) => {
    setQ(text);
    setSubmitted(text);
    perguntar(text);
  };
  const activeFilters = [status, cliente, resp, area, tribunal, periodo].filter((f) => f !== 'todos').length;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-6">
        <p className="eyebrow">Pesquisa</p>
        <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-ink">Pergunte aos seus registros</h1>
        <p className="mt-1 text-[12.5px] text-muted">As respostas usam regras locais e dados desta conta. Não há modelo generativo nem envio a serviços externos.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="relative mb-4"
      >
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Número, cliente, parte, documento ou uma pergunta'
          className="h-13 w-full rounded-xl border border-line bg-white py-3.5 pl-12 pr-28 text-sm text-ink shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-teal-hover)]">
          Buscar
        </button>
      </form>
      {!submitted && (
        <div className="-mt-1 mb-5 flex flex-wrap gap-1.5">
          {EXEMPLOS.map((e) => (
            <button key={e} onClick={() => run(e)} className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Filtros combináveis */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="todos">Status: todos</option>
          <option value="em-andamento">Em andamento</option>
          <option value="aguardando">Aguardando ação</option>
          <option value="atrasado">Atrasado</option>
          <option value="encerrado">Encerrado</option>
        </Select>
        <Select value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
          <option value="todos">Cliente: todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="todos">Responsável: todos</option>
          {advogados.map((a) => (
            <option key={a.id}>{a.nome}</option>
          ))}
        </Select>
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
          <option value="todos">Área: todas</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <Select value={tribunal} onChange={(e) => setTribunal(e.target.value)} aria-label="Tribunal">
          <option value="todos">Tribunal: todos</option>
          {tribunais.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
          <option value="todos">Período: todos</option>
          <option value="7">Atualizados em 7 dias</option>
          <option value="30">Atualizados em 30 dias</option>
          <option value="parados">Sem atualização há +30 dias</option>
        </Select>
        {activeFilters > 0 && (
          <button
            onClick={() => {
              setStatus('todos');
              setCliente('todos');
              setResp('todos');
              setArea('todos');
              setTribunal('todos');
              setPeriodo('todos');
            }}
            className="text-[13px] font-medium text-teal hover:underline"
          >
            Limpar filtros ({activeFilters})
          </button>
        )}
      </div>

      {/* Interpretação da IA */}
      {ia && (
        <div className="mb-6">
          {ia.s === 'working' && <AIWorking label="Analisando a pergunta nos registros locais…" />}
          {ia.s === 'error' && <AIFailed retry={() => perguntar(submitted)} />}
          {ia.s === 'done' && <AIResultView result={ia.r} onChoose={(query) => run(query)} />}
        </div>
      )}

      {/* Resultados */}
      <div className="space-y-6">
        <ResultGroup icon={<Briefcase size={16} />} title="Processos" count={procResults.length}>
          {procResults.map((p) => (
            <Link
              key={p.numero}
              to={`/processos/${encodeURIComponent(p.numero)}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{p.numero.split('.')[0]} · {p.cliente}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted"><AreaTag area={p.area} /> · {p.tribunal} · {p.responsavel} · atualizado em {p.atualizacao}</p>
              </div>
              <StatusBadge tone={p.status} />
            </Link>
          ))}
        </ResultGroup>

        {cliResults.length > 0 && (
          <ResultGroup icon={<Users size={16} />} title="Clientes" count={cliResults.length}>
            {cliResults.map((c) => (
              <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60">
                <div>
                  <p className="font-medium text-ink">{c.nome}</p>
                  <p className="text-xs text-muted">{c.tipo} · {c.documento}</p>
                </div>
                <StatusBadge tone={c.status} />
              </Link>
            ))}
          </ResultGroup>
        )}

        {docResults.length > 0 && (
          <ResultGroup icon={<FileText size={16} />} title="Documentos" count={docResults.length}>
            {docResults.map((d) => (
              <Link key={`${d.numero}-${d.id}`} to={procLink(d.numero, 'Documentos', d.id)} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60">
                <div>
                  <p className="font-medium text-ink">{d.nome}</p>
                  <p className="text-xs text-muted">{d.tipo} · {d.cliente} · {d.numero.split('.')[0]}</p>
                </div>
                <span className="tnum text-xs text-muted">{d.data}</span>
              </Link>
            ))}
          </ResultGroup>
        )}

        {submitted && procResults.length + cliResults.length + docResults.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">Nenhum registro corresponde a "{submitted}"{activeFilters ? ' com os filtros aplicados' : ''}.</p>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand')}>{icon}</span>
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted">{count}</span>
      </div>
      {count === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-muted">Nenhum {title.toLowerCase().replace(/s$/, '')} corresponde à busca ou aos filtros.</Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">{children}</Card>
      )}
    </section>
  );
}
