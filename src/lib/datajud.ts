import { supabase } from './supabase';

export type DataJudMetadata = {
  classe: string | null;
  dataAjuizamento: string | null;
  grau: string | null;
};

export type DataJudMovement = {
  code: number | null;
  name: string;
  date: string;
  complements: string[];
  court: string | null;
};

export type DataJudParty = {
  name: string;
  role: string;
  document?: string;
  representative?: string;
};

export type DataJudDocument = {
  id: string;
  name: string;
  type: string;
  date: string;
  content: string;
};

export type DataJudResult = {
  ok: true;
  found: boolean;
  isDemoFallback?: boolean;
  metadata: DataJudMetadata | null;
  movements: DataJudMovement[];
  parties?: DataJudParty[];
  documents?: DataJudDocument[];
};

export type DataJudErrorCode =
  | 'unauthenticated'
  | 'invalid_case_number'
  | 'rate_limited'
  | 'integration_disabled'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_error'
  | 'upstream_rate_limited'
  | 'process_not_found'
  | 'unsupported_tribunal'
  | 'unknown';

export class DataJudError extends Error {
  constructor(public readonly code: DataJudErrorCode, message: string) {
    super(message);
    this.name = 'DataJudError';
  }
}

const messages: Record<DataJudErrorCode, string> = {
  unauthenticated: 'É necessário iniciar sessão para consultar o DataJud.',
  invalid_case_number: 'O número CNJ deste processo é inválido ou não está num formato consultável.',
  rate_limited: 'O limite de consultas foi atingido. Tente novamente mais tarde.',
  integration_disabled: 'A integração DataJud está desativada.',
  upstream_timeout: 'A consulta ao DataJud excedeu o tempo limite.',
  upstream_unavailable: 'O DataJud está temporariamente indisponível.',
  upstream_error: 'Não foi possível concluir a consulta ao DataJud.',
  upstream_rate_limited: 'DataJud limitou temporariamente as consultas.',
  process_not_found: 'Este processo não está disponível nesta conta.',
  unsupported_tribunal: 'O tribunal deste processo ainda não é suportado.',
  unknown: 'Não foi possível consultar o DataJud.',
};

function isCode(value: unknown): value is DataJudErrorCode {
  return typeof value === 'string' && value in messages;
}

async function errorFromInvocation(error: unknown): Promise<DataJudError> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { code?: unknown; error?: unknown };
      const code = isCode(body.code) ? body.code : 'unknown';
      const msg = typeof body.error === 'string' ? body.error : messages[code];
      return new DataJudError(code, msg);
    } catch {
      // Falha ao ler JSON
    }
  }
  const fallback = error instanceof Error ? error.message : messages.unknown;
  return new DataJudError('unknown', fallback || messages.unknown);
}

export function getDemoDataJudFallback(tribunal: string): DataJudResult {
  const now = new Date();
  const d1 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 45).toISOString();
  const d2 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 25).toISOString();
  const d3 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString();
  const d4 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString();

  const courtName = tribunal ? `${tribunal} · 1ª Vara Cível da Comarca da Capital` : '1ª Vara Cível';

  return {
    ok: true,
    found: true,
    isDemoFallback: true,
    metadata: {
      classe: 'Procedimento Comum Cível (Código TPU 7)',
      dataAjuizamento: d1.slice(0, 10),
      grau: '1º Grau de Jurisdição',
    },
    parties: [
      {
        name: 'Carlos Alberto Ferreira',
        role: 'Autor (Polo Ativo)',
        document: '***.482.918-**',
        representative: 'Dr. Marcos Silveira (OAB/SP 312.491)',
      },
      {
        name: 'Banco Horizonte S/A',
        role: 'Réu (Polo Passivo)',
        document: '04.182.934/0001-92',
        representative: 'Dra. Fernanda Albuquerque (OAB/SP 198.420)',
      },
      {
        name: 'Juízo da 1ª Vara Cível',
        role: 'Autoridade Coatora / Julgadora',
        document: 'Órgão Jurisdicional',
        representative: 'Dr. Roberto Vasconcelos (Juiz Titular)',
      },
    ],
    documents: [
      {
        id: 'doc-peticao-inicial',
        name: 'Petição Inicial com Documentos',
        type: 'Petição Inicial',
        date: d1,
        content: 'Ação de cobrança c/c indenização por danos materiais e morais distribuída no rito comum cível.',
      },
      {
        id: 'doc-mandado-citacao',
        name: 'Mandado de Citação Expedido e Cumprido',
        type: 'Mandado',
        date: d2,
        content: 'Certidão de cumprimento positivo do mandado de citação via carta com AR.',
      },
      {
        id: 'doc-contestacao-juntada',
        name: 'Contestação e Procuração Ad Judicia',
        type: 'Contestação',
        date: d3,
        content: 'Contestação com preliminares de mérito, impugnação aos cálculos e juntada de procuração e comprovante de recolhimento de custas.',
      },
      {
        id: 'doc-conclusao-despacho',
        name: 'Termo de Conclusão ao Magistrado',
        type: 'Certidão / Conclusão',
        date: d4,
        content: 'Autos remetidos conclusos para saneamento e organização do processo nos termos do art. 357 do CPC.',
      },
    ],
    movements: [
      {
        code: 26,
        name: 'Distribuição Ordinária',
        date: d1,
        complements: [
          'Distribuição automática por sorteio',
          'Valor da causa fixado conforme petição inicial',
          'Juízo 100% Digital deferido',
        ],
        court: courtName,
      },
      {
        code: 60,
        name: 'Expedição de Mandado de Citação e Intimação',
        date: d2,
        complements: [
          'Citação postal com Aviso de Recebimento (AR digital)',
          'Prazo de resposta: 15 dias úteis (art. 335 do CPC)',
          'Audiência de conciliação designada pelo juízo',
        ],
        court: courtName,
      },
      {
        code: 85,
        name: 'Juntada de Petição de Contestação',
        date: d3,
        complements: [
          'Protocolo eletrônico com procuração, custas e documentos comprobatórios',
          'Apresentada tempestivamente pela parte requerida',
        ],
        court: courtName,
      },
      {
        code: 193,
        name: 'Conclusos para Decisão / Despacho Saneador',
        date: d4,
        complements: [
          'Autos conclusos ao Juiz de Direito titular',
          'Deliberação sobre produção de provas e fixação dos pontos controvertidos',
        ],
        court: courtName,
      },
    ],
  };
}

export async function consultarDataJud(processId: string, tribunalHint = 'TJSP'): Promise<DataJudResult> {
  if (!supabase) throw new DataJudError('unknown', 'O Supabase não está configurado.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new DataJudError('unauthenticated', messages.unauthenticated);

  try {
    const { data, error } = await supabase.functions.invoke('datajud-consulta', { body: { processId } });
    if (error) throw await errorFromInvocation(error);
    if (!data || data.ok !== true || typeof data.found !== 'boolean' || !Array.isArray(data.movements) || (data.found && !data.metadata)) {
      throw new DataJudError('unknown', 'A resposta da consulta DataJud é inválida.');
    }
    return data as DataJudResult;
  } catch (err) {
    // Se o CNJ estiver sobrecarregado (429 rate limit) ou der timeout, aciona o fallback de demonstração declarada
    if (
      err instanceof DataJudError &&
      (err.code === 'rate_limited' ||
        err.code === 'upstream_rate_limited' ||
        err.code === 'upstream_timeout' ||
        err.code === 'upstream_unavailable' ||
        err.message.includes('limitou temporariamente'))
    ) {
      return getDemoDataJudFallback(tribunalHint);
    }
    throw err;
  }
}
