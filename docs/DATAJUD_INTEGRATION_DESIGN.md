# Integração académica com o DataJud

## Estado

O commit consolidado foi publicado em `master`. Em 8 de novembro de 2026, a migration de rate limit foi executada em produção, a Edge Function `datajud-consulta` foi publicada com `verify_jwt` ativo e os secrets `DATAJUD_API_KEY` e `DATAJUD_ENABLED=true` foram configurados apenas no Supabase. A variável de frontend `VITE_DATAJUD_ENABLED=true` foi adicionada ao ambiente Production da Vercel, mas o rebuild da aplicação ainda precisa ser concluído; o deploy manual foi bloqueado por uma nova verificação de identidade da Vercel. Ainda não foi feita consulta real de processo.

O backend está habilitado, mas a interface de produção não deve ser considerada pronta para uso até existir um build que incorpore a variável Vercel e até a versão mais recente da função ser publicada. Antes da primeira consulta, ainda é necessária a revisão académica da finalidade concreta, porque o número de processo pode estar associado a uma pessoa identificável.

## Arquitetura e autorização

O navegador chama `supabase.functions.invoke('datajud-consulta', { body: { processId } })` com a sessão Supabase. O gateway exige JWT (`verify_jwt = true`) e a função valida novamente o token com `auth.getUser`. Em seguida, consulta `public.processes` através do cliente do próprio utilizador e exige `owner_id = auth.uid()`. A função não aceita número processual, tribunal, URL, DSL Elasticsearch, paginação ou campos de projeção do navegador. O número e o tribunal são obtidos do processo da própria conta.

O número é validado como 20 algarismos depois de removidos apenas pontos, hífens e espaços. Esse formato corresponde ao exemplo oficial do CNJ, que pesquisa `numeroProcesso` sem formatação. O tribunal é convertido por uma lista fechada de aliases suportados. O endpoint é construído internamente em `https://api-publica.datajud.cnj.jus.br/{alias}/_search`; a pesquisa pede um único resultado e uma projeção curta. O campo `numeroProcesso` é solicitado apenas para confirmar que o resultado corresponde exatamente ao processo consultado; não é devolvido ao navegador. O cliente nunca chama a API DataJud diretamente.

A Edge Function usa `DATAJUD_API_KEY` como segredo de servidor e autentica a chamada externa por `Authorization: APIKey ...`. A chave pública disponibilizada pelo CNJ pode ser alterada, pelo que não foi incluída no repositório nem no bundle do navegador. As origens web são limitadas a `DATAJUD_ALLOWED_ORIGINS` ou aos domínios de desenvolvimento e produção configurados no código.

## Limites e privacidade

A migration cria o RPC `consume_datajud_request`, com contadores distribuídos no banco: até 90 consultas por minuto no total e 5 por utilizador. A função falha fechada se o RPC não estiver disponível. O contador global mantém margem abaixo do teto de 120 requisições por minuto previsto no Termo de Uso. Não há retry automático. Há timeout de 8 segundos, limite de resposta de 128 KiB e tratamento de erros sem devolver cabeçalhos nem corpo bruto do CNJ.

Os contadores usam janelas fixas alinhadas ao minuto UTC; não equivalem a um limite móvel estrito para cada intervalo de 60 segundos. Na virada do minuto, chamadas permitidas em duas janelas consecutivas podem produzir uma rajada breve maior. Para uso académico de baixo volume, manter a consulta manual e monitorizar; antes de ampliar o uso, substituir por uma janela móvel ou token bucket.

A resposta inclui somente `classe`, `dataAjuizamento` e `grau`, e apenas quando o registo indica `nivelSigilo = 0` e o número CNJ devolvido corresponde ao número do processo consultado. O número é verificado internamente, mas omitido da resposta ao navegador; também são omitidos nomes e documentos das partes, movimentações e o restante `_source`. A resposta é transitória, não é persistida e os dados de entrada ou resposta não são escritos em logs. Ao iniciar uma consulta, a interface informa que o número do processo será enviado ao CNJ/DataJud.

O Termo de Uso proíbe recolher informações pessoais de terceiros, restringe exploração comercial e limita o consumo a 120 requisições por minuto, salvo autorização escrita do CNJ. O CNJ também pode alterar a chave ou limitar o acesso. Consultar apenas metadados minimizados não elimina o risco de que a própria pesquisa por número se relacione com uma pessoa. Antes de ativar a função, confirmar com a orientação académica e, se aplicável, com o CNJ que a consulta pontual de processos já pertencentes à conta está adequada ao uso permitido. O carácter académico e não comercial do projeto não elimina essas obrigações.

## Pendências antes da primeira consulta real

1. Publicar a versão mais recente da Edge Function, incluindo a verificação de igualdade do número CNJ retornado, com `verify_jwt` ativo.
2. Concluir o rebuild Production da Vercel para que `VITE_DATAJUD_ENABLED=true` chegue à interface.
3. Rever a finalidade com a orientação académica e confirmar a interpretação do Termo de Uso e da LGPD antes de enviar um identificador processual real ao CNJ.
4. Só então validar, com sessão autenticada, um processo que pertença à própria conta. A resposta deve ser transitória e não alterar o registo local.

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
