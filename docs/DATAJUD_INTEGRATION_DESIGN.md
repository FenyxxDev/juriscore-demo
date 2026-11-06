# Desenho proposto: consulta académica ao DataJud

## Âmbito

O Juriscore Demo é um projeto académico, sem comercialização. O CNJ descreve a API Pública DataJud como fonte de metadados processuais e indica expressamente pesquisa académica e desenvolvimento de aplicações de acesso à informação jurídica como usos possíveis, sempre sujeitos ao Termo de Uso. Isso não constitui autorização para vender, redistribuir comercialmente ou recolher dados pessoais através da API. [1] [2]

Este documento propõe uma consulta pontual a partir de um processo que já pertence à conta autenticada. Não implementa a integração, não faz chamadas ao DataJud e não autoriza alterações ao Supabase de produção.

## Arquitetura

A futura integração deve ser uma Supabase Edge Function autenticada, por exemplo `datajud-consulta`, chamada pelo cliente com o JWT Supabase. A função valida o JWT no servidor, obtém `auth.uid()` e confirma que o processo solicitado existe em `public.processes` com `owner_id` igual ao utilizador autenticado. O browser nunca chama o DataJud diretamente.

O cliente deve enviar apenas o identificador interno do processo e um alias de tribunal escolhido de uma lista permitida. A função resolve o número processual no registo pertencente à conta e constrói internamente o endpoint HTTPS `https://api-publica.datajud.cnj.jus.br/{alias}/_search`. Não aceitar URL, alias arbitrário, DSL Elasticsearch, filtros livres, tamanho de página ou campos de projeção fornecidos pelo browser. A documentação oficial identifica a base e os endpoints por alias de tribunal. [3]

A chave pública vigente é publicada pelo CNJ e pode ser alterada. A função deve obtê-la de um secret server-side, nunca de `VITE_*`, do JavaScript do navegador, do repositório ou de logs. A autenticação upstream usa o cabeçalho `Authorization: APIKey ...`. Mesmo sendo uma chave publicamente divulgada, mantê-la no servidor centraliza a rotação e reduz abuso direto da integração. [2]

## Dados, privacidade e resposta

A resposta deve ser transitória e minimizada. Não guardar a resposta bruta, nomes de partes, CPF/CNPJ, endereços, texto livre de movimentações ou qualquer outro dado que identifique partes. Não devolver esses campos ao navegador. A função deve selecionar uma lista curta de metadados não identificadores, validar cada campo e descartar o restante antes de formar a resposta. Se não for possível garantir que um campo não contém dados pessoais, omiti-lo.

O número processual também pode estar ligado a uma pessoa identificável. Por isso, a chamada deve limitar-se a processos já cadastrados pelo próprio utilizador, não permitir pesquisas em massa e não persistir o número ou a resposta em logs. Antes de implementar, confirmar com a orientação académica e com o CNJ que o fluxo concreto respeita as cláusulas sobre dados pessoais e a LGPD; a condição de projeto não comercial, por si só, não elimina essas obrigações. [4]

## Limites e disponibilidade

O Termo de Uso versão 1.2 limita o utilizador a 120 requisições por minuto, salvo autorização expressa por escrito do CNJ. Implementar um limitador global distribuído com margem conservadora abaixo desse teto, além de limites por utilizador, e rejeitar pedidos quando o orçamento estiver esgotado. Não depender apenas de um limitador em memória de uma instância, pois várias instâncias poderiam ultrapassar o limite em conjunto. [4]

Usar timeout curto, limite de tamanho da resposta, validação do código HTTP e tratamento explícito de 429 e indisponibilidade. Não fazer retries ilimitados; se houver retry, deve ser único, com espera e dentro do orçamento global. Erros devolvidos ao browser devem ser genéricos e não conter cabeçalhos, corpos ou detalhes internos do CNJ. Não prometer atualização em tempo real ou disponibilidade garantida.

## Divulgação e critérios antes de ativar

O Termo de Uso prevê dar ciência ao CNJ de informação, estudo ou documento disponibilizado ao público em geral. Antes de publicar uma instância acessível publicamente ou divulgar resultados derivados, confirmar o procedimento aplicável e realizar a comunicação exigida. Não redistribuir a API nem comercializar dados derivados. [4]

A implementação só deve avançar depois de confirmar o uso académico concreto, os campos permitidos, a estratégia de limitação global e a comunicação ao CNJ quando aplicável. Os testes devem usar respostas simuladas, sem consultar dados reais de partes. A função deve ficar desligada até os secrets e limites serem configurados e revistos.

## Referências

[1]: https://www.cnj.jus.br/sistemas/datajud/api-publica/ "API Pública DataJud do CNJ"
[2]: https://datajud-wiki.cnj.jus.br/api-publica/acesso/ "Acesso à API Pública DataJud"
[3]: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/ "Endpoints da API Pública DataJud"
[4]: https://formularios.cnj.jus.br/wp-content/uploads/2023/11/Termos-de-uso-api-publica-V1.2.pdf "Termos de uso da API Pública DataJud versão 1.2"
