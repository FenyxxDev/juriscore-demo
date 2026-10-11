import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Download, FileText, Sparkles, Upload } from 'lucide-react';
import { Button, Card, Field, Input, Modal, SearchInput, Select, useToast } from '../components/ui';
import { AreaTag } from '../components/Areas';
import { AIResultView, AIWorking } from '../components/AIResult';
import { type AIResult, useAI } from '../ai';
import { AREAS, diasAte } from '../data';
import { procLink, useStore } from '../store';

export function Documentos() {
  const { documentos, processos, dispatch, can } = useStore();
  const ai = useAI();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [cliente, setCliente] = useState('todos');
  const [area, setArea] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [upOpen, setUpOpen] = useState(false);
  const [resumo, setResumo] = useState<{ nome: string; result: AIResult | null } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const areaOf = useMemo(() => new Map(processos.map((p) => [p.numero, p.area])), [processos]);
  const tipos = useMemo(() => [...new Set(documentos.map((d) => d.tipo))].sort(), [documentos]);
  const clientes = useMemo(() => [...new Set(documentos.map((d) => d.cliente))].sort(), [documentos]);
  const areas = AREAS.filter((a) => documentos.some((d) => areaOf.get(d.numero) === a));
  const filtered = documentos.filter((d) => {
    if (tipo !== 'todos' && d.tipo !== tipo) return false;
    if (cliente !== 'todos' && d.cliente !== cliente) return false;
    if (area !== 'todos' && areaOf.get(d.numero) !== area) return false;
    if (periodo !== 'todos') {
      const n = -diasAte(d.data);
      if (!(n >= 0 && n <= Number(periodo))) return false;
    }
    return q === '' || `${d.nome} ${d.cliente} ${d.numero} ${d.tipo}`.toLowerCase().includes(q.toLowerCase());
  });
  const active = [tipo, cliente, area, periodo].filter((f) => f !== 'todos').length + (q ? 1 : 0);
  const reset = () => {
    setQ('');
    setTipo('todos');
    setCliente('todos');
    setArea('todos');
    setPeriodo('todos');
  };

  const resumir = (id: string, nome: string, numero: string) => {
    window.clearTimeout(timer.current);
    setResumo({ nome, result: null });
    timer.current = window.setTimeout(() => setResumo({ nome, result: ai.summarizeDocument(id, numero) }), 700);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-ink">Documentos</h1>
          <p className="mt-1 text-muted">Repositório central de peças e provas anexadas aos processos.</p>
        </div>
        {can('anexarDocumentos') && (
          <Button onClick={() => setUpOpen(true)} icon={<Upload size={16} />}>
            Enviar documento
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[260px] flex-1">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, cliente ou processo..." />
        </div>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de documento">
          <option value="todos">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente">
          <option value="todos">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área jurídica">
          <option value="todos">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
          <option value="todos">Qualquer data</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </Select>
        {active > 0 && (
          <button onClick={reset} className="text-[13px] font-medium text-teal hover:underline">
            Limpar filtros ({active})
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Documento</th>
              <th className="px-5 py-3">Processo</th>
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Enviado em</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((d) => (
              <tr key={`${d.numero}-${d.id}`} className="hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <FileText size={17} />
                    </span>
                    <div className="min-w-0">
                      <Link to={procLink(d.numero, 'Documentos', d.id)} className="block truncate font-medium text-ink hover:text-teal">
                        {d.nome}
                      </Link>
                      <p className="text-xs text-muted">{d.tipo}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={procLink(d.numero, 'Documentos', d.id)} className="font-medium text-teal hover:underline">
                    {d.numero.split('.')[0]}
                  </Link>
                  {areaOf.get(d.numero) && (
                    <span className="mt-0.5 block">
                      <AreaTag area={areaOf.get(d.numero)!} />
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-muted">{d.cliente}</td>
                <td className="px-5 py-3.5 text-muted">{d.data}</td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => resumir(d.id, d.nome, d.numero)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium text-brand hover:border-teal hover:bg-teal/5"
                    >
                      <Sparkles size={14} /> Resumir com IA
                    </button>
                    <button aria-label="Baixar" className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:bg-slate-50">
                      <Download size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-muted">
            {documentos.length === 0 ? 'Nenhum documento anexado ainda.' : 'Nenhum documento corresponde à busca ou aos filtros.'}
          </p>
        )}
      </Card>

      {upOpen && <UploadModal processos={processos} onClose={() => setUpOpen(false)} dispatch={dispatch} />}

      <Modal
        open={!!resumo}
        onClose={() => {
          window.clearTimeout(timer.current);
          setResumo(null);
        }}
        title={resumo ? `Resumo · ${resumo.nome}` : 'Resumo'}
      >
        {resumo && (resumo.result ? <AIResultView result={resumo.result} /> : <AIWorking label="Lendo o documento…" />)}
      </Modal>
    </div>
  );
}

function UploadModal({
  processos,
  onClose,
  dispatch,
}: {
  processos: ReturnType<typeof useStore>['processos'];
  onClose: () => void;
  dispatch: ReturnType<typeof useStore>['dispatch'];
}) {
  const toast = useToast();
  const [numero, setNumero] = useState(processos[0]?.numero ?? '');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('Petição');

  return (
    <Modal open onClose={onClose} title="Enviar documento">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim() || !numero) return;
          dispatch({ type: 'addDocumento', numero, documento: { nome: nome.trim(), tipo } });
          toast({ tone: 'success', message: 'Documento anexado ao processo.' });
          onClose();
        }}
      >
        <Field label="Processo">
          <Select value={numero} onChange={(e) => setNumero(e.target.value)}>
            {processos.map((p) => (
              <option key={p.numero} value={p.numero}>
                {p.numero.split('.')[0]} · {p.cliente}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome do documento">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contestação.pdf" autoFocus />
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {['Petição', 'Contrato', 'Procuração', 'Prova', 'Decisão', 'Comprovante', 'Outros'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-muted">
          <Upload size={20} className="mx-auto mb-2 text-slate-400" />
          Arraste um arquivo ou clique para selecionar (simulado neste MVP)
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Anexar documento</Button>
        </div>
      </form>
    </Modal>
  );
}
