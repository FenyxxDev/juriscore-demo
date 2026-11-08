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

export async function consultarDataJud(processId: string): Promise<DataJudResult> {
  if (!supabase) throw new Error('O Supabase não está configurado.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Inicie sessão para consultar o DataJud.');

  const { data, error } = await supabase.functions.invoke('datajud-consulta', {
    body: { processId },
  });
  if (error) throw new Error('Não foi possível consultar o DataJud. A integração poderá estar desativada.');
  if (!data || data.ok !== true || typeof data.found !== 'boolean') {
    throw new Error('A resposta da consulta DataJud é inválida.');
  }
  return data as DataJudResult;
}
