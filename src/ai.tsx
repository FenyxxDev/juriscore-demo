import { useNavigate } from 'react-router';
import { procLink, toStamp, useStore } from './store';
import { AREAS, type Documento, type Processo, areaCurta, diasAte, parseData } from './data';

/** A source citation the UI renders as a link to the original record. */
export type Source = { label: string; to: string; kind?: 'processo' | 'movimentacao' | 'documento' | 'prazo' | 'audiencia' | 'cliente' | 'tarefa' | 'agenda' };
/** A concrete action the assistant can execute on real records (human stays in control). */
export type AIAction = { label: string; run?: () => void; to?: string };
/** Disambiguation option: re-asks with a precise context. */
export type AIChoice = { label: string; hint?: string; query: string; numero?: string };
export type AISection = { title: string; body?: string; lines?: string[]; items?: { text: string; to: string }[]; tone?: 'insight' };

/** Response classification driving the UI state. */
export type AIKind =
  | 'resposta'
  | 'sem-resultado'
  | 'ambiguidade'
  | 'contexto-insuficiente'
  | 'baixa-confianca'
  | 'indisponivel';
export type AIConfidence = 'alta' | 'parcial' | 'baixa';

export type AIResult = {
  kind: AIKind;
  confidence: AIConfidence;
  title?: string;
  text: string;
  sections?: AISection[];
  lines?: string[];
  insights?: string[];
  sources?: Source[];
  actions?: AIAction[];
  choices?: AIChoice[];
  /** Secondary details, hidden behind "Ver mais". */
  more?: AISection[];
  /** Always true: every AI output must be identifiable as generated. */
  generated: true;
};

export const NAO_LOC = 'Não localizado nos registros.';
export const NAO_CONF = 'Não foi possível confirmar essa informação nos registros disponíveis.';

/* ------------------------------------------------ Legal knowledge map
 * Lightweight glossary used only to interpret movement/document types and to
 * phrase insights coherently with the process area. It never creates facts or
 * deadlines: every note is framed as something to verify in the records. */
type Leitura = { re: RegExp; nome: string; nota: string };
const GERAL: Leitura[] = [
  { re: /senten/i, nome: 'sentença', nota: 'Vale verificar se há recurso cabível e conferir o prazo correspondente nos registros.' },
  { re: /embargo/i, nome: 'embargos', nota: 'Vale conferir o ponto questionado e se há manifestação pendente.' },
  { re: /contesta/i, nome: 'contestação', nota: 'Vale revisar os argumentos apresentados e verificar se há réplica a preparar.' },
  { re: /tutela|liminar/i, nome: 'tutela de urgência', nota: 'Vale confirmar se a medida foi cumprida e se há prazo associado.' },
  { re: /intima/i, nome: 'intimação', nota: 'Confira o prazo relacionado à intimação antes de definir a próxima providência.' },
  { re: /despacho/i, nome: 'despacho', nota: 'Vale verificar se o despacho determinou alguma providência ainda pendente.' },
  { re: /decis/i, nome: 'decisão', nota: 'Essa decisão pode exigir uma nova manifestação. Vale revisar o prazo relacionado.' },
  { re: /audi[eê]ncia|designa/i, nome: 'audiência', nota: 'Vale confirmar a preparação e os participantes da audiência.' },
  { re: /recurso|apela|agravo/i, nome: 'recurso', nota: 'Vale acompanhar o processamento do recurso e eventual prazo de contrarrazões.' },
  { re: /arquiv/i, nome: 'arquivamento', nota: 'Vale confirmar se não restam providências pendentes.' },
];
export const AREA_KB: Record<string, { termos: string[]; leituras: Leitura[] }> = {
  'Direito Trabalhista': {
    termos: ['reclamação trabalhista', 'reclamante', 'reclamada', 'audiência una', 'verbas rescisórias', 'recurso ordinário', 'embargos de declaração'],
    leituras: [
      { re: /senten/i, nome: 'sentença', nota: 'Em matéria trabalhista, vale verificar o cabimento de recurso ordinário e conferir o prazo nos registros.' },
      { re: /audi[eê]ncia|designa/i, nome: 'audiência', nota: 'Na Justiça do Trabalho, vale confirmar o comparecimento das partes e das testemunhas.' },
      { re: /c[aá]lculo|liquida/i, nome: 'liquidação', nota: 'Vale conferir os cálculos com os valores registrados no processo.' },
    ],
  },
  'Direito Civil': {
    termos: ['petição inicial', 'contestação', 'réplica', 'tutela de urgência', 'apelação', 'cumprimento de sentença'],
    leituras: [
      { re: /senten/i, nome: 'sentença', nota: 'Vale verificar o cabimento de apelação ou de embargos de declaração e conferir o prazo nos registros.' },
      { re: /cumprimento/i, nome: 'cumprimento de sentença', nota: 'Vale conferir se houve intimação para pagamento e o prazo correspondente.' },
    ],
  },
  'Direito Tributário': {
    termos: ['execução fiscal', 'certidão de dívida ativa', 'embargos à execução', 'exceção de pré-executividade', 'garantia do juízo'],
    leituras: [
      { re: /execu/i, nome: 'execução fiscal', nota: 'Vale verificar a situação da garantia do juízo e o prazo para embargos à execução nos registros.' },
      { re: /senten/i, nome: 'sentença', nota: 'Vale verificar o cabimento de apelação e eventual remessa necessária.' },
    ],
  },
  'Direito Previdenciário': {
    termos: ['benefício', 'INSS', 'perícia médica', 'laudo pericial', 'tutela antecipada', 'recurso inominado'],
    leituras: [
      { re: /per[ií]cia|laudo/i, nome: 'perícia', nota: 'Vale revisar o laudo e verificar se há prazo para manifestação sobre ele.' },
      { re: /senten/i, nome: 'sentença', nota: 'Vale verificar o recurso cabível e a implantação do benefício, se deferido.' },
    ],
  },
  'Direito de Família': {
    termos: ['alimentos', 'guarda', 'regime de convivência', 'divórcio', 'partilha', 'acordo'],
    leituras: [
      { re: /acordo|concilia/i, nome: 'acordo', nota: 'Vale conferir se o acordo foi homologado e se as condições estão registradas.' },
      { re: /senten/i, nome: 'sentença', nota: 'Vale verificar o cabimento de apelação e o cumprimento das obrigações fixadas.' },
    ],
  },
  'Direito Penal': {
    termos: ['denúncia', 'resposta à acusação', 'instrução', 'alegações finais', 'apelação criminal'],
    leituras: [{ re: /senten/i, nome: 'sentença', nota: 'Vale verificar o cabimento de apelação criminal e conferir o prazo nos registros.' }],
  },
  'Direito Empresarial': {
    termos: ['contrato social', 'dissolução', 'recuperação judicial', 'assembleia', 'habilitação de crédito'],
    leituras: [{ re: /recupera/i, nome: 'recuperação judicial', nota: 'Vale acompanhar o plano e as datas de assembleia registradas.' }],
  },
  'Direito do Consumidor': {
    termos: ['relação de consumo', 'inversão do ônus da prova', 'dano moral', 'juizado especial', 'recurso inominado'],
    leituras: [{ re: /senten/i, nome: 'sentença', nota: 'Vale verificar o cabimento de recurso inominado ou apelação, conforme o rito.' }],
  },
};
/** Interprets a movement/document type in light of the process area. */
export function leituraJuridica(area: string, texto: string): Leitura | undefined {
  return AREA_KB[area]?.leituras.find((l) => l.re.test(texto)) ?? GERAL.find((l) => l.re.test(texto));
}

const short = (n: string) => n.split('.')[0];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const quando = (data: string) => {
  const n = diasAte(data);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `há ${-n} dias`;
  return `em ${n} dias`;
};
const dataCurta = (s: string) => s.split(' · ')[0];
const R = (p: Partial<AIResult> & { text: string }): AIResult => ({ kind: 'resposta', confidence: 'alta', generated: true, ...p });

const AREA_KEYS: [RegExp, string][] = [
  [/trabalhist/, 'Direito Trabalhista'],
  [/penal|criminal/, 'Direito Penal'],
  [/empresari|societari/, 'Direito Empresarial'],
  [/civel|civil/, 'Direito Civil'],
  [/previdenci|inss|aposentad/, 'Direito Previdenciário'],
  [/familia|alimentos|divorci/, 'Direito de Família'],
  [/tributari|fiscal/, 'Direito Tributário'],
  [/consumidor/, 'Direito do Consumidor'],
  [/imobiliari/, 'Direito Imobiliário'],
  [/administrativ/, 'Direito Administrativo'],
  [/constituciona/, 'Direito Constitucional'],
  [/ambienta/, 'Direito Ambiental'],
  [/digital|lgpd/, 'Direito Digital'],
];
const STOP = new Set(['quais', 'qual', 'processos', 'processo', 'cliente', 'clientes', 'possuem', 'prazo', 'prazos', 'esta', 'essa', 'semana', 'mostre', 'para', 'com', 'que', 'dos', 'das', 'do', 'da', 'de', 'meus', 'minhas', 'equipe', 'sem', 'atualizacao', 'documentos', 'foram', 'adicionados', 'recentemente', 'tem', 'hoje', 'estao', 'todos', 'mostrar', 'liste', 'listar', 'trabalhistas', 'onde', 'como']);

export function useAI() {
  const store = useStore();
  const navigate = useNavigate();
  const { processos, clientes, documentos, tarefas, compromissos, user } = store;

  const srcMov = (numero: string, m: { id: string; data: string; tipo: string }): Source => ({ kind: 'movimentacao', label: `Movimentação de ${m.data} · ${m.tipo}`, to: procLink(numero, 'Timeline', m.id) });
  const srcDoc = (numero: string, d: Documento): Source => ({ kind: 'documento', label: `Documento ${d.nome}`, to: procLink(numero, 'Documentos', d.id) });
  const srcPrazo = (numero: string, pr: { id: string; data: string; descricao: string }): Source => ({ kind: 'prazo', label: `Prazo de ${pr.data} · ${pr.descricao}`, to: procLink(numero, 'Prazos', pr.id) });
  const srcProc = (p: Processo): Source => ({ kind: 'processo', label: `Processo ${short(p.numero)} · ${p.cliente}`, to: procLink(p.numero) });

  /* ------------------------------------------------------ Process insight */

  const srcAud = (numero: string, a: { id: string; data: string; tipo: string }): Source => ({ kind: 'audiencia', label: `Audiência de ${dataCurta(a.data)} · ${a.tipo}`, to: procLink(numero, 'Audiências', a.id) });
  const uniq = (xs: Source[]) => xs.filter((s, i, arr) => arr.findIndex((x) => x.to === s.to) === i);
  const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const ATO = /decis|senten|despacho|intima/i;
  const artigo = (tipo: string) => (/^(despacho|embargo|recurso|agravo)/i.test(tipo) ? 'um' : 'uma');

  type Insight = { text: string; sources: Source[] };
  const palavras = (s: string) => new Set(norm(s).split(/[^a-z]+/).filter((w) => w.length > 4));
  const tarefasDe = (numero: string) => tarefas.filter((t) => t.numero === numero);

  /**
   * Insight (on demand only): what the records may mean for the case. Interpretations,
   * attention points and possible providências, each grounded in cited records.
   * Pure cross-references between records belong to analyzeProcess, not here.
   */
  function insightItems(p: Processo): Insight[] {
    const out: Insight[] = [];
    const pend = p.prazos.filter((x) => x.status !== 'concluido').sort((a, b) => toStamp(a.data) - toStamp(b.data));
    const ato = p.movimentacoes.slice(0, 3).find((m) => ATO.test(m.tipo) || /senten|embargo|contesta|tutela|liminar|recurso|apela|agravo|per[ií]cia|laudo|acordo/i.test(m.tipo));
    const leit = ato ? leituraJuridica(p.area, ato.tipo) : undefined;
    if (ato && leit) {
      const doc = p.documentos.find((d) => d.data === ato.data) ?? p.documentos.find((d) => new RegExp(leit.nome.slice(0, 5), 'i').test(d.tipo));
      out.push({ text: `${leit.nome.charAt(0).toUpperCase() + leit.nome.slice(1)} de ${ato.data}: ${leit.nota}`, sources: [srcMov(p.numero, ato), ...(doc ? [srcDoc(p.numero, doc)] : [])] });
    }
    const vencido = pend.find((x) => diasAte(x.data) < 0);
    if (vencido)
      out.push({ text: `O prazo "${vencido.descricao}" consta como vencido desde ${vencido.data}. Se a providência não foi cumprida, pode haver prejuízo processual; se foi, o registro está desatualizado.`, sources: [srcPrazo(p.numero, vencido)] });
    const aud = p.audiencias.filter((a) => diasAte(a.data) >= 0 && diasAte(a.data) <= 15).sort((a, b) => toStamp(a.data) - toStamp(b.data))[0];
    const leitAud = aud ? leituraJuridica(p.area, 'audiência') : undefined;
    if (aud && leitAud) out.push({ text: `A ${aud.tipo.toLowerCase()} ocorre ${quando(aud.data)}. ${leitAud.nota}`, sources: [srcAud(p.numero, aud)] });
    const ms = p.movimentacoes;
    if (!p.arquivado && ms[0] && diasAte(ms[0].data) < -30)
      out.push({ text: `Não há movimentação registrada desde ${ms[0].data}. Pode haver andamento no tribunal ainda não cadastrado.`, sources: [srcMov(p.numero, ms[0])] });
    return out;
  }

  function insightProcess(p: Processo): AIResult {
    const xs = insightItems(p);
    if (!xs.length) return R({ kind: 'sem-resultado', text: NAO_LOC, sources: [srcProc(p)] });
    return R({
      title: 'Insight do processo',
      text: '',
      sections: [{ title: 'Insight da IA', lines: xs.map((x) => x.text), tone: 'insight' }],
      sources: uniq(xs.flatMap((x) => x.sources)),
      confidence: 'parcial',
    });
  }

  const STATUS_TXT: Record<string, string> = {
    'em-andamento': 'em andamento',
    aguardando: 'aguardando uma providência',
    atrasado: 'com pendência em atraso',
    encerrado: 'encerrado',
  };

  /** Resumo: what happened, facts only. No interpretation (see insightProcess) and nothing already in the header. */
  function summarizeProcess(p: Processo): AIResult {
    const ms = p.movimentacoes.slice(0, 4).reverse();
    if (!ms.length) return R({ kind: 'sem-resultado', text: NAO_LOC, sources: [srcProc(p)] });
    const docs = p.documentos.filter((d) => ms.some((m) => m.data === d.data));
    const pend = p.prazos.filter((x) => x.status !== 'concluido').length;
    const aud = p.audiencias.filter((a) => diasAte(a.data) >= 0).length;
    const tk = tarefasDe(p.numero).filter((t) => t.status !== 'concluido').length;
    const aberto = [pend && plural(pend, 'prazo em aberto', 'prazos em aberto'), aud && plural(aud, 'audiência futura', 'audiências futuras'), tk && plural(tk, 'tarefa pendente', 'tarefas pendentes')].filter(Boolean);
    const antigas = p.movimentacoes.slice(4);
    return R({
      title: 'Resumo do processo',
      text: ms.map((m) => `Em ${m.data}, ${m.tipo.toLowerCase()}: ${lower1(m.descricao).replace(/\.?$/, '.')}`).join(' '),
      lines: [...(docs.length ? [`Documentos juntados no período: ${docs.map((d) => d.nome).join(', ')}.`] : []), ...(aberto.length ? [`Em aberto: ${aberto.join(', ')}.`] : [])],
      more: antigas.length ? [{ title: 'Movimentações anteriores', lines: antigas.map((m) => `${m.data} · ${m.tipo}: ${m.descricao}`) }] : undefined,
      sources: uniq([...ms.slice().reverse().map((m) => srcMov(p.numero, m)), ...docs.map((d) => srcDoc(p.numero, d))]).slice(0, 6),
      actions: [{ label: 'Ver timeline', to: procLink(p.numero, 'Timeline') }],
    });
  }

  /** Análise: relates documents, movimentações, prazos, audiências and tarefas (cross-references with sources). */
  function analyzeProcess(p: Processo): AIResult {
    const out: Insight[] = [];
    const pend = p.prazos.filter((x) => x.status !== 'concluido').sort((a, b) => toStamp(a.data) - toStamp(b.data));
    const tks = tarefasDe(p.numero);
    const abertas = tks.filter((t) => t.status !== 'concluido');
    // Ato processual x prazo
    p.movimentacoes.slice(0, 5).filter((m) => ATO.test(m.tipo)).slice(0, 2).forEach((m) => {
      const pr = pend.find((x) => toStamp(x.data) >= toStamp(m.data) && toStamp(x.data) - toStamp(m.data) <= 45 * 864e5);
      if (pr) out.push({ text: `A ${m.tipo.toLowerCase()} de ${m.data} antecede o prazo "${pr.descricao}" (${pr.data}); o prazo possivelmente decorre dela.`, sources: [srcMov(p.numero, m), srcPrazo(p.numero, pr)] });
      else out.push({ text: `A ${m.tipo.toLowerCase()} de ${m.data} não tem prazo em aberto cadastrado depois dela.`, sources: [srcMov(p.numero, m)] });
    });
    // Documento sem movimentação
    p.documentos.filter((d) => !p.movimentacoes.some((m) => m.data === d.data)).slice(0, 2).forEach((d) =>
      out.push({ text: `O documento ${d.nome} (${d.data}) não tem movimentação registrada na mesma data.`, sources: [srcDoc(p.numero, d)] }),
    );
    // Prazo sem tarefa
    pend.forEach((pr) => {
      const w = palavras(pr.descricao);
      const tk = abertas.find((t) => [...palavras(t.titulo)].some((x) => w.has(x)));
      if (!tk) out.push({ text: `O prazo "${pr.descricao}" (${pr.data}) não tem tarefa relacionada registrada.`, sources: [srcPrazo(p.numero, pr)] });
    });
    // Audiência sem preparação
    p.audiencias.filter((a) => diasAte(a.data) >= 0).forEach((a) => {
      const prep = tks.some((t) => /audi[eê]ncia|prepar|testemunh|sustenta/i.test(t.titulo));
      if (!prep) out.push({ text: `A ${a.tipo.toLowerCase()} de ${dataCurta(a.data)} não tem tarefa de preparação registrada.`, sources: [srcAud(p.numero, a)] });
    });
    // Petição x decisão
    const pet = p.documentos.find((d) => /peti/i.test(d.tipo) && d.conteudo && /DOS PEDIDOS/.test(d.conteudo));
    const dec = pet && p.documentos.find((d) => d.id !== pet.id && /decis|senten|despacho/i.test(d.tipo) && d.conteudo && toStamp(d.data) >= toStamp(pet.data));
    if (pet) {
      const pedidos = pet.conteudo!.match(/DOS PEDIDOS\s*\n([\s\S]*?)(?=\n\s*\n|$)/)?.[1] ?? '';
      const temas: [RegExp, string][] = [[/tutela|liminar/i, 'tutela de urgência'], [/restitui|devolu/i, 'restituição de valores'], [/multa/i, 'multa'], [/dano moral|danos morais/i, 'dano moral'], [/rescis/i, 'rescisão']];
      const pedidosT = temas.filter(([re]) => re.test(pedidos));
      if (dec && pedidosT.length) {
        const trat = pedidosT.filter(([re]) => re.test(dec.conteudo!)).map(([, n]) => n);
        const nao = pedidosT.filter(([re]) => !re.test(dec.conteudo!)).map(([, n]) => n);
        out.push({ text: `A petição ${pet.nome} pede ${pedidosT.map(([, n]) => n).join(', ')}. A decisão ${dec.nome} ${trat.length ? `trata de ${trat.join(', ')}` : 'não menciona esses pedidos'}${trat.length && nao.length ? ` e não menciona ${nao.join(', ')}` : ''}.`, sources: [srcDoc(p.numero, pet), srcDoc(p.numero, dec)] });
      } else if (!dec && pedidosT.length) out.push({ text: `A petição ${pet.nome} pede ${pedidosT.map(([, n]) => n).join(', ')}, mas não há decisão com texto extraído posterior a ela.`, sources: [srcDoc(p.numero, pet)] });
    }
    if (!out.length) return R({ kind: 'sem-resultado', text: NAO_LOC, sources: [srcProc(p)] });
    return R({
      title: 'Análise do caso',
      text: 'Relações inferidas por datas e conteúdo dos registros. Confirme nas fontes.',
      sections: [{ title: 'Relações entre os registros', lines: out.map((x) => x.text) }],
      sources: uniq(out.flatMap((x) => x.sources)),
      confidence: 'parcial',
    });
  }

  /* ----------------------------------------------------------- Documents */

  const cortar = (s: string, n = 170) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);

  /** Compact document summary: resumo, pontos, insight, fonte. Remaining details behind "Ver mais". */
  /** Petições estruturadas (DOS FATOS / DO DIREITO / DOS PEDIDOS): leitura guiada pelas seções do próprio texto. */
  function summarizePeticao(p: Processo, d: Documento, txt: string): AIResult {
    const secao = (nome: string) => txt.match(new RegExp(`${nome}\\s*\\n([\\s\\S]*?)(?=\\n\\s*\\n|$)`))?.[1]?.trim() ?? '';
    const fatos = secao('DOS FATOS');
    const direito = secao('DO DIREITO');
    const pedidosTxt = secao('DOS PEDIDOS');
    const provas = secao('DAS PROVAS');
    const frasesF = fatos.split(/(?<=\.)\s+/).filter(Boolean);
    const acao = txt.match(/vem propor ([A-ZÇÃÕÉÊÍÓÚ ]+?) em face/)?.[1]?.toLowerCase();
    const reu = p.partes.find((x) => /r[ée]u/i.test(x.papel) && txt.includes(x.nome.toUpperCase()))?.nome ?? p.partes.find((x) => /r[ée]u/i.test(x.papel))?.nome;
    const pedidos = pedidosTxt.replace(/^.*?requer:\s*/s, '').split(/;\s*/).map((x) => x.replace(/\.$/, '').trim()).filter(Boolean);
    const valorCausa = txt.match(/valor de (R\$ ?[\d.,]+\d)/)?.[1];
    const pago = fatos.match(/total de (R\$ ?[\d.,]+\d)/)?.[1];
    const prazoContrato = fatos.match(/em até (\d+ dias)/)?.[1];
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

    const resumo = [
      `${p.cliente} ajuizou ${acao ?? 'ação'} contra ${reu ?? 'a parte ré'}`.replace(/\.?$/, '.'),
      pago && prazoContrato ? `Alega que pagou ${pago} por serviços contratados que não foram entregues no prazo de ${prazoContrato}.` : frasesF[0],
      pedidos[0] ? `Pede, entre outros pontos, ${pedidos[0].replace(/^a /, 'a ')}${pedidos.length > 2 ? ' e a restituição dos valores com multa contratual' : ''}.` : '',
    ].filter(Boolean).join(' ');

    const pontos: string[] = [];
    const fContrato = frasesF.find((f) => /contrato/i.test(f));
    if (fContrato) pontos.push(cortar(fContrato, 150));
    const fPag = frasesF.find((f) => /pag/i.test(f) && /R\$/.test(f));
    const ultPag = fatos.match(/último pagamento ocorreu em (\d{2}\/\d{2}\/\d{4})/i)?.[1];
    if (fPag) pontos.push(`${cortar(fPag, 120)}${ultPag ? ` Último pagamento em ${ultPag}.` : ''}`);
    const fNotif = frasesF.find((f) => /notifica/i.test(f));
    if (fNotif) pontos.push(cortar(fNotif, 150));
    const fund = [...new Set(direito.match(/arts?\. \d+(?: e \d+)? do [A-Za-zÀ-ú ]+?(?=[,.])/g) ?? [])];
    if (fund.length) pontos.push(`Fundamentos: ${fund.join('; ')}.`);
    if (valorCausa) pontos.push(`Valor da causa: ${valorCausa}.`);

    // Insight: confronta o que a petição afirma com o que existe nos registros do processo.
    const outros = p.documentos.filter((x) => x.id !== d.id);
    const temDoc = (re: RegExp) => outros.find((x) => re.test(norm(`${x.nome} ${x.conteudo ?? ''}`)));
    const notifAusente = /notifica/i.test(fatos) && !temDoc(/notifica/);
    const riscoFragil = /informa[cç][aã]o de|tomou conhecimento/i.test(fatos) && /urg[eê]ncia/i.test(txt);
    const contrato = temDoc(/contrato/);
    const comprov = temDoc(/comprovante/);
    const partes: string[] = [];
    if (riscoFragil) partes.push('O pedido de tutela de urgência se apoia no risco de encerramento das atividades da ré, mas a petição descreve esse fato apenas com base em informação de fornecedores.');
    if (notifAusente) partes.push('A notificação extrajudicial citada como marco da mora também não aparece entre os documentos do processo.');
    if (partes.length) partes.push('Vale reunir prova desses dois pontos antes da próxima manifestação, porque a probabilidade do direito está documentada pelo contrato e pelos comprovantes, mas o perigo de dano ainda depende de demonstração.');
    else partes.push('Os fatos centrais da petição estão amparados por documentos juntados ao processo. Vale confirmar se os pedidos foram todos apreciados nas decisões posteriores.');
    const insightSrc = [contrato, comprov].filter(Boolean).map((x) => srcDoc(p.numero, x!));
    const movPet = p.movimentacoes.find((m) => /peti/i.test(m.tipo) && m.data === d.data);

    return R({
      title: `Resumo de ${d.nome}`,
      text: '',
      sections: [
        { title: 'Resumo', body: resumo },
        { title: 'Pontos importantes', lines: pontos.slice(0, 5) },
        { title: 'Insight da IA', body: partes.join(' '), tone: 'insight' },
      ],
      more: [
        { title: 'Pedidos', lines: pedidos.length ? pedidos.map(cap) : [NAO_LOC] },
        { title: 'Partes', lines: [`Autor: ${p.cliente}`, `Réu: ${reu ?? NAO_LOC}`] },
        { title: 'Provas indicadas', lines: provas ? [cortar(provas, 220)] : [NAO_LOC] },
      ],
      sources: uniq([srcDoc(p.numero, d), ...insightSrc, ...(movPet ? [srcMov(p.numero, movPet)] : [])]),
      actions: [
        { label: 'Ver documento', to: procLink(p.numero, 'Documentos', d.id) },
        { label: 'Ver contexto no processo', to: movPet ? procLink(p.numero, 'Timeline', movPet.id) : procLink(p.numero) },
      ],
      confidence: 'alta',
    });
  }

  function summarizeDocument(docId: string, numero: string): AIResult {
    const p = processos.find((x) => x.numero === numero);
    const d = p?.documentos.find((x) => x.id === docId);
    if (!p || !d) return R({ kind: 'sem-resultado', text: NAO_LOC });
    if (!d.conteudo)
      return R({
        kind: 'contexto-insuficiente',
        confidence: 'baixa',
        text: `O documento "${d.nome}" não possui texto extraído, então o resumo não foi gerado. Abra o arquivo original para leitura.`,
        sources: [srcDoc(p.numero, d)],
        actions: [{ label: 'Ver documento', to: procLink(p.numero, 'Documentos', d.id) }],
      });
    const txt = d.conteudo;
    if (/peti/i.test(d.tipo) && /DOS FATOS/.test(txt)) return summarizePeticao(p, d, txt);
    const frases = txt.split(/(?<=\.)\s+/).filter(Boolean);
    const datas = [...new Set(txt.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [])];
    const nomes = [...new Set([...p.partes.map((x) => x.nome), p.cliente, p.responsavel, ...store.advogados.map((a) => a.nome)].filter((n) => txt.includes(n)))];
    const obrig = frases.filter((f) => /deverá|obrigad|intime|condenando|fica designad|multa|comprovar|determin|requer|pede|pedido/i.test(f));
    const valores = [...new Set(txt.match(/R\$ ?[\d.,]*\d/g) ?? [])];

    // Related records of the same process only.
    const words = (s: string) => new Set(norm(s).split(/[^a-z]+/).filter((w) => w.length > 5));
    const dw = words(txt);
    const overlap = (s: string) => [...words(s)].filter((w) => dw.has(w)).length;
    const movs = p.movimentacoes.filter((m) => m.data === d.data || datas.includes(m.data) || overlap(m.descricao) >= 2).slice(0, 2);
    const przs = p.prazos.filter((x) => datas.includes(x.data) || overlap(x.descricao) >= 1).slice(0, 2);
    const auds = p.audiencias.filter((a) => datas.includes(dataCurta(a.data)) || (/audi[eê]ncia/i.test(txt) && diasAte(a.data) >= 0)).slice(0, 1);
    const relLines = [
      ...movs.map((m) => `Movimentação de ${m.data}: ${m.tipo}.`),
      ...przs.map((x) => `Prazo de ${x.data}: ${x.descricao}.`),
      ...auds.map((a) => `Audiência de ${dataCurta(a.data)}: ${a.tipo}.`),
    ];
    const rel = [...movs.map((m) => srcMov(p.numero, m)), ...przs.map((x) => srcPrazo(p.numero, x)), ...auds.map((a) => srcAud(p.numero, a))];

    // Pontos importantes: 3 a 5, curtos.
    const pontos: string[] = [];
    (obrig.length ? obrig : frases.slice(1, 3)).slice(0, 2).forEach((f) => pontos.push(cortar(f)));
    const proxData = datas.find((dt) => diasAte(dt) >= 0);
    if (proxData) pontos.push(`O documento menciona a data ${proxData} (${quando(proxData)}).`);
    if (valores.length) pontos.push(`Valores citados: ${valores.slice(0, 3).join(', ')}.`);
    if (pontos.length < 3) pontos.push(`${d.tipo} anexado em ${d.data}.`);
    if (pontos.length < 3 && nomes.length) pontos.push(`Menciona ${nomes.slice(0, 2).join(' e ')}.`);

    // Insight contextual para o trabalho do profissional.
    const decisorio = /decis|senten|despacho/i.test(d.tipo) || /decido|julgo|defiro|indefiro|determino/i.test(txt);
    const peticaoAnterior = p.documentos.find((x) => x.id !== d.id && /peti/i.test(x.tipo) && toStamp(x.data) <= toStamp(d.data));
    const mencionaPrazo = /prazo|\bdias\b/i.test(txt);
    const prazoAberto = p.prazos.some((x) => x.status !== 'concluido');
    const leit = leituraJuridica(p.area, `${d.tipo} ${txt.slice(0, 300)}`);
    let insight: string;
    const insightSrc: Source[] = [];
    if (decisorio && peticaoAnterior && /pedido|requer|pleito/i.test(txt)) {
      insight = 'A decisão aborda diretamente o pedido apresentado na petição anterior. Vale comparar os dois documentos.';
      insightSrc.push(srcDoc(p.numero, peticaoAnterior));
    } else if (decisorio && leit && /senten/i.test(leit.nome)) insight = `Este documento registra uma sentença. ${leit.nota}`;
    else if (decisorio) insight = 'Este documento registra uma decisão que pode exigir uma nova manifestação. Vale revisar o prazo relacionado antes de definir a próxima providência.';
    else if (mencionaPrazo && !prazoAberto) insight = 'O documento menciona uma determinação com prazo, mas não há prazo em aberto cadastrado. Confira se essa providência já foi registrada no processo.';
    else if (mencionaPrazo) insight = 'O documento menciona uma determinação com prazo. Confira se essa providência já foi registrada no processo.';
    else if (leit) insight = leit.nota;
    else if (!movs.length) insight = 'O documento ainda não aparece ligado a uma movimentação. Vale confirmar em que momento do processo ele foi juntado.';
    else insight = NAO_LOC;

    const ctxTo = movs[0] ? procLink(p.numero, 'Timeline', movs[0].id) : procLink(p.numero);

    return R({
      title: `Resumo de ${d.nome}`,
      text: '',
      sections: [
        { title: 'Resumo', body: frases.slice(0, Math.min(3, frases.length)).map((f) => cortar(f, 220)).join(' ') },
        { title: 'Pontos importantes', lines: pontos.slice(0, 5) },
        { title: 'Insight da IA', body: insight, tone: 'insight' },
      ],
      more: [
        { title: 'Datas', lines: datas.length ? datas.map((dt) => `${dt} (${quando(dt)})`) : [NAO_LOC] },
        { title: 'Partes e pessoas mencionadas', lines: nomes.length ? nomes : [NAO_LOC] },
        { title: 'Determinações e pedidos', lines: obrig.length ? obrig : [NAO_LOC] },
        { title: 'Relações com o processo', lines: relLines.length ? relLines : ['Não foi possível confirmar essa informação nos registros disponíveis.'] },
      ],
      sources: uniq([srcDoc(p.numero, d), ...insightSrc, ...rel]),
      actions: [
        { label: 'Ver documento', to: procLink(p.numero, 'Documentos', d.id) },
        { label: 'Ver contexto no processo', to: ctxTo },
      ],
      confidence: frases.length > 2 ? 'alta' : 'parcial',
    });
  }

  /** "O que é importante neste documento para este processo?" */
  function documentRelevance(docId: string, numero: string): AIResult {
    const r = summarizeDocument(docId, numero);
    if (r.kind !== 'resposta') return r;
    const rel = r.more?.find((s) => s.title === 'Relações com o processo');
    return { ...r, title: 'Importância para o processo', sections: [r.sections![2], ...(rel ? [{ title: 'Relações com o processo', lines: rel.lines }] : []), r.sections![1], r.sections![3]] };
  }

  /* ------------------------------------------------------ Similar cases */

  function similarCases(numero?: string): AIResult {
    const ativos = processos.filter((p) => !p.arquivado);
    const tipos = (p: Processo) => new Set(p.movimentacoes.slice(0, 3).map((m) => norm(m.tipo)));
    const score = (a: Processo, b: Processo) => {
      if (a.area !== b.area) return 0;
      const ta = tipos(a);
      const comuns = [...tipos(b)].filter((t) => ta.has(t)).length;
      return 1 + (a.status === b.status ? 1 : 0) + comuns;
    };
    const motivo = (a: Processo, b: Processo) => {
      const ta = tipos(a);
      const comuns = b.movimentacoes.slice(0, 3).filter((m) => ta.has(norm(m.tipo))).map((m) => m.tipo.toLowerCase());
      return [`mesma área (${areaCurta(b.area)})`, ...(a.status === b.status ? [`mesma situação (${STATUS_TXT[b.status] ?? b.status})`] : []), ...(comuns.length ? [`movimentações do tipo ${[...new Set(comuns)].join(', ')}`] : [])].join(', ');
    };
    const ref = numero ? processos.find((p) => p.numero === numero) : undefined;
    if (ref) {
      const xs = processos.filter((p) => p.numero !== ref.numero).map((p) => ({ p, s: score(ref, p) })).filter((x) => x.s >= 2 || (x.s === 1 && ref.area === x.p.area)).sort((a, b) => b.s - a.s).slice(0, 4);
      if (!xs.length) return R({ kind: 'sem-resultado', text: `Não localizado nos registros: não há outro processo de ${areaCurta(ref.area)} com situação semelhante.`, sources: [srcProc(ref)] });
      return R({
        title: 'Processos semelhantes',
        text: `A semelhança considera área, situação e tipos de movimentação registrados. Vale conferir cada caso antes de reaproveitar qualquer estratégia.`,
        lines: xs.map(({ p }) => `${short(p.numero)} · ${p.cliente}: ${motivo(ref, p)}.`),
        sources: [srcProc(ref), ...xs.map(({ p }) => srcProc(p))],
        confidence: 'parcial',
      });
    }
    const grupos = new Map<string, Processo[]>();
    ativos.forEach((p) => grupos.set(p.area, [...(grupos.get(p.area) ?? []), p]));
    const pares: { a: Processo; b: Processo; s: number }[] = [];
    ativos.forEach((a, i) => ativos.slice(i + 1).forEach((b) => { const s = score(a, b); if (s >= 2) pares.push({ a, b, s }); }));
    pares.sort((x, y) => y.s - x.s);
    if (!pares.length) {
      const multi = [...grupos.entries()].filter(([, ps]) => ps.length > 1);
      if (!multi.length) return R({ kind: 'sem-resultado', text: 'Não localizado nos registros: nenhum par de processos ativos compartilha área e situação.' });
      return R({ title: 'Processos semelhantes', text: 'Estes processos compartilham a mesma área, mas diferem na situação e nas movimentações.', lines: multi.map(([a, ps]) => `${areaCurta(a)}: ${ps.map((p) => short(p.numero)).join(', ')}.`), sources: multi.flatMap(([, ps]) => ps.map(srcProc)).slice(0, 6), confidence: 'parcial' });
    }
    return R({
      title: 'Processos semelhantes',
      text: 'A semelhança considera área, situação e tipos de movimentação registrados. Vale conferir cada caso nas fontes.',
      lines: pares.slice(0, 4).map(({ a, b }) => `${short(a.numero)} e ${short(b.numero)}: ${motivo(a, b)}.`),
      sources: uniq(pares.slice(0, 4).flatMap(({ a, b }) => [srcProc(a), srcProc(b)])),
      confidence: 'parcial',
    });
  }

  /* -------------------------------------------------------------- Agenda */

  function agendaHoje(): AIResult {
    const itens: { data: string; dia: number; linha: string; src: Source }[] = [];
    processos.filter((p) => !p.arquivado).forEach((p) => {
      p.prazos.filter((x) => x.status !== 'concluido').forEach((x) => {
        const n = diasAte(x.data);
        if (n <= 2) itens.push({ data: x.data, dia: n, linha: `Prazo: ${x.descricao} · ${p.cliente} (${short(p.numero)})`, src: srcPrazo(p.numero, x) });
      });
      p.audiencias.forEach((a) => {
        const n = diasAte(a.data);
        if (n >= 0 && n <= 7) itens.push({ data: a.data, dia: n, linha: `Audiência: ${a.tipo} · ${p.cliente}, ${a.modalidade.toLowerCase()} (${a.data.split(' · ')[1] ?? 'horário a confirmar'})`, src: { kind: 'audiencia', label: `Audiência de ${dataCurta(a.data)} · ${p.cliente}`, to: procLink(p.numero, 'Audiências', a.id) } });
      });
    });
    tarefas.filter((t) => t.status !== 'concluido' && (store.role === 'Administrador' || t.responsavel === user.nome)).forEach((t) => {
      const n = diasAte(t.data);
      if (n <= 1) itens.push({ data: t.data, dia: n, linha: `Tarefa: ${t.titulo} · ${t.responsavel}`, src: { kind: 'tarefa', label: `Tarefa · ${t.titulo}`, to: '/tarefas' } });
    });
    compromissos.filter((c) => c.status !== 'cancelada').forEach((c) => {
      const n = diasAte(c.data);
      if (n >= 0 && n <= 2) itens.push({ data: c.data, dia: n, linha: `Compromisso: ${c.titulo} · ${c.local}`, src: { kind: 'agenda', label: `Compromisso de ${dataCurta(c.data)}`, to: '/agenda' } });
    });
    if (!itens.length) return R({ kind: 'sem-resultado', text: 'Consultei prazos, audiências, tarefas e compromissos autorizados: não há nada previsto para hoje nem nos próximos dias.' });
    const grupos: [string, (n: number) => boolean][] = [
      ['Atrasados', (n) => n < 0],
      ['Hoje', (n) => n === 0],
      ['Amanhã', (n) => n === 1],
      ['Próximos dias', (n) => n > 1],
    ];
    const hoje = itens.filter((i) => i.dia === 0).length;
    const atras = itens.filter((i) => i.dia < 0).length;
    return R({
      title: 'O que fazer hoje',
      text: `Você tem ${plural(hoje, 'item', 'itens')} para hoje${atras ? ` e ${plural(atras, 'pendência atrasada', 'pendências atrasadas')}` : ''}.`,
      sections: grupos
        .map(([title, f]) => ({ title, lines: itens.filter((i) => f(i.dia)).sort((a, b) => toStamp(a.data) - toStamp(b.data)).map((i) => `${i.linha}${i.dia > 1 ? ` · ${dataCurta(i.data)}` : ''}`) }))
        .filter((s) => s.lines.length),
      sources: itens.sort((a, b) => a.dia - b.dia).slice(0, 6).map((i) => i.src),
    });
  }

  /* -------------------------------------------------------------- Search */

  function globalSearch(query: string): AIResult {
    const q = norm(query);
    const terms = q.split(/[^a-z0-9./-]+/).filter((t) => t.length > 2 && !STOP.has(t));
    const hit = (hay: string) => terms.some((t) => norm(hay).includes(t));

    // Área jurídica
    const area = AREA_KEYS.find(([re]) => re.test(q))?.[1];
    // Clientes citados
    const cliHits = clientes.filter((c) => terms.some((t) => norm(c.nome).split(/\s+/).includes(t)));
    const wantsPrazo = /prazo|vence|vencimento/.test(q);
    const wantsSemana = /semana/.test(q);
    const wantsSemAtual = /sem atualiza|parad|desatualiz|sem andamento/.test(q);
    const wantsDocs = /documento|arquivo|anex/.test(q) && /recent|novo|adicionad|ultimo/.test(q);

    if (cliHits.length > 1)
      return R({
        kind: 'ambiguidade',
        confidence: 'baixa',
        text: 'Encontrei informações relacionadas a mais de um processo. Selecione o contexto que deseja consultar.',
        choices: cliHits.map((c) => ({ label: c.nome, hint: `${processos.filter((p) => p.clienteId === c.id).length} processo(s) · ${c.documento}`, query: query.replace(new RegExp(terms.find((t) => norm(c.nome).includes(t)) ?? '', 'i'), c.nome) })),
      });

    if (wantsSemAtual) {
      const xs = processos.filter((p) => !p.arquivado && diasAte(p.atualizacao) < -30);
      if (!xs.length) return R({ kind: 'sem-resultado', text: 'Nenhum processo ativo está há mais de 30 dias sem atualização.' });
      return R({ text: `${plural(xs.length, 'processo ativo está', 'processos ativos estão')} há mais de 30 dias sem atualização:`, lines: xs.map((p) => `${short(p.numero)} · ${p.cliente}, última atualização em ${p.atualizacao} (${-diasAte(p.atualizacao)} dias)`), sources: xs.map(srcProc) });
    }

    if (wantsDocs) {
      const xs = documentos.filter((d) => diasAte(d.data) >= -14);
      if (!xs.length) return R({ kind: 'sem-resultado', text: 'Nenhum documento foi adicionado nos últimos 14 dias.' });
      return R({ text: `${plural(xs.length, 'documento foi adicionado', 'documentos foram adicionados')} nos últimos 14 dias:`, lines: xs.map((d) => `${d.nome} (${d.tipo}) · ${d.cliente}, ${d.data}`), sources: xs.slice(0, 6).map((d) => srcDoc(d.numero, d)) });
    }

    let base = processos;
    if (cliHits.length === 1) base = base.filter((p) => p.clienteId === cliHits[0].id);
    if (area) base = base.filter((p) => p.area === area);

    if (wantsPrazo) {
      const lim = wantsSemana ? 7 : 30;
      const rows = base.flatMap((p) => p.prazos.filter((x) => x.status !== 'concluido' && diasAte(x.data) <= lim).map((x) => ({ p, x })));
      const ctx = [cliHits[0]?.nome, area && areaCurta(area)].filter(Boolean).join(', ');
      if (!rows.length) return R({ kind: 'sem-resultado', text: `Não há prazos em aberto ${wantsSemana ? 'nesta semana' : 'nos próximos 30 dias'}${ctx ? ` para ${ctx}` : ''}.` });
      return R({
        text: `${plural(new Set(rows.map((r) => r.p.numero)).size, 'processo', 'processos')}${ctx ? ` de ${ctx}` : ''} com prazo ${wantsSemana ? 'nesta semana' : 'próximo'}:`,
        lines: rows.map(({ p, x }) => `${short(p.numero)} · ${x.descricao}, ${x.data} (${diasAte(x.data) < 0 ? 'vencido' : quando(x.data)})`),
        sources: rows.map(({ p, x }) => srcPrazo(p.numero, x)),
      });
    }

    if (area || cliHits.length === 1) {
      if (!base.length) return R({ kind: 'sem-resultado', text: `Nenhum processo${area ? ` de ${areaCurta(area)}` : ''}${cliHits[0] ? ` do cliente ${cliHits[0].nome}` : ''} nos registros que você pode acessar.` });
      return R({
        text: `${plural(base.length, 'processo', 'processos')}${area ? ` de ${areaCurta(area)}` : ''}${cliHits[0] ? ` de ${cliHits[0].nome}` : ''}${/equipe/.test(q) ? ' na equipe' : ''}:`,
        lines: base.map((p) => `${short(p.numero)} · ${p.cliente} · ${p.responsavel} · ${p.status.replace('-', ' ')}`),
        sources: base.map(srcProc),
      });
    }

    if (!terms.length)
      return R({ kind: 'contexto-insuficiente', confidence: 'baixa', text: 'Preciso de um pouco mais de contexto. Informe um cliente, número de processo, área jurídica ou tipo de documento.' });

    const procs = processos.filter((p) => hit(p.numero) || hit(p.cliente) || hit(p.responsavel) || hit(p.tribunal) || hit(p.resumo) || p.partes.some((x) => hit(x.nome)));
    const docs = documentos.filter((d) => hit(d.nome) || hit(d.tipo) || (d.conteudo ? hit(d.conteudo) : false));
    const total = procs.length + docs.length;
    if (!total) return R({ kind: 'sem-resultado', text: 'Não localizado nos registros.' });
    const fraco = terms.length > 1 && !terms.every((t) => [...procs.map((p) => p.cliente + p.resumo), ...docs.map((d) => d.nome + (d.conteudo ?? ''))].some((h) => norm(h).includes(t)));
    return R({
      kind: fraco ? 'baixa-confianca' : 'resposta',
      confidence: fraco ? 'baixa' : 'alta',
      text: fraco ? 'Não foi possível confirmar essa informação nos registros disponíveis.' : `Encontrei ${plural(total, 'registro')} para "${query}":`,
      lines: [
        ...procs.slice(0, 4).map((p) => `Processo ${short(p.numero)} · ${p.cliente} · ${areaCurta(p.area)}`),
        ...docs.slice(0, 4).map((d) => `Documento ${d.nome} · ${d.cliente}`),
      ],
      sources: [...procs.slice(0, 4).map(srcProc), ...docs.slice(0, 3).map((d) => srcDoc(d.numero, d))],
    });
  }

  /* ----------------------------------------------------------- Attention */

  /** Objective facts only: prazos, audiências and tarefas for today or overdue. No interpretation. */
  function attention(): AIResult {
    const prz = store.prioridades.filter((x) => x.status !== 'concluido' && diasAte(x.data) <= 0);
    const auds = store.eventos.filter((e) => e.kind === 'audiencia' && diasAte(e.data) === 0).sort((a, b) => toStamp(a.data) - toStamp(b.data));
    const tks = tarefas.filter((t) => t.status !== 'concluido' && diasAte(t.data) <= 0 && (store.role === 'Administrador' || t.responsavel === user.nome));
    if (!prz.length && !auds.length && !tks.length) return R({ kind: 'sem-resultado', text: 'Nenhum prazo, audiência ou tarefa para hoje ou em atraso nos seus registros.' });
    const partes = [
      prz.length && plural(prz.length, 'prazo', 'prazos') + ' para hoje ou em atraso',
      auds.length && plural(auds.length, 'audiência', 'audiências') + ' hoje',
      tks.length && plural(tks.length, 'tarefa', 'tarefas') + (tks.length > 1 ? ' para hoje ou atrasadas' : ' para hoje ou atrasada'),
    ].filter(Boolean) as string[];
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0];
    return R({
      title: 'O que precisa da sua atenção',
      text: `Há ${lista}. Vale começar por ${prz.length + auds.length + tks.length > 1 ? (prz.length ? 'eles' : 'elas') : prz.length ? 'ele' : 'ela'}.`,
      lines: [
        ...prz.map((x) => `${short(x.numero)} · ${x.descricao} (${diasAte(x.data) < 0 ? `vencido ${quando(x.data)}` : 'hoje'})`),
        ...auds.map((a) => `${short(a.numero)} · ${a.kind === 'audiencia' ? a.tipo : 'Audiência'} (hoje${a.data.split(' · ')[1] ? `, ${a.data.split(' · ')[1]}` : ''})`),
        ...tks.map((t) => `${t.numero ? `${short(t.numero)} · ` : ''}${t.titulo} (${diasAte(t.data) < 0 ? `atrasada ${quando(t.data)}` : 'hoje'})`),
      ],
      sources: uniq([
        ...prz.map((x) => srcPrazo(x.numero, x)),
        ...auds.map((a) => ({ kind: 'audiencia' as const, label: `Audiência de ${dataCurta(a.data)} · ${a.cliente}`, to: procLink(a.numero, 'Audiências', a.id) })),
      ]).slice(0, 6),
    });
  }

  /* ------------------------------------------------------ Context answer */

  function answer(context: { scope: string; numero?: string }, question: string): AIResult {
    if (!store.prefs.iaAtiva)
      return R({ kind: 'indisponivel', confidence: 'baixa', text: 'Não foi possível consultar o assistente neste momento.' });
    const q = norm(question);
    if (q.replace(/[^a-z0-9]/g, '').length < 3)
      return R({ kind: 'contexto-insuficiente', confidence: 'baixa', text: 'Não foi possível identificar a pergunta. Tente, por exemplo, "Resuma este caso."' });

    if (context.numero) {
      const p = processos.find((x) => x.numero === context.numero);
      if (!p) return R({ kind: 'sem-resultado', text: 'Não localizado nos registros.' });
      const pend = p.prazos.filter((x) => x.status !== 'concluido').sort((a, b) => toStamp(a.data) - toStamp(b.data));
      const NAO = 'Não localizado nos registros.';

      // Question mentions another process or client: never mix contexts.
      const outros = processos.filter((x) => x.numero !== p.numero && (q.includes(norm(short(x.numero))) || (norm(x.cliente) !== norm(p.cliente) && q.includes(norm(x.cliente)))));
      if (outros.length)
        return R({
          kind: 'ambiguidade',
          confidence: 'baixa',
          text: 'Encontrei informações relacionadas a mais de um processo. Selecione o contexto que deseja consultar.',
          choices: [p, ...outros].map((x) => ({ label: `Processo ${short(x.numero)}`, hint: x.cliente, query: question, numero: x.numero })),
          sources: [p, ...outros].map(srcProc),
        });

      const docRef = question.match(/#([\w-]+)/)?.[1];
      if (/semelhan|similar|parecid/.test(q)) return similarCases(p.numero);
      if (/document|peca|arquivo/.test(q) && /importa|relevan/.test(q) && /este|esse|neste|nesse|#/.test(q)) {
        if (docRef) return documentRelevance(docRef, p.numero);
        const comTexto = p.documentos.filter((d) => d.conteudo);
        if (!comTexto.length) return R({ kind: 'contexto-insuficiente', confidence: 'baixa', text: 'Nenhum documento deste processo possui texto extraído para análise.' });
        if (comTexto.length === 1) return documentRelevance(comTexto[0].id, p.numero);
        return R({ kind: 'ambiguidade', confidence: 'baixa', text: 'Selecione o documento que deseja analisar.', choices: comTexto.map((d) => ({ label: d.nome, hint: `${d.tipo} · ${d.data}`, query: `O que é importante no documento #${d.id} para este processo?` })) });
      }
      if (/resum/.test(q) && /document|peca|arquivo/.test(q)) {
        const docId = docRef;
        const comTexto = p.documentos.filter((d) => d.conteudo);
        if (docId) return summarizeDocument(docId, p.numero);
        if (!p.documentos.length) return R({ kind: 'contexto-insuficiente', confidence: 'baixa', text: 'Este processo ainda não possui documentos anexados para resumir.' });
        if (comTexto.length === 1) return summarizeDocument(comTexto[0].id, p.numero);
        return R({ kind: 'ambiguidade', confidence: 'baixa', text: 'Há mais de um documento neste processo. Selecione qual deseja resumir.', choices: p.documentos.map((d) => ({ label: d.nome, hint: `${d.tipo} · ${d.data}${d.conteudo ? '' : ' · sem texto extraído'}`, query: `Resumir documento #${d.id}` })) });
      }
      if (/insight/.test(q)) return insightProcess(p);
      if (/analis|analise/.test(q)) return analyzeProcess(p);
      if (/resum/.test(q)) return summarizeProcess(p);

      if (/relacion|conect|vincul/.test(q)) {
        const ult = p.movimentacoes[0];
        if (!ult) return R({ kind: 'sem-resultado', text: NAO });
        const prazo = pend.find((x) => toStamp(x.data) >= toStamp(ult.data));
        const doc = p.documentos.find((d) => d.data === ult.data) ?? (ATO.test(ult.tipo) ? p.documentos.find((d) => /decis|senten|despacho/i.test(d.tipo)) : undefined);
        const aud = p.audiencias.find((a) => diasAte(a.data) >= 0);
        const lines = [
          ...(prazo ? [`Prazo "${prazo.descricao}" (${prazo.data}), posterior à movimentação.`] : []),
          ...(doc ? [`Documento ${doc.nome} (${doc.data}).`] : []),
          ...(aud && /audi[eê]ncia/i.test(ult.descricao) ? [`Audiência de ${dataCurta(aud.data)}: ${aud.tipo}.`] : []),
        ];
        if (!lines.length) return R({ kind: 'baixa-confianca', confidence: 'baixa', text: 'Não foi possível confirmar essa informação nos registros disponíveis.', sources: [srcMov(p.numero, ult)] });
        return R({
          title: 'Registros possivelmente relacionados',
          text: `A última movimentação (${ult.tipo.toLowerCase()} de ${ult.data}) pode estar relacionada a estes registros. A relação é inferida por datas e conteúdo; vale confirmar.`,
          lines,
          confidence: 'parcial',
          sources: uniq([srcMov(p.numero, ult), ...(prazo ? [srcPrazo(p.numero, prazo)] : []), ...(doc ? [srcDoc(p.numero, doc)] : []), ...(aud && /audi[eê]ncia/i.test(ult.descricao) ? [srcAud(p.numero, aud)] : [])]),
        });
      }
      if (/proxim.*passo|passos|providenc/.test(q)) return insightProcess(p);
      if (/explic|ultima moviment|ultimo andament/.test(q) || (/ultim/.test(q) && /moviment|andament/.test(q))) {
        const m = p.movimentacoes[0];
        if (!m) return R({ kind: 'sem-resultado', text: NAO });
        const doc = p.documentos.find((d) => d.data === m.data);
        return R({
          title: 'Última movimentação',
          text: `${m.tipo} registrada em ${m.data} (${quando(m.data)}). ${m.descricao}`,
          sources: uniq([srcMov(p.numero, m), ...(doc ? [srcDoc(p.numero, doc)] : [])]),
        });
      }
      if (/decis|senten|despacho/.test(q)) {
        const m = p.movimentacoes.find((x) => /decis|senten|despacho/i.test(x.tipo));
        const d = p.documentos.find((x) => /decis/i.test(x.tipo));
        if (!m && !d) return R({ kind: 'sem-resultado', text: NAO });
        return R({
          title: 'Última decisão',
          text: m ? `${m.tipo} de ${m.data} (${quando(m.data)}). ${m.descricao}` : `O documento mais recente do tipo decisão é ${d!.nome}.`,
          sources: [...(m ? [srcMov(p.numero, m)] : []), ...(d ? [srcDoc(p.numero, d)] : [])],
        });
      }
      if (/prazo/.test(q)) {
        if (!pend.length) return R({ kind: 'sem-resultado', text: NAO });
        return R({
          title: 'Prazos relevantes',
          text: `Há ${plural(pend.length, 'prazo em aberto', 'prazos em aberto')} neste processo, do mais urgente ao mais distante.`,
          lines: pend.map((x) => `${x.descricao}: ${x.data} (${diasAte(x.data) < 0 ? `vencido ${quando(x.data)}` : quando(x.data)}), ${x.responsavel}, prioridade ${x.prioridade}.`),
          sources: pend.map((x) => srcPrazo(p.numero, x)),
          actions: [{ label: `Concluir "${pend[0].descricao}"`, run: () => store.dispatch({ type: 'setPrazoStatus', numero: p.numero, prazoId: pend[0].id, status: 'concluido' }) }],
        });
      }
      if (/pend[eê]nc|revis|importante|atencao/.test(q)) {
        const tk = tarefas.filter((t) => t.numero === p.numero && t.status !== 'concluido');
        if (!pend.length && !tk.length && !p.observacoes) return R({ kind: 'sem-resultado', text: NAO });
        return R({
          title: 'Pontos para revisar',
          text: '',
          lines: [...pend.slice(0, 3).map((x) => `Prazo: ${x.descricao} (${x.data}${diasAte(x.data) < 0 ? ', vencido' : ''}).`), ...tk.slice(0, 3).map((t) => `Tarefa: ${t.titulo} (${t.responsavel}, ${t.data}).`), ...(p.observacoes ? [`Anotação interna: ${p.observacoes}`] : [])],
          sources: pend.slice(0, 3).map((x) => srcPrazo(p.numero, x)),
        });
      }
      if (/recente|aconteceu|moviment|andament/.test(q)) {
        const ms = p.movimentacoes.slice(0, 3);
        if (!ms.length) return R({ kind: 'sem-resultado', text: NAO });
        return R({ text: `A última movimentação indica ${lower1(ms[0].descricao)}`, lines: ms.slice(1).map((m) => `${m.data} · ${m.tipo}: ${m.descricao}`), sources: ms.map((m) => srcMov(p.numero, m)) });
      }
      if (/documento|relevan/.test(q)) {
        const ordem = (t: string) => (/decis|senten/i.test(t) ? 0 : /prova/i.test(t) ? 1 : 2);
        const ds = [...p.documentos].sort((a, b) => ordem(a.tipo) - ordem(b.tipo) || toStamp(b.data) - toStamp(a.data));
        if (!ds.length) return R({ kind: 'sem-resultado', text: NAO });
        return R({ text: 'Documentos do processo, decisões e provas primeiro:', lines: ds.map((d) => `${d.nome} · ${d.tipo}, ${d.data}`), sources: ds.slice(0, 4).map((d) => srcDoc(p.numero, d)), confidence: 'parcial' });
      }
      return R({ kind: 'baixa-confianca', confidence: 'baixa', text: 'Não foi possível confirmar essa informação nos registros disponíveis.', sources: [srcProc(p)] });
    }

    if (/semelhan|similar|parecid/.test(q)) return similarCases();
    if (/resum|importa/.test(q) && /document/.test(q)) {
      const ds = documentos.filter((d) => d.conteudo).sort((a, b) => toStamp(b.data) - toStamp(a.data)).slice(0, 5);
      if (!ds.length) return R({ kind: 'contexto-insuficiente', confidence: 'baixa', text: 'Nenhum documento com texto extraído nos registros que você pode acessar.' });
      return R({ kind: 'ambiguidade', confidence: 'baixa', text: 'Selecione o documento. Os mais recentes com texto extraído aparecem primeiro.', choices: ds.map((d) => ({ label: d.nome, hint: `${d.tipo} · ${d.cliente} · ${d.data}`, query: /importa/.test(q) ? `O que é importante no documento #${d.id} para este processo?` : `Resumir documento #${d.id}`, numero: d.numero })) });
    }
    if (/hoje|fazer|agenda do dia/.test(q)) return agendaHoje();
    if (/aten[cç][aã]o|urgent|atrasad/.test(q)) return attention();
    if (/audi[eê]nc/.test(q)) {
      const auds = store.eventos.filter((e) => e.kind === 'audiencia' && diasAte(e.data) >= 0).sort((a, b) => toStamp(a.data) - toStamp(b.data));
      if (!auds.length) return R({ kind: 'sem-resultado', text: 'Não há audiências futuras nos seus registros.' });
      return R({ text: `${plural(auds.length, 'audiência agendada', 'audiências agendadas')}:`, lines: auds.map((a) => `${a.kind === 'audiencia' ? a.tipo : ''} · ${a.cliente}, ${a.data} (${a.kind === 'audiencia' ? a.modalidade : ''})`), sources: auds.map((a) => ({ kind: 'audiencia' as const, label: `Audiência de ${dataCurta(a.data)} · ${a.cliente}`, to: procLink(a.numero, 'Audiências', a.id) })) });
    }
    if (/aguardando/.test(q)) {
      const xs = processos.filter((p) => p.status === 'aguardando');
      if (!xs.length) return R({ kind: 'sem-resultado', text: 'Nenhum processo aguardando ação.' });
      return R({ text: 'Processos aguardando uma providência:', lines: xs.map((p) => `${short(p.numero)} · ${p.cliente}: ${p.observacoes || p.resumo}`), sources: xs.map(srcProc) });
    }
    if (/clientes? com mais|mais processos/.test(q)) {
      const xs = clientes.map((c) => ({ c, n: processos.filter((p) => p.clienteId === c.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 4);
      return R({ text: 'Clientes com mais processos nos seus registros:', lines: xs.map((x) => `${x.c.nome} · ${plural(x.n, 'processo')}`), sources: xs.map((x) => ({ kind: 'cliente' as const, label: `Cliente ${x.c.nome}`, to: `/clientes/${x.c.id}` })) });
    }
    return globalSearch(question);
  }

  return { globalSearch, summarizeDocument, summarizeProcess, insightProcess, analyzeProcess, documentRelevance, similarCases, agendaHoje, attention, answer, goto: navigate };
}

export { parseData, AREAS };
