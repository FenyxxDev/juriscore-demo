import { supabase } from './supabase';

type GeminiResponse = {
  answer?: unknown;
  error?: unknown;
};

export type GeminiContext = {
  process?: {
    number?: string;
    clientName?: string;
    area?: string;
    status?: string;
    tribunal?: string;
    comarca?: string;
    vara?: string;
    summary?: string;
    internalNotes?: string;
  };
  movements?: Array<{ date: string; type: string; description: string }>;
  deadlines?: Array<{ description: string; date: string; status: string; priority: string }>;
  hearings?: Array<{ type: string; date: string; status: string; modality: string; location: string }>;
  parties?: Array<{ name: string; role: string; representative: string }>;
  documents?: Array<{ name: string; type: string; date: string; content: string; truncated?: boolean }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'O Gemini ainda não está configurado no servidor.',
  rate_limited: 'O limite temporário do Gemini foi atingido. Aguarde um pouco e tente novamente.',
  provider_unavailable: 'O Gemini está temporariamente indisponível. Tente novamente em instantes.',
  provider_timeout: 'O Gemini demorou demais para responder. Tente novamente.',
  provider_rejected_request: 'O Gemini não aceitou esta solicitação. Revise a pergunta e tente novamente.',
  empty_response: 'O Gemini não retornou uma resposta utilizável. Tente novamente.',
  question_too_long: 'A pergunta ultrapassa o limite de 4.000 caracteres.',
  invalid_context: 'Não foi possível validar o contexto selecionado. Revise as seções e tente novamente.',
  context_too_large: 'O conteúdo selecionado é muito extenso. Reduza as seções ou documentos e tente novamente.',
  question_required: 'Digite uma pergunta antes de enviar.',
};

export async function askGemini(question: string, context?: GeminiContext): Promise<string> {
  if (!supabase) {
    throw new Error('O serviço de autenticação não está configurado.');
  }

  const { data, error } = await supabase.functions.invoke<GeminiResponse>('assistant-gemini', {
    body: { question, ...(context ? { context } : {}) },
  });

  if (error) {
    let code = '';
    let detail = '';
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json() as GeminiResponse & { detail?: string };
        if (typeof payload.error === 'string') code = payload.error;
        if (typeof payload.detail === 'string') detail = payload.detail;
      } catch {
        // Use the generic message when the response is not JSON.
      }
    }
    const baseMsg = ERROR_MESSAGES[code] ?? 'Não foi possível consultar o Gemini. Verifique a conexão e tente novamente.';
    throw new Error(detail ? `${baseMsg} (Detalhe do Google: ${detail})` : baseMsg);
  }

  if (typeof data?.answer !== 'string' || !data.answer.trim()) {
    throw new Error('O Gemini não retornou uma resposta utilizável. Tente novamente.');
  }

  return data.answer.trim();
}
