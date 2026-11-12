import { supabase } from './supabase';

export type DataJudMetadata = {
  classe: string | null;
  dataAjuizamento: string | null;
  grau: string | null;
};

export type DataJudResult = {
  ok: true;
  found: boolean;
  metadata: DataJudMetadata | null;
};

export type DataJudErrorCode =
  | 'unauthenticated'
  | 'invalid_case_number'
  | 'rate_limited'
  | 'integration_disabled'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_error'
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
      const body = await context.clone().json() as { code?: unknown };
      const code = isCode(body.code) ? body.code : 'unknown';
      return new DataJudError(code, messages[code]);
    } catch {
      // A resposta de erro não é exibida ao utilizador.
    }
  }
  return new DataJudError('unknown', messages.unknown);
}

export async function consultarDataJud(processId: string): Promise<DataJudResult> {
  if (!supabase) throw new DataJudError('unknown', 'O Supabase não está configurado.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new DataJudError('unauthenticated', messages.unauthenticated);

  const { data, error } = await supabase.functions.invoke('datajud-consulta', { body: { processId } });
  if (error) throw await errorFromInvocation(error);
  if (!data || data.ok !== true || typeof data.found !== 'boolean' || (data.found && !data.metadata)) {
    throw new DataJudError('unknown', 'A resposta da consulta DataJud é inválida.');
  }
  return data as DataJudResult;
}
