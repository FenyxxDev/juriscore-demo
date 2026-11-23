import { supabase } from './supabase';

type GeminiResponse = {
  answer?: unknown;
  error?: unknown;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'O Gemini ainda não está configurado no servidor.',
  rate_limited: 'O limite temporário do Gemini foi atingido. Aguarde um pouco e tente novamente.',
  provider_unavailable: 'O Gemini está temporariamente indisponível. Tente novamente em instantes.',
  provider_timeout: 'O Gemini demorou demais para responder. Tente novamente.',
  provider_rejected_request: 'O Gemini não aceitou esta solicitação. Revise a pergunta e tente novamente.',
  empty_response: 'O Gemini não retornou uma resposta utilizável. Tente novamente.',
  question_too_long: 'A pergunta ultrapassa o limite de 4.000 caracteres.',
  question_required: 'Digite uma pergunta antes de enviar.',
};

export async function askGemini(question: string): Promise<string> {
  if (!supabase) {
    throw new Error('O serviço de autenticação não está configurado.');
  }

  const { data, error } = await supabase.functions.invoke<GeminiResponse>('assistant-gemini', {
    body: { question },
  });

  if (error) {
    let code = '';
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json() as GeminiResponse;
        if (typeof payload.error === 'string') code = payload.error;
      } catch {
        // Use the generic message when the response is not JSON.
      }
    }
    throw new Error(ERROR_MESSAGES[code] ?? 'Não foi possível consultar o Gemini. Verifique a conexão e tente novamente.');
  }

  if (typeof data?.answer !== 'string' || !data.answer.trim()) {
    throw new Error('O Gemini não retornou uma resposta utilizável. Tente novamente.');
  }

  return data.answer.trim();
}
