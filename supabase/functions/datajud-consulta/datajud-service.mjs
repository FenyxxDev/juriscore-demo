import { buildSearchPayload, resolveTribunalAlias, sanitizeDataJudResponse } from './domain.mjs';

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const RESPONSE_LIMIT_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 60_000;

export class DataJudServiceError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'DataJudServiceError';
    this.code = code;
    this.status = status;
  }
}

async function readLimitedText(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new DataJudServiceError('response_too_large', 502, 'Resposta DataJud excede o limite.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function queryDataJud({ tribunal, caseNumber, apiKey, fetchImpl = fetch }) {
  const alias = resolveTribunalAlias(tribunal);
  if (!alias) throw new DataJudServiceError('unsupported_tribunal', 422, 'Tribunal ainda não suportado.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new DataJudServiceError('missing_api_key', 503, 'Integração DataJud sem configuração no servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${DATAJUD_BASE_URL}/${alias}/_search`, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildSearchPayload(caseNumber)),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new DataJudServiceError('upstream_timeout', 504, 'A consulta DataJud excedeu o tempo limite.');
    }
    throw new DataJudServiceError('upstream_unavailable', 502, 'DataJud está temporariamente indisponível.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new DataJudServiceError('upstream_rate_limited', 503, 'DataJud limitou temporariamente as consultas.');
  }
  if (!response.ok) {
    throw new DataJudServiceError('upstream_error', 502, 'Não foi possível concluir a consulta DataJud.');
  }

  let payload;
  try {
    payload = JSON.parse(await readLimitedText(response, RESPONSE_LIMIT_BYTES));
  } catch (error) {
    if (error instanceof DataJudServiceError) throw error;
    throw new DataJudServiceError('invalid_upstream_response', 502, 'Resposta inválida da fonte DataJud.');
  }

  try {
    return sanitizeDataJudResponse(payload, caseNumber);
  } catch {
    throw new DataJudServiceError('invalid_upstream_response', 502, 'Resposta inválida da fonte DataJud.');
  }
}
