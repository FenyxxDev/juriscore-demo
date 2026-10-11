Crie a base visual e funcional de um sistema web chamado **JurisCore**, uma plataforma de gestão jurídica para advogados e pequenos escritórios no Brasil.

O objetivo do produto é permitir que o advogado abra o sistema e entenda rapidamente **o que está acontecendo com seus processos e o que precisa fazer em seguida**.

## DIREÇÃO VISUAL

Crie uma interface:

* profissional, moderna, limpa e sofisticada;
* inspirada em softwares jurídicos, mas sem copiar nenhuma marca;
* com aparência de sistema SaaS B2B;
* priorizando leitura rápida, organização e baixa poluição visual;
* adequada para desktop e tablet;
* com bastante espaço em branco e hierarquia visual clara.

### Paleta

* Azul principal: #1F4B66
* Azul escuro: #0F172A
* Teal para ações/destaques: #0F766E
* Fundo: #F8FAFC
* Branco: #FFFFFF
* Borda: #E2E8F0
* Texto principal: #0F172A
* Texto secundário: #475569
* Informação: #1D4ED8
* Sucesso: #166534
* Atenção: #B45309
* Erro/atrasado: #B91C1C

Não usar cores apenas para transmitir informações: combinar cor com texto, ícone ou indicador.

### Tipografia

Use **Inter**.

* H1: 28–32 px
* H2: 22–24 px
* H3: 18–20 px
* Corpo: 14–16 px
* Texto auxiliar: 12–13 px

Use espaçamento baseado em múltiplos de 4/8 px, bordas discretas, sombras suaves e cantos levemente arredondados.

## ESTRUTURA GLOBAL

Criar um layout principal reutilizável com:

### Sidebar esquerda

Logo/nome **JurisCore**

Itens:

* Dashboard
* Clientes
* Processos
* Agenda
* Documentos
* Pesquisa

Na parte inferior:

* Configurações
* Perfil do usuário

### Topbar

* busca global: “Buscar processos, clientes, documentos...”
* indicador de notificações
* avatar/nome do usuário

A sidebar deve permanecer consistente em todas as telas internas.

## COMPONENTES REUTILIZÁVEIS

Criar componentes que possam ser reutilizados pelas outras telas:

* botões primário, secundário e discreto;
* campos de entrada;
* campo de busca;
* select;
* filtros;
* badges de status;
* cards;
* tabela;
* tabs;
* alertas;
* toast;
* modal;
* breadcrumb;
* paginação;
* avatar;
* timeline;
* componente de prazo;
* botão de ação;
* estados de loading, vazio e erro.

Criar também estados de:

* default;
* hover;
* focus;
* disabled;
* loading;
* sucesso;
* erro.

## TELAS-BASE

Criar somente estas telas principais, pois outras pessoas da equipe irão desenvolver as demais a partir destes componentes.

### 1. LOGIN

Tela simples e elegante.

Conteúdo:

* logo JurisCore;
* título “Acesse sua conta”;
* campo e-mail;
* campo senha;
* checkbox “Lembrar de mim”;
* botão “Entrar”;
* link “Esqueci minha senha”.

Criar estados:

* normal;
* erro de credenciais;
* loading;
* campo inválido.

Mensagem de erro clara e próxima ao campo correspondente.

---

### 2. DASHBOARD

Esta deve ser uma das telas principais do projeto.

Título:
**Bom dia, [Nome]**

Subtítulo:
**Veja o que precisa da sua atenção hoje.**

Criar cards:

* Processos ativos
* Prazos hoje
* Prazos atrasados
* Audiências da semana

Abaixo:

### “Prioridades de hoje”

Tabela/lista com:

* processo;
* cliente;
* atividade;
* prazo;
* responsável;
* status.

Exemplo:

“Manifestação — Processo 0001234-56 — Hoje”

Criar também:

### “Processos recentes”

Tabela com:

* número;
* cliente;
* área jurídica;
* responsável;
* status;
* última atualização.

Mostrar visualmente que o dashboard responde às perguntas:

* O que está acontecendo?
* O que é urgente?
* O que preciso fazer?

Não exagerar em gráficos. A prioridade é informação operacional.

---

### 3. CLIENTES

Criar tela de gerenciamento de clientes.

Cabeçalho:
**Clientes**
Botão principal:
**+ Novo cliente**

Busca:
“Buscar por nome, CPF/CNPJ...”

Filtros:

* Pessoa Física/Jurídica
* Com processos
* Sem processos

Tabela:

* Nome
* Tipo
* Quantidade de processos
* Última atualização
* Status

Adicionar paginação.

Criar estado vazio:
“Você ainda não possui clientes cadastrados.”

Botão:
“Cadastrar primeiro cliente”

---

### 4. PROCESSOS

Esta tela é uma das principais do produto.

Cabeçalho:
**Processos**
Botão:
**+ Novo processo**

Campo de busca:
“Buscar por número, cliente ou parte...”

Filtros combináveis:

* Status
* Cliente
* Responsável
* Área jurídica
* Tribunal
* Período

Tabela:

Número do processo
Cliente
Responsável
Área
Status
Próximo prazo
Última atualização

Usar badges discretos para:

* Em andamento
* Atenção
* Aguardando ação
* Encerrado

Criar interação de clique na linha para abrir o detalhe do processo.

---

### 5. DETALHE DO PROCESSO

Esta deve ser a **tela central do JurisCore** e a principal referência para as outras telas.

No topo:

Breadcrumb:
Processos / 0001234-56.2026.8.17.0001

Título:
**0001234-56.2026.8.17.0001**

Informações:

* Cliente
* Responsável
* Status
* Área jurídica
* Tribunal
* Comarca
* Vara

Botões:

* Editar processo
* Adicionar movimentação
* Adicionar prazo

Criar abas:

**Resumo | Timeline | Partes | Documentos | Prazos | Audiências**

Na aba Resumo:

### Card “Situação atual”

Mostrar:

* status atual;
* última movimentação;
* próxima ação;
* próximo prazo.

### Card “Próximo prazo”

Mostrar:

* descrição;
* data;
* responsável;
* prioridade;
* indicador de situação.

### Card “Última movimentação”

Mostrar:

* data;
* tipo;
* descrição curta;
* autor.

### Card “Resumo do processo”

Área de texto organizada com informações principais.

### Área de IA contextual

Criar um card chamado:

**Assistente JurisCore**

Texto:
“Posso ajudar você a entender este processo.”

Botões:

* “Resumir processo”
* “Ver pendências”
* “Qual foi a última decisão?”
* “O que preciso fazer?”

Campo:
“Faça uma pergunta sobre este processo...”

Adicionar pequeno aviso:

“Conteúdo gerado por IA. Confira as fontes antes de tomar decisões.”

A área de IA deve parecer integrada ao processo, não uma ferramenta separada.

---

## PROTÓTIPO / NAVEGAÇÃO

Criar protótipo navegável entre as telas:

Login → Dashboard

Dashboard → Clientes

Dashboard → Processos

Processos → Detalhe do Processo

Clientes → Detalhe do Cliente, caso seja criado posteriormente pela equipe

Na tela de processo:

* clique em “Timeline” altera a aba;
* clique em “Documentos” altera a aba;
* clique em “Prazos” altera a aba;
* clique em “Audiências” altera a aba;
* botões de ação abrem modais ou drawers.

A navegação deve ser preparada para que outras telas sejam adicionadas pela equipe sem alterar o design principal.

## ACESSIBILIDADE

Projetar seguindo WCAG 2.2 AA como referência.

Garantir:

* contraste adequado;
* foco de teclado visível;
* labels explícitos;
* mensagens de erro compreensíveis;
* não depender somente de cor;
* áreas de interação confortáveis;
* hierarquia correta de títulos;
* textos alternativos para elementos visuais relevantes.

## RESPONSIVIDADE

Criar versão desktop como principal e prever adaptação para tablet.

No tablet:

* sidebar pode ser reduzida;
* tabelas podem permitir rolagem horizontal;
* filtros podem ficar recolhidos;
* cards devem reorganizar verticalmente.

## ESTILO GERAL

O resultado deve transmitir:

**confiança + organização + segurança + clareza + tecnologia**

Evitar:

* excesso de azul;
* excesso de sombras;
* aparência de banco;
* visual muito tradicional de escritório jurídico;
* excesso de gráficos;
* excesso de elementos decorativos.

O foco deve ser produtividade e compreensão rápida da situação dos processos.

Crie os componentes de forma organizada no Figma, usando **Auto Layout, componentes reutilizáveis, variantes e estilos/tokens**, para que outras pessoas da equipe possam duplicar a estrutura e criar as telas de Agenda, Documentos, Pesquisa e Assistente de IA mantendo o mesmo padrão visual.
