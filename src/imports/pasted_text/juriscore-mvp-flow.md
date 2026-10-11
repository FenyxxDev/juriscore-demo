Reformule o projeto anterior do **JurisCore** mantendo a identidade visual, paleta, tipografia e componentes já definidos, mas agora reorganize a experiência para representar claramente o **fluxo principal completo do MVP** e faça a **IA ser uma camada transversal presente em todas as telas**.

Não crie apenas telas isoladas. O resultado precisa parecer um **sistema web funcional e navegável**, no qual o usuário consegue executar o fluxo completo de trabalho jurídico.

# 1. CONCEITO CENTRAL DO JURISCORE

O JurisCore é um sistema de gestão jurídica para advogados e pequenos escritórios.

North Star:

**“Um advogado consegue abrir o JurisCore e entender rapidamente o que está acontecendo com seus processos e o que precisa fazer em seguida?”**

O sistema deve centralizar:

* clientes;
* processos;
* responsáveis;
* partes;
* documentos;
* movimentações;
* timeline;
* prazos;
* audiências;
* tarefas;
* pesquisa;
* indicadores.

A interface deve priorizar:

**contexto → próxima ação → acompanhamento → atualização.**

# 2. FLUXO PRINCIPAL OBRIGATÓRIO

O protótipo deve representar visualmente este fluxo:

**Login**
↓
**Dashboard**
↓
**Clientes**
↓
**Cadastrar cliente**
↓
**Criar processo**
↓
**Atribuir responsável**
↓
**Adicionar partes**
↓
**Adicionar documentos**
↓
**Adicionar movimentação**
↓
**Cadastrar prazo**
↓
**Cadastrar audiência**
↓
**Acompanhar processo**
↓
**Atualizar processo**
↓
**Encerrar ou arquivar processo**
↓
**Dashboard atualizado**

Não tratar essas etapas como telas independentes sem conexão.

O usuário deve conseguir navegar entre elas por botões, links, breadcrumbs, tabs, modais ou drawers.

# 3. DEFINIÇÃO DE PRONTO DO MVP

O protótipo deve demonstrar este cenário completo:

1. Administrador entra no sistema.
2. Administrador cadastra um advogado.
3. Administrador cadastra um cliente.
4. Administrador cria um processo para o cliente.
5. Administrador atribui um advogado responsável.
6. Adiciona partes envolvidas.
7. Adiciona documento.
8. Registra movimentação.
9. Cadastra prazo.
10. Cadastra audiência.
11. Advogado acessa o processo.
12. Advogado visualiza resumo e timeline.
13. Advogado visualiza próximos prazos.
14. Advogado pesquisa informações.
15. Advogado atualiza o processo.
16. Processo pode ser encerrado ou arquivado.
17. Dashboard reflete as alterações feitas.

A experiência deve comunicar claramente que todas essas informações pertencem ao mesmo processo.

# 4. ARQUITETURA DE INFORMAÇÃO

Manter uma navegação lateral global:

**JurisCore**

* Dashboard
* Clientes
* Processos
* Agenda
* Documentos
* Pesquisa

Parte inferior:

* Configurações
* Perfil

Topbar:

* Busca global
* Notificações
* Usuário

Adicionar breadcrumbs nas telas internas.

Exemplo:

**Processos / João da Silva / 0001234-56.2026.8.17.0001**

# 5. IA COMO CAMADA TRANSVERSAL

A IA não deve existir apenas em uma tela específica.

Criar um **Assistente JurisCore persistente**, disponível em todas as telas privadas do sistema.

Posicionar um botão flutuante no **canto inferior direito**.

O botão deve permanecer visualmente consistente entre:

* Dashboard
* Clientes
* Processos
* Detalhes do processo
* Agenda
* Documentos
* Pesquisa

Ao clicar, abrir um **drawer/painel lateral de IA**.

O usuário deve poder fechar o painel sem perder a tela atual.

A IA deve sempre respeitar o contexto da tela.

## Exemplos

### Dashboard

A IA pode responder:

“Quais são meus prazos de hoje?”

“Quais processos precisam da minha atenção?”

“Quantas audiências tenho esta semana?”

### Clientes

A IA pode responder:

“Quais processos pertencem a este cliente?”

“Quais clientes estão sem atualização recente?”

### Processos

A IA pode responder:

“Quais processos estão aguardando ação?”

“Mostre processos com prazo nesta semana.”

### Dentro de um processo

A IA deve reconhecer automaticamente o processo aberto.

Exemplo:

**Contexto atual: Processo 0001234-56.2026.8.17.0001**

Pergunta:

“Resuma este processo.”

“Qual foi a última movimentação?”

“Qual é o próximo prazo?”

“Quais pendências existem?”

### Documentos

A IA pode:

“Resumir este documento.”

“Localizar informações neste documento.”

“Quais pontos importantes aparecem neste arquivo?”

### Pesquisa

Permitir:

“Encontre processos do cliente João relacionados a prazo.”

# 6. BOTÃO FLUTUANTE DA IA

Criar um componente reutilizável:

**Assistente JurisCore**

Posição:

**canto inferior direito**

Estado fechado:

Ícone + pequeno botão circular/rounded com aparência discreta.

Estado aberto:

Drawer lateral com:

**Assistente JurisCore**

Mensagem inicial contextual:

“Olá! Como posso ajudar?”

Campo:

**“Pergunte sobre seus processos...”**

Sugestões rápidas.

Exemplos:

* Resumir este processo
* Ver pendências
* Prazos de hoje
* Última movimentação

Adicionar sempre:

**“Conteúdo gerado por IA. Confira as fontes antes de tomar decisões.”**

# 7. FLUXO DE CONVERSAÇÃO DA IA

Representar claramente:

**Entrada do us**
