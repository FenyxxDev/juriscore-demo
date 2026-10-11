import type { StatusTone } from './components/ui';

export type Perfil = 'Administrador' | 'Advogado' | 'Assistente';

export const PERFIS: Perfil[] = ['Administrador', 'Advogado', 'Assistente'];

/** Áreas jurídicas usadas em cadastro, processos, filtros e distribuição. */
export const AREAS = [
  'Direito Penal',
  'Direito Trabalhista',
  'Direito Empresarial',
  'Direito Civil',
  'Direito Previdenciário',
  'Direito de Família',
  'Direito Tributário',
  'Direito do Consumidor',
  'Direito Imobiliário',
  'Direito Administrativo',
  'Direito Constitucional',
  'Direito Ambiental',
  'Direito Digital',
  'Outras áreas',
] as const;

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/** Short label: "Direito Trabalhista" -> "Trabalhista". */
export const areaCurta = (a: string) => a.replace(/^Direito (d[oae]s? )?/, '');

/* ------------------------------------------------------------ datas */

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtData = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
/** Data relativa a hoje, no formato DD/MM/AAAA (mantém o ambiente de demonstração sempre atual). */
export const rel = (dias: number, hora?: string) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hora ? `${fmtData(d)} · ${hora}` : fmtData(d);
};
export function parseData(s: string): Date | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
export const hojeZero = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
/** Dias entre hoje e a data (negativo = passado). */
export const diasAte = (s: string) => {
  const d = parseData(s);
  return d ? Math.round((d.getTime() - hojeZero().getTime()) / 86400000) : 0;
};
export const toneOf = (s: string): PrazoTone => {
  const n = diasAte(s);
  return n < 0 ? 'atrasado' : n === 0 ? 'hoje' : 'futuro';
};

export type PrazoTone = 'atrasado' | 'hoje' | 'futuro';
export type Prioridade = 'alta' | 'média' | 'baixa';

export type Advogado = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  perfil: Perfil;
  ativo: boolean;
  /** Advogado */
  oab: string;
  oabUf?: string;
  especialidade?: string;
  anosExperiencia?: number;
  /** Advogado e Assistente: áreas acompanhadas */
  areas: string[];
  /** Assistente */
  equipe?: string;
  /** Administrador */
  cargo?: string;
  escritorio?: string;
  ultimaAtividade: string;
};

/** Alias semântico: toda conta do sistema é um membro da equipe. */
export type Usuario = Advogado;

export type Compromisso = {
  id: string;
  titulo: string;
  data: string;
  local: string;
  responsavel: string;
  numero?: string;
  observacoes?: string;
  status: StatusTone;
};

export type Tarefa = {
  id: string;
  titulo: string;
  numero: string;
  cliente: string;
  responsavel: string;
  prioridade: Prioridade;
  status: 'pendente' | 'concluido' | 'atrasado';
  data: string;
};

export type Cliente = {
  id: string;
  nome: string;
  tipo: 'Pessoa Física' | 'Pessoa Jurídica';
  documento: string;
  atualizacao: string;
  status: StatusTone;
};

export type Movimentacao = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  autor: string;
};

export type Documento = {
  id: string;
  nome: string;
  tipo: string;
  data: string;
  tamanho: string;
  /** Texto extraído do documento, quando disponível. A IA trabalha somente sobre ele. */
  conteudo?: string;
  autor?: string;
};

export type Parte = { id: string; nome: string; papel: string; doc: string; rep: string };

export type Prazo = {
  id: string;
  descricao: string;
  data: string;
  tone: PrazoTone;
  responsavel: string;
  prioridade: Prioridade;
  status: StatusTone;
};

export type Modalidade = 'Presencial' | 'Online' | 'Híbrida';

export type Audiencia = {
  id: string;
  tipo: string;
  data: string;
  local: string;
  modalidade: Modalidade;
  status: StatusTone;
  participantes?: string;
  responsavel?: string;
  observacoes?: string;
};

export type Processo = {
  numero: string;
  clienteId: string;
  cliente: string;
  responsavel: string;
  area: string;
  status: StatusTone;
  arquivado: boolean;
  tribunal: string;
  comarca: string;
  vara: string;
  atualizacao: string;
  criadoEm: string;
  resumo: string;
  observacoes: string;
  partes: Parte[];
  documentos: Documento[];
  movimentacoes: Movimentacao[];
  prazos: Prazo[];
  audiencias: Audiencia[];
};

export const advogadosSeed: Advogado[] = [
  { id: 'adv-0', nome: 'Mariana Silva', email: 'mariana.silva@juriscore.com.br', senha: 'juriscore', telefone: '(81) 99812-4410', perfil: 'Administrador', ativo: true, oab: 'OAB/PE 39.240', oabUf: 'PE', areas: ['Direito Empresarial', 'Direito Civil'], cargo: 'Sócia administradora', escritorio: 'Silva & Costa Advogados', ultimaAtividade: rel(0, '08h40') },
  { id: 'adv-1', nome: 'Ana Costa', email: 'ana.costa@juriscore.com.br', senha: 'juriscore', telefone: '(81) 99731-2290', perfil: 'Advogado', ativo: true, oab: 'OAB/PE 45.678', oabUf: 'PE', especialidade: 'Contencioso cível', anosExperiencia: 9, areas: ['Direito Civil', 'Direito Tributário', 'Direito do Consumidor'], ultimaAtividade: rel(0, '09h12') },
  { id: 'adv-2', nome: 'Rafael Mendes', email: 'rafael.mendes@juriscore.com.br', senha: 'juriscore', telefone: '(81) 98820-1174', perfil: 'Advogado', ativo: true, oab: 'OAB/PE 52.109', oabUf: 'PE', especialidade: 'Relações de trabalho', anosExperiencia: 6, areas: ['Direito Trabalhista', 'Direito Empresarial'], ultimaAtividade: rel(-1, '17h35') },
  { id: 'adv-3', nome: 'Juliana Alves', email: 'juliana.alves@juriscore.com.br', senha: 'juriscore', telefone: '(81) 99605-8831', perfil: 'Advogado', ativo: true, oab: 'OAB/PE 61.234', oabUf: 'PE', especialidade: 'Benefícios previdenciários', anosExperiencia: 4, areas: ['Direito Previdenciário', 'Direito de Família'], ultimaAtividade: rel(-2, '11h02') },
  { id: 'adv-4', nome: 'Bruno Tavares', email: 'bruno.tavares@juriscore.com.br', senha: 'juriscore', telefone: '(81) 99144-6620', perfil: 'Assistente', ativo: true, oab: '', areas: ['Direito Civil', 'Direito Trabalhista'], equipe: 'Ana Costa', ultimaAtividade: rel(0, '10h05') },
  { id: 'adv-5', nome: 'Letícia Ramos', email: 'leticia.ramos@juriscore.com.br', senha: 'juriscore', telefone: '(81) 98470-3312', perfil: 'Assistente', ativo: false, oab: '', areas: ['Direito Previdenciário'], equipe: 'Juliana Alves', ultimaAtividade: rel(-34, '15h20') },
];

export const tarefasSeed: Tarefa[] = [
  { id: 'tk-1', titulo: 'Preparar minuta de manifestação sobre documentos', numero: '0001234-56.2026.8.17.0001', cliente: 'João Silva', responsavel: 'Ana Costa', prioridade: 'alta', status: 'pendente', data: rel(0) },
  { id: 'tk-2', titulo: 'Reunir depósito recursal e guias de custas', numero: '0009876-12.2025.8.17.0001', cliente: 'Empresa ABC Ltda.', responsavel: 'Rafael Mendes', prioridade: 'alta', status: 'atrasado', data: rel(-2) },
  { id: 'tk-3', titulo: 'Solicitar CNIS atualizado à cliente', numero: '0004567-89.2024.8.17.0001', cliente: 'Maria Oliveira', responsavel: 'Bruno Tavares', prioridade: 'média', status: 'pendente', data: rel(1) },
  { id: 'tk-4', titulo: 'Confirmar comparecimento das testemunhas', numero: '0007654-32.2023.8.17.0001', cliente: 'Carlos Pereira', responsavel: 'Rafael Mendes', prioridade: 'média', status: 'pendente', data: rel(2) },
  { id: 'tk-5', titulo: 'Arquivar comprovantes de quitação', numero: '0001111-22.2024.8.17.0001', cliente: 'Tech Solutions S.A.', responsavel: 'Ana Costa', prioridade: 'baixa', status: 'concluido', data: rel(-9) },
  { id: 'tk-6', titulo: 'Conferir cálculo de alimentos atualizado', numero: '0003321-10.2026.8.17.0001', cliente: 'João Batista Souza', responsavel: 'Juliana Alves', prioridade: 'média', status: 'pendente', data: rel(3) },
];

export const compromissosSeed: Compromisso[] = [
  { id: 'cp-1', titulo: 'Reunião com cliente: proposta de acordo', data: rel(1, '10h00'), local: 'Sala de reuniões 1', responsavel: 'Ana Costa', numero: '0001234-56.2026.8.17.0001', status: 'confirmada' },
  { id: 'cp-2', titulo: 'Alinhamento semanal da equipe', data: rel(4, '09h00'), local: 'Online · Meet', responsavel: 'Mariana Silva', status: 'confirmada' },
];

export const clientesSeed: Cliente[] = [
  { id: 'cli-1', nome: 'João Silva', tipo: 'Pessoa Física', documento: 'CPF 123.456.789-00', atualizacao: rel(-1), status: 'ativo' },
  { id: 'cli-2', nome: 'Empresa ABC Ltda.', tipo: 'Pessoa Jurídica', documento: 'CNPJ 12.345.678/0001-90', atualizacao: rel(-3), status: 'ativo' },
  { id: 'cli-3', nome: 'Maria Oliveira', tipo: 'Pessoa Física', documento: 'CPF 987.654.321-00', atualizacao: rel(-5), status: 'ativo' },
  { id: 'cli-4', nome: 'Tech Solutions S.A.', tipo: 'Pessoa Jurídica', documento: 'CNPJ 98.765.432/0001-10', atualizacao: rel(-9), status: 'ativo' },
  { id: 'cli-5', nome: 'Carlos Pereira', tipo: 'Pessoa Física', documento: 'CPF 111.222.333-44', atualizacao: rel(-6), status: 'ativo' },
  { id: 'cli-6', nome: 'Fernanda Lima', tipo: 'Pessoa Física', documento: 'CPF 555.666.777-88', atualizacao: rel(-14), status: 'ativo' },
  { id: 'cli-7', nome: 'Construtora Norte', tipo: 'Pessoa Jurídica', documento: 'CNPJ 22.333.444/0001-55', atualizacao: rel(-20), status: 'ativo' },
  { id: 'cli-8', nome: 'João Batista Souza', tipo: 'Pessoa Física', documento: 'CPF 222.444.666-80', atualizacao: rel(-2), status: 'ativo' },
];

const pz = (id: string, descricao: string, dias: number, responsavel: string, prioridade: Prioridade, status: StatusTone = 'pendente'): Prazo => {
  const data = rel(dias);
  return { id, descricao, data, tone: toneOf(data), responsavel, prioridade, status: dias < 0 && status === 'pendente' ? 'atrasado' : status };
};

export const processosSeed: Processo[] = [
  {
    numero: '0001234-56.2026.8.17.0001',
    clienteId: 'cli-1',
    cliente: 'João Silva',
    responsavel: 'Ana Costa',
    area: 'Direito Civil',
    status: 'em-andamento',
    arquivado: false,
    tribunal: 'TJPE',
    comarca: 'Recife',
    vara: '3ª Vara Cível',
    atualizacao: rel(-1),
    criadoEm: rel(-60),
    observacoes: 'Cliente prefere contato por e-mail. Há interesse em acordo caso o valor seja parcelado.',
    resumo:
      'Ação de cobrança em que o autor, João Silva, busca o pagamento de valores referentes a contrato de prestação de serviços firmado com a empresa ré. O processo está na fase de instrução, aguardando manifestação sobre os documentos juntados.',
    partes: [
      { id: 'p1', nome: 'João Silva', papel: 'Autor', doc: 'CPF 123.456.789-00', rep: 'Ana Costa (OAB/PE 45.678)' },
      { id: 'p2', nome: 'Comércio Vega Ltda.', papel: 'Réu', doc: 'CNPJ 12.345.678/0001-90', rep: 'Não constituído' },
    ],
    documentos: [
      { id: 'd4', nome: 'Decisão interlocutória.pdf', tipo: 'Decisão', data: rel(-4), tamanho: '96 KB', autor: 'Sistema TJPE', conteudo: `Vistos. Recebo a petição de juntada apresentada pela parte autora, João Silva. Intime-se a parte ré, Comércio Vega Ltda., para que se manifeste sobre os documentos juntados no prazo de 15 dias. Fica designada audiência de conciliação para ${rel(12)}. Decorrido o prazo sem manifestação, os autos deverão retornar conclusos. Recife, ${rel(-4)}. Juiz de Direito da 3ª Vara Cível.` },
      { id: 'd3', nome: 'Comprovantes de pagamento.pdf', tipo: 'Prova', data: rel(-6), tamanho: '640 KB', autor: 'Ana Costa', conteudo: `Relação de três transferências realizadas por João Silva à Comércio Vega Ltda., totalizando R$ 48.200,00. Último comprovante datado de ${rel(-150)}.` },
      { id: 'd2', nome: 'Contrato de prestação.pdf', tipo: 'Prova', data: rel(-60), tamanho: '1,2 MB', autor: 'Ana Costa', conteudo: `Contrato de prestação de serviços entre João Silva (contratante) e Comércio Vega Ltda. (contratada). A contratada deverá entregar os serviços em até 90 dias. Em caso de inadimplemento, a contratada fica obrigada a restituir os valores pagos com multa de 10%. Assinado em ${rel(-240)}.` },
      { id: 'd1', nome: 'Petição inicial.pdf', tipo: 'Petição', data: rel(-60), tamanho: '284 KB', autor: 'Ana Costa', conteudo: `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 3ª VARA CÍVEL DA COMARCA DE RECIFE, PE.

JOÃO SILVA, brasileiro, empresário, inscrito no CPF sob o nº 123.456.789-00, por sua advogada Ana Costa (OAB/PE 45.678), vem propor AÇÃO DE COBRANÇA COM PEDIDO DE TUTELA DE URGÊNCIA em face de COMÉRCIO VEGA LTDA., inscrita no CNPJ sob o nº 12.345.678/0001-90, pelos fatos e fundamentos a seguir.

DOS FATOS
Em ${rel(-240)}, o autor firmou com a ré contrato de prestação de serviços para implantação de sistema de gestão em sua empresa. A ré se comprometeu a entregar os serviços em até 90 dias. Em três parcelas, o autor pagou à ré o total de R$ 48.200,00, conforme comprovantes anexos. O último pagamento ocorreu em ${rel(-150)}. Esgotado o prazo contratual, os serviços não foram entregues. Em ${rel(-95)}, o autor enviou notificação extrajudicial à ré, que não respondeu. O autor tomou conhecimento, por informação de fornecedores, de que a ré estaria encerrando suas atividades na filial de Recife.

DO DIREITO
O inadimplemento da ré está caracterizado pelo descumprimento do prazo de entrega, nos termos dos arts. 389 e 475 do Código Civil. A cláusula contratual prevê a restituição dos valores pagos com multa de 10% em caso de inadimplemento. A tutela de urgência é cabível, na forma do art. 300 do Código de Processo Civil, diante da probabilidade do direito, demonstrada pelo contrato e pelos comprovantes, e do risco ao resultado útil do processo, diante do possível encerramento das atividades da ré.

DOS PEDIDOS
Diante do exposto, requer: a concessão de tutela de urgência para indisponibilidade de valores da ré até o limite de R$ 53.020,00; a citação da ré para, querendo, apresentar contestação; a condenação da ré à restituição de R$ 48.200,00, acrescidos da multa contratual de R$ 4.820,00, correção monetária e juros de mora; a condenação da ré ao pagamento de custas e honorários advocatícios; a designação de audiência de conciliação, pois o autor tem interesse em acordo.

DAS PROVAS
Protesta pela produção de todas as provas admitidas, em especial documental e testemunhal. Juntam-se o contrato de prestação de serviços e os comprovantes de pagamento.

Dá-se à causa o valor de R$ 53.020,00. Recife, ${rel(-60)}. Ana Costa, OAB/PE 45.678.` },
    ],
    movimentacoes: [
      { id: 'm1', data: rel(-1), tipo: 'Juntada de documento', descricao: 'Comprovantes complementares anexados aos autos pela parte autora.', autor: 'Ana Costa' },
      { id: 'm2', data: rel(-4), tipo: 'Decisão', descricao: 'Juiz determinou a intimação da parte ré para manifestação em 15 dias e designou audiência de conciliação.', autor: 'Sistema TJPE' },
      { id: 'm3', data: rel(-45), tipo: 'Distribuição', descricao: 'Processo distribuído para a 3ª Vara Cível da Comarca de Recife.', autor: 'Sistema TJPE' },
      { id: 'm4', data: rel(-60), tipo: 'Petição inicial', descricao: 'Ação de cobrança protocolada com pedido de tutela de urgência.', autor: 'Ana Costa' },
    ],
    prazos: [
      pz('pr1', 'Manifestação sobre documentos', 0, 'Ana Costa', 'alta'),
      pz('pr2', 'Réplica à contestação', 6, 'Ana Costa', 'média', 'em-andamento'),
    ],
    audiencias: [
      { id: 'au1', tipo: 'Audiência de conciliação', data: rel(12, '14h00'), local: '3ª Vara Cível, Sala 2', modalidade: 'Presencial', status: 'confirmada', responsavel: 'Ana Costa', participantes: 'João Silva' },
    ],
  },
  {
    numero: '0009876-12.2025.8.17.0001',
    clienteId: 'cli-2',
    cliente: 'Empresa ABC Ltda.',
    responsavel: 'Rafael Mendes',
    area: 'Direito Trabalhista',
    status: 'atrasado',
    arquivado: false,
    tribunal: 'TRT-6',
    comarca: 'Recife',
    vara: '1ª Vara do Trabalho',
    atualizacao: rel(-3),
    criadoEm: rel(-190),
    observacoes: 'Prazo recursal crítico. Verificar depósito recursal e custas antes de protocolar.',
    resumo: 'Reclamação trabalhista movida por ex-colaborador. A sentença foi de procedência parcial e o prazo para recurso ordinário está em curso.',
    partes: [
      { id: 'p3', nome: 'Empresa ABC Ltda.', papel: 'Reclamada', doc: 'CNPJ 12.345.678/0001-90', rep: 'Rafael Mendes (OAB/PE 52.109)' },
      { id: 'p4', nome: 'Pedro Santos', papel: 'Reclamante', doc: 'CPF 321.654.987-00', rep: 'Escritório Lima & Associados' },
    ],
    documentos: [
      { id: 'd5', nome: 'Sentença.pdf', tipo: 'Decisão', data: rel(-9), tamanho: '210 KB', autor: 'Sistema TRT-6', conteudo: `Julgo parcialmente procedentes os pedidos formulados por Pedro Santos em face de Empresa ABC Ltda., condenando a reclamada ao pagamento de horas extras e reflexos. Custas pela reclamada no valor de R$ 1.200,00. A reclamada deverá comprovar o depósito recursal caso interponha recurso. Publicada em ${rel(-9)}.` },
    ],
    movimentacoes: [
      { id: 'm5', data: rel(-9), tipo: 'Sentença', descricao: 'Sentença de procedência parcial publicada. Prazo recursal em curso.', autor: 'Sistema TRT-6' },
    ],
    prazos: [pz('pr3', 'Interpor recurso ordinário', -1, 'Rafael Mendes', 'alta')],
    audiencias: [],
  },
  {
    numero: '0004567-89.2024.8.17.0001',
    clienteId: 'cli-3',
    cliente: 'Maria Oliveira',
    responsavel: 'Juliana Alves',
    area: 'Direito Previdenciário',
    status: 'aguardando',
    arquivado: false,
    tribunal: 'JFPE',
    comarca: 'Recife',
    vara: '12ª Vara Federal',
    atualizacao: rel(-5),
    criadoEm: rel(-600),
    observacoes: 'Solicitar à cliente extrato CNIS atualizado no portal Meu INSS.',
    resumo: 'Ação de concessão de aposentadoria por tempo de contribuição. Aguardando juntada de documento previdenciário.',
    partes: [
      { id: 'p5', nome: 'Maria Oliveira', papel: 'Autora', doc: 'CPF 987.654.321-00', rep: 'Juliana Alves (OAB/PE 61.234)' },
      { id: 'p6', nome: 'INSS', papel: 'Réu', doc: 'Autarquia federal', rep: 'Procuradoria Federal' },
    ],
    documentos: [],
    movimentacoes: [
      { id: 'm6', data: rel(-5), tipo: 'Intimação', descricao: 'Intimação para juntada de CNIS atualizado.', autor: 'Sistema JFPE' },
    ],
    prazos: [pz('pr4', 'Juntada de documento (CNIS)', 2, 'Juliana Alves', 'média')],
    audiencias: [],
  },
  {
    numero: '0007654-32.2023.8.17.0001',
    clienteId: 'cli-5',
    cliente: 'Carlos Pereira',
    responsavel: 'Rafael Mendes',
    area: 'Direito Civil',
    status: 'em-andamento',
    arquivado: false,
    tribunal: 'TJPE',
    comarca: 'Olinda',
    vara: '2ª Vara Cível',
    atualizacao: rel(-38),
    criadoEm: rel(-800),
    observacoes: 'Testemunhas já arroladas. Confirmar comparecimento antes da audiência.',
    resumo: 'Ação indenizatória por danos materiais. Audiência de instrução designada.',
    partes: [
      { id: 'p7', nome: 'Carlos Pereira', papel: 'Autor', doc: 'CPF 111.222.333-44', rep: 'Rafael Mendes (OAB/PE 52.109)' },
    ],
    documentos: [],
    movimentacoes: [
      { id: 'm7', data: rel(-38), tipo: 'Designação', descricao: 'Audiência de instrução e julgamento designada.', autor: 'Sistema TJPE' },
    ],
    prazos: [],
    audiencias: [
      { id: 'au2', tipo: 'Audiência de instrução', data: rel(3, '09h30'), local: '2ª Vara Cível, Olinda', modalidade: 'Híbrida', status: 'confirmada', responsavel: 'Rafael Mendes', participantes: 'Carlos Pereira, 2 testemunhas' },
    ],
  },
  {
    numero: '0003321-10.2026.8.17.0001',
    clienteId: 'cli-8',
    cliente: 'João Batista Souza',
    responsavel: 'Juliana Alves',
    area: 'Direito de Família',
    status: 'em-andamento',
    arquivado: false,
    tribunal: 'TJPE',
    comarca: 'Recife',
    vara: '1ª Vara de Família',
    atualizacao: rel(-2),
    criadoEm: rel(-30),
    observacoes: '',
    resumo: 'Ação revisional de alimentos proposta pelo cliente, que busca a redução do valor fixado em razão de alteração da capacidade financeira.',
    partes: [
      { id: 'p8', nome: 'João Batista Souza', papel: 'Autor', doc: 'CPF 222.444.666-80', rep: 'Juliana Alves (OAB/PE 61.234)' },
    ],
    documentos: [
      { id: 'd6', nome: 'Petição revisional.pdf', tipo: 'Petição', data: rel(-30), tamanho: '188 KB', autor: 'Juliana Alves' },
    ],
    movimentacoes: [
      { id: 'm8', data: rel(-2), tipo: 'Despacho', descricao: 'Determinada a citação da parte ré e vista ao Ministério Público.', autor: 'Sistema TJPE' },
    ],
    prazos: [pz('pr5', 'Apresentar cálculo atualizado', 5, 'Juliana Alves', 'média')],
    audiencias: [],
  },
  {
    numero: '0001111-22.2024.8.17.0001',
    clienteId: 'cli-4',
    cliente: 'Tech Solutions S.A.',
    responsavel: 'Ana Costa',
    area: 'Direito Tributário',
    status: 'encerrado',
    arquivado: true,
    tribunal: 'TJPE',
    comarca: 'Recife',
    vara: '4ª Vara da Fazenda',
    atualizacao: rel(-9),
    criadoEm: rel(-480),
    observacoes: 'Débito quitado integralmente. Guardar comprovantes por 5 anos.',
    resumo: 'Execução fiscal quitada. Processo encerrado e arquivado.',
    partes: [],
    documentos: [],
    movimentacoes: [
      { id: 'm9', data: rel(-9), tipo: 'Arquivamento', descricao: 'Processo arquivado após quitação integral do débito.', autor: 'Sistema TJPE' },
    ],
    prazos: [],
    audiencias: [],
  },
];
