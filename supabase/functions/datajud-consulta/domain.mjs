const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ALIAS_ENTRIES = [
  ...STATES.map((state) => [`TJ${state}`, `api_publica_tj${state.toLowerCase()}`]),
  ['TJDFT', 'api_publica_tjdft'],
  ...Array.from({ length: 6 }, (_, index) => [`TRF${index + 1}`, `api_publica_trf${index + 1}`]),
  ...Array.from({ length: 24 }, (_, index) => [`TRT${index + 1}`, `api_publica_trt${index + 1}`]),
  ...STATES.map((state) => [`TRE${state}`, `api_publica_tre-${state.toLowerCase()}`]),
  ['TREDF', 'api_publica_tre-df'],
  ['TSE', 'api_publica_tse'],
  ['TST', 'api_publica_tst'],
  ['STJ', 'api_publica_stj'],
  ['STM', 'api_publica_stm'],
  ['TJMMG', 'api_publica_tjmmg'],
  ['TJMRS', 'api_publica_tjmrs'],
  ['TJMSP', 'api_publica_tjmsp'],
];

const TRIBUNAL_ALIASES = new Map();
for (const [shortName, alias] of ALIAS_ENTRIES) {
  TRIBUNAL_ALIASES.set(shortName, alias);
  TRIBUNAL_ALIASES.set(alias.toUpperCase().replace(/[\s-]+/g, ''), alias);
}

export function resolveTribunalAlias(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  return TRIBUNAL_ALIASES.get(normalized) ?? null;
}

export function normalizeCaseNumber(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[0-9.\-\s]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length === 20 ? digits : null;
}

export function buildSearchPayload(caseNumber) {
  return {
    size: 1,
    track_total_hits: false,
    _source: [
      'numeroProcesso', 'nivelSigilo', 'classe.nome', 'dataAjuizamento', 'grau',
      'movimentos.codigo', 'movimentos.nome', 'movimentos.dataHora',
      'movimentos.complementosTabelados', 'movimentos.orgaoJulgador.nomeOrgao',
    ],
    query: {
      bool: {
        filter: [
          { term: { "numeroProcesso.keyword": caseNumber } }
        ]
      }
    },
  };
}

function safeLabel(value, maxLength = 100) {
  if (typeof value !== 'string') return null;
  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return sanitized && sanitized.length <= maxLength ? sanitized : null;
}

function safeDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[1] ? null : match[1];
}

function safeDateTime(value) {
  if (typeof value !== 'string' || value.length > 48) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sanitizeMovement(value) {
  if (!value || typeof value !== 'object') return null;
  const date = safeDateTime(value.dataHora);
  const name = safeLabel(value.nome, 180);
  if (!date || !name) return null;
  const code = Number.isInteger(value.codigo) ? value.codigo : null;
  const complements = Array.isArray(value.complementosTabelados)
    ? value.complementosTabelados
      .slice(0, 10)
      .map((item) => safeLabel(item?.nome ?? item?.descricao, 120))
      .filter(Boolean)
    : [];
  const court = safeLabel(value.orgaoJulgador?.nomeOrgao, 160);
  return { code, name, date, complements, court };
}

export function sanitizeDataJudHit(hit, expectedCaseNumber) {
  const source = hit && typeof hit === 'object' ? hit._source : null;
  if (!source || typeof source !== 'object' || Number(source.nivelSigilo) !== 0) return null;
  if (normalizeCaseNumber(source.numeroProcesso) !== expectedCaseNumber) return null;

  const metadata = {
    classe: safeLabel(source.classe?.nome),
    dataAjuizamento: safeDate(source.dataAjuizamento),
    grau: safeLabel(source.grau, 30),
  };
  const movements = Array.isArray(source.movimentos)
    ? source.movimentos.map(sanitizeMovement).filter(Boolean).slice(0, 250)
    : [];
  if (!metadata.classe && !metadata.dataAjuizamento && !metadata.grau && movements.length === 0) return null;
  return { metadata, movements };
}

export function sanitizeDataJudResponse(payload, expectedCaseNumber) {
  const hits = payload?.hits?.hits;
  if (!Array.isArray(hits)) throw new Error('Resposta inválida da fonte DataJud.');
  const result = sanitizeDataJudHit(hits[0], expectedCaseNumber);
  return result
    ? { found: true, metadata: result.metadata, movements: result.movements }
    : { found: false, metadata: null, movements: [] };
}
