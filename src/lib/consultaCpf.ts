import { supabase } from './supabase';

export type ConsultaCpfData = {
  cpf: string;
  name: string | null;
  civilName: string | null;
  socialName: string | null;
  birthDate: string | null;
  registrationDate: string | null;
  status: string | null;
  deathYear: string | null;
};

type ConsultaResponse = { ok: true; partial: boolean; data: ConsultaCpfData } | { ok: false; error?: string; code?: string };

export async function consultaCpf(cpf: string, birthDate: string): Promise<ConsultaCpfData> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase.functions.invoke<ConsultaResponse>('consulta-cpf-infosimples', {
    body: { cpf, birthDate },
  });
  if (error) throw new Error('Não foi possível consultar o CPF. Tente novamente.');
  if (!data?.ok) {
    const messages: Record<string, string> = {
      invalid_cpf: 'O CPF informado é inválido.',
      invalid_birth_date: 'A data de nascimento informada é inválida.',
      provider_not_found: 'Não foi encontrada correspondência para o CPF e a data informados.',
      rate_limited: 'Limite de consultas atingido. Tente novamente mais tarde.',
      provider_unauthorized: 'A integração de consulta não está autorizada no servidor.',
      integration_unconfigured: 'A integração ainda não está configurada no servidor.',
      provider_unavailable: 'O serviço de consulta está temporariamente indisponível.',
    };
    throw new Error(messages[data?.code ?? ''] ?? 'Não foi possível concluir a consulta. Verifique os dados e tente novamente.');
  }
  return data.data;
}
