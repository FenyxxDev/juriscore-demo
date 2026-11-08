# Integração académica com o DataJud

## Estado

O código da Edge Function `datajud-consulta`, o cliente Supabase e a migration de limite distribuído estão preparados no repositório. A função valida JWT, confirma que o processo pertence ao utilizador autenticado, aceita apenas aliases de tribunais allowlistados, consulta um processo real já guardado na conta e devolve somente metadados minimizados. A interface mostra a ação de consulta, mas mantém-na desativada até `VITE_DATAJUD_ENABLED=true`; a função exige separadamente `DATAJUD_ENABLED=true` no servidor. A resposta não é gravada na base de dados.

A função está desativada por defeito (`DATAJUD_ENABLED` tem de ser configurado como `true`). A migration `20261106080000_datajud_global_rate_limit.sql` ainda não foi aplicada e os secrets não foram definidos nem a função foi publicada em produção. Assim, o código está preparado para consultar processos reais, mas a consulta ainda não está ativa no site. Antes de a ativar, é necessária revisão académica/jurídica do fluxo concreto, em particular porque o número de processo pode estar associado a pessoa identificável.

## Arquitetura e autorização

O navegador chama `supabase.functions.invoke('datajud-consulta', { body: { processId } })` com a sessão Supabase. O gateway exige JWT (`verify_jwt = true`) e a função valida novamente o token com `auth.getUser`. Em seguida, consulta `public.processes` através do cliente do próprio utilizador e exige `owner_id = auth.uid()`. A função não aceita número processual, tribunal, URL, DSL Elasticsearch, paginação ou campos de projeção do navegador. O número e o tribunal são obtidos do processo da própria conta.

O número é validado como 20 algarismos depois de removidos apenas pontos, hífens e espaços. Esse formato corresponde ao exemplo oficial do CNJ, que pesquisa `numeroProcesso` sem formatação. O tribunal é convertido por uma lista fechada de aliases suportados. O endpoint é construído internamente em `https://api-publica.datajud.cnj.jus.br/{alias}/_search`; a pesquisa pede um único resultado e uma projeção curta. O cliente nunca chama a API DataJud diretamente.

A Edge Function usa `DATAJUD_API_KEY` como segredo de servidor e autentica a chamada externa por `Authorization: APIKey ...`. A chave pública disponibilizada pelo CNJ pode ser alterada, pelo que não foi incluída no repositório nem no bundle do navegador. As origens web são limitadas a `DATAJUD_ALLOWED_ORIGINS` ou aos domínios de desenvolvimento e produção configurados no código.

## Limites e privacidade

A migration cria o RPC `consume_datajud_request`, com contadores distribuídos no banco: até 90 consultas por minuto no total e 5 por utilizador. A função falha fechada se o RPC não estiver disponível. O contador global mantém margem abaixo do teto de 120 requisições por minuto previsto no Termo de Uso. Não há retry automático. Há timeout de 8 segundos, limite de resposta de 128 KiB e tratamento de erros sem devolver cabeçalhos nem corpo bruto do CNJ.

A resposta inclui somente `classe`, `dataAjuizamento` e `grau`, e apenas quando o registo indica `nivelSigilo = 0`. São omitidos número do processo, nomes e documentos das partes, movimentações e o restante `_source`. A resposta é transitória, não é persistida e os dados de entrada ou resposta não são escritos em logs. Ao iniciar uma consulta, a interface informa que o número do processo será enviado ao CNJ/DataJud.

O Termo de Uso proíbe recolher informações pessoais de terceiros, restringe exploração comercial e limita o consumo a 120 requisições por minuto, salvo autorização escrita do CNJ. O CNJ também pode alterar a chave ou limitar o acesso. Consultar apenas metadados minimizados não elimina o risco de que a própria pesquisa por número se relacione com uma pessoa. Antes de ativar a função, confirmar com a orientação académica e, se aplicável, com o CNJ que a consulta pontual de processos já pertencentes à conta está adequada ao uso permitido. O carácter académico e não comercial do projeto não elimina essas obrigações.

## Preparação necessária para ativação

1. Rever a finalidade e os campos da consulta com a orientação académica e confirmar a interpretação do Termo de Uso e da LGPD.
2. Aplicar a migration `20261106080000_datajud_global_rate_limit.sql` ao Supabase escolhido e confirmar o RPC e os privilégios exclusivos de `service_role`.
3. Definir no Supabase Edge Function Secrets `DATAJUD_API_KEY`, `DATAJUD_ENABLED=true` e, se o domínio do site diferir, `DATAJUD_ALLOWED_ORIGINS`. Nunca usar prefixo `VITE_` para a chave. Configurar `VITE_DATAJUD_ENABLED=true` no frontend somente quando o backend estiver publicado e pronto.
4. Publicar apenas a função `datajud-consulta` com verificação JWT ativa. Validar primeiro com uma conta de teste e uma consulta autorizada; não executar pesquisas reais até a revisão acima estar concluída.
5. A interface tem uma ação manual no detalhe do processo, desativada por defeito. Quando o backend estiver ativado e o frontend configurado, apresenta metadados reais devolvidos pelo CNJ, a data da consulta e a origem, sem alterar os dados locais nem prometer atualidade.

## Verificação local

Os testes sem rede podem ser executados com `node --test supabase/functions/datajud-consulta/domain.test.mjs`. Cobrem aliases allowlistados, validação do número, projeção, descarte de dados pessoais e cabeçalho de autenticação. A chave de teste é artificial e não consulta serviços externos.

## Referências

[1]: https://www.cnj.jus.br/sistemas/datajud/api-publica/ "API Pública DataJud do CNJ"
[2]: https://datajud-wiki.cnj.jus.br/api-publica/acesso/ "Acesso à API Pública DataJud"
[3]: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/ "Endpoints da API Pública DataJud"
[4]: https://formularios.cnj.jus.br/wp-content/uploads/2023/11/Termos-de-uso-api-publica-V1.2.pdf "Termos de uso da API Pública DataJud versão 1.2"
[5]: https://supabase.com/docs/guides/functions/auth "Securing Supabase Edge Functions"
[6]: https://supabase.com/docs/guides/functions/secrets "Supabase Edge Function Secrets"
[7]: https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf "Tutorial oficial da API Pública DataJud"
