import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchPayload,
  normalizeCaseNumber,
  resolveTribunalAlias,
  sanitizeDataJudResponse,
} from './domain.mjs';
import { queryDataJud } from './datajud-service.mjs';

test('resolve apenas aliases de tribunais explicitamente permitidos', () => {
  assert.equal(resolveTribunalAlias('TJPE'), 'api_publica_tjpe');
  assert.equal(resolveTribunalAlias('api_publica_tjsp'), 'api_publica_tjsp');
  assert.equal(resolveTribunalAlias('TRE-DF'), 'api_publica_tre-df');
  assert.equal(resolveTribunalAlias('TRT 15'), 'api_publica_trt15');
  assert.equal(resolveTribunalAlias('https://attacker.invalid'), null);
  assert.equal(resolveTribunalAlias('tribunal desconhecido'), null);
});

test('normaliza número CNJ de 20 dígitos e rejeita entrada inesperada', () => {
  assert.equal(normalizeCaseNumber('0001234-56.2024.8.17.0001'), '00012345620248170001');
  assert.equal(normalizeCaseNumber('0001234-56.2024.8.17.0001 OR *'), null);
  assert.equal(normalizeCaseNumber('123'), null);
});

test('gera pesquisa exata limitada a um resultado e poucos campos', () => {
  assert.deepEqual(buildSearchPayload('00012345620248170001'), {
    size: 1,
    track_total_hits: false,
    _source: ['nivelSigilo', 'classe.nome', 'dataAjuizamento', 'grau'],
    query: { match: { numeroProcesso: '00012345620248170001' } },
  });
});

test('minimiza a resposta e descarta partes, movimentos e processos sigilosos', () => {
  const publicResult = sanitizeDataJudResponse({
    hits: { hits: [{ _source: {
      nivelSigilo: 0,
      classe: { nome: 'Procedimento comum', codigo: 'ignored' },
      dataAjuizamento: '2024-03-22T10:20:30.000Z',
      grau: 'G1',
      numeroProcesso: 'must-not-return',
      partes: [{ nome: 'Pessoa identificável' }],
      movimentos: [{ nome: 'conteúdo omitido' }],
    } }] },
  });
  assert.deepEqual(publicResult, {
    found: true,
    metadata: { classe: 'Procedimento comum', dataAjuizamento: '2024-03-22', grau: 'G1' },
  });
  assert.equal(JSON.stringify(publicResult).includes('Pessoa identificável'), false);
  assert.deepEqual(sanitizeDataJudResponse({ hits: { hits: [{ _source: { nivelSigilo: 1, classe: { nome: 'Restrito' } } }] } }), {
    found: false,
    metadata: null,
  });
});

test('envia chave só no cabeçalho e não envia campos do utilizador como DSL', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ hits: { hits: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const result = await queryDataJud({
    tribunal: 'TJPE',
    caseNumber: '00012345620248170001',
    apiKey: 'test-key',
    fetchImpl,
  });
  assert.equal(captured.url, 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpe/_search');
  assert.equal(captured.options.headers.Authorization, 'APIKey test-key');
  assert.equal(JSON.parse(captured.options.body).query.match.numeroProcesso, '00012345620248170001');
  assert.deepEqual(result, { found: false, metadata: null });
});
