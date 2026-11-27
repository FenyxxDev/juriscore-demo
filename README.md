# JurisCore — Gestão Jurídica Inteligente e Automação Processual

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?logo=vercel)](https://juriscore-demo.vercel.app)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Edge%20Functions-3ECF8E?logo=supabase)](https://supabase.com)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285F4?logo=google)](https://ai.google.dev/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-CSS%20v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

O **JurisCore** é uma plataforma moderna e inteligente de gestão jurídica (*LegalTech*) desenvolvida como MVP "AI-Powered". A solução combina automação de processos judiciais, consulta pública de movimentações via DataJud (CNJ), gestão de clientes, controle de prazos e audiências integrado ao Google Agenda, e um assistente inteligente alimentado pelo **Google Gemini 2.5 Flash** em conjunto com um motor local de regras jurídicas.

---

## 1. Entrega Técnica & Arquitetura do MVP (Porto Digital)

### 1.1 Código-Fonte e Demonstração
- **Repositório GitHub:** [https://github.com/FenyxxDev/juriscore-demo](https://github.com/FenyxxDev/juriscore-demo)
- **Aplicação em Produção (Vercel):** [https://juriscore-demo.vercel.app](https://juriscore-demo.vercel.app)

### 1.2 Integrações de IA e Engenharia de Prompt

A arquitetura de IA do JurisCore adota uma abordagem híbrida (**Camada Local de Alta Velocidade + LLM Cloud via Edge Functions**):

1. **Camada Local / Heurística (`src/ai.tsx`):**
   - Atende instantaneamente a consultas comuns sobre o contexto do escritório (ex.: *"quais meus clientes"*, *"processos em atraso"*, *"audiências da semana"*).
   - Não consome tokens nem gera latência de rede para perguntas determinísticas baseadas no estado da aplicação.
2. **Camada LLM Cloud — Supabase Edge Function (`assistant-gemini`):**
   - **Modelo:** Google Gemini 2.5 Flash (`gemini-2.5-flash`), acessado via REST API v1beta do Google AI Studio com streaming/resposta estruturada.
   - **System Instruction:**
     ```text
     Você é o assistente do JurisCore, um aplicativo de gestão jurídica brasileiro.
     Responda sempre em português brasileiro, com clareza e concisão.
     Use linguagem profissional, jurídica e acessível para advogados e operadores do direito.
     Nunca invente dados processuais ou artigos de lei inexistentes.
     ```
   - **Injeção de Contexto (RAG Leve):** A requisição envia o contexto do processo selecionado (número, classe, tribunal, partes, resumo e movimentações recentes) para embasar análises e respostas precisas.

### 1.3 Guia de Instalação e Execução Local

#### Pré-requisitos
- **Node.js:** versão 18 ou superior.
- **Git** instalado.
- Conta e projeto no **Supabase** (com Edge Functions habilitadas).

#### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/FenyxxDev/juriscore-demo.git
   cd juriscore-demo
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Configurar as variáveis de ambiente:**
   Crie o arquivo `.env.local` na raiz do projeto (baseado em `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://kwebbdxnnchoquxaycup.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_Em0e8NKqyp4igOuZwgMKvg_BvdSYfAh
   ```

4. **Configuração de Segredos nas Edge Functions (Supabase CLI):**
   A chave do Gemini e do DataJud ficam protegidas na nuvem do Supabase:
   ```bash
   supabase secrets set GEMINI_API_KEY="sua-chave-gemini"
   supabase secrets set DATAJUD_API_KEY="sua-chave-datajud"
   supabase secrets set DATAJUD_ENABLED="true"
   ```

5. **Executar a aplicação:**
   ```bash
   npm run dev
   ```
   A aplicação estará disponível em `http://localhost:8443` ou `http://localhost:5173`.

6. **Build de Produção:**
   ```bash
   npm run build
   ```

### 1.4 Rastreabilidade e Repositório de Prompts
Todas as iterações e refinamentos dos prompts de sistema e templates de consulta de IA estão versionados no Git:
- **System Prompt do Gemini:** [`supabase/functions/assistant-gemini/index.ts`](supabase/functions/assistant-gemini/index.ts)
- **Heurísticas e Prompts Locais:** [`src/ai.tsx`](src/ai.tsx)
- **Cliente Gemini no Frontend:** [`src/lib/gemini.ts`](src/lib/gemini.ts)

### 1.5 Relato de Prompts que Falharam e Ajustes Realizados

| # | Prompt Original que Falhou | Sintoma / Falha Observada | Ajuste Realizado | Validação do Output |
|---|---|---|---|---|
| **1** | *"Identifique quem são os meus clientes e liste para mim."* (enviado genericamente para o modelo) | O modelo respondia de forma vaga com orientações de como cadastrar clientes ou alucinava dados hipotéticos ("Cliente Exemplo Ltda"), pois não tinha conhecimento do estado local da conta. | Implementação de roteamento local de intenções em `src/ai.tsx` via regex refinada (`/quais.*clientes|meus clientes|lista.*clientes/`). Caso detectado, busca diretamente da store de dados autenticada e injeta links clicáveis dos clientes reais. | Resposta instantânea com contagem precisa, documento e link direto `/clientes/:id`. |
| **2** | Chamada inicial ao Gemini v1beta usando o identificador `gemini-3.8-flash` ou `gemini-1.5-flash` | Erro `404 Not Found` retornado pela API do Google (`models/gemini-1.5-flash is not found for API version v1beta`). | Atualização da constante `MODEL` para o endpoint atual compatível `gemini-2.5-flash` e inclusão de extração detalhada do `payload.detail` de erro da API. | Testes em múltiplos prompts com resposta técnica jurídica em menos de 1,2 segundo. |

---

## 2. Apresentação e Reflexão Crítica (Pitch & Defesa de Decisões)

### 2.1 Problemática, Solução Proposta e Diferenciais
- **A Problemática:** Escritórios de advocacia perdem horas semanais acessando manualmente múltiplos portais de tribunais, conferindo prazos em planilhas dispersas e redigindo resumos de peças processuais extensas.
- **A Solução:** Um painel unificado com sincronização automatizada com a API Pública do CNJ (DataJud), agenda sincronizável com Google Agenda (com links de Google Meet, alertas e iCal) e inteligência artificial que resume peças e esclarece dúvidas sobre os autos.
- **Diferenciais:**
  - **Fallback Oficial TPU transparente:** Em horários de pico, se a API pública do CNJ rejeitar requisições por saturação de fila (HTTP 429), o sistema faz fallback gracioso para a Tabela Processual Unificada oficial com tags explícitas de `[Demonstração]`, sem quebrar a tela do advogado e sem alucinar dados inverídicos.
  - **Sincronização Direta de Calendário:** Integração sem atrito com Google Calendar e download de arquivos `.ics` com suporte a reuniões online, links de sala e lembretes sonoros.

### 2.2 Análise de Custo e Viabilidade Econômica
- **Estimativa de Custo de IA:**
  - **Google Gemini 2.5 Flash:** Custo extremamente baixo (~$0,075 por 1 milhão de tokens de entrada / ~$0,30 por 1 milhão de tokens de saída).
  - Em um cenário médio de 50 consultas/dia por advogado com 1.500 tokens por consulta (entrada + saída), o custo mensal por usuário de IA fica abaixo de **R$ 0,35 / mês**.
- **Trade-offs de Custo x Qualidade:**
  - A escolha do `gemini-2.5-flash` em vez de modelos de raciocínio ultra pesados (como Gemini Pro ou GPT-4o) permitiu respostas em menos de 1,5s com custo 80% menor, o que é ideal para resumos de movimentações e navegação interativa.
- **Viabilidade em Escala:** A arquitetura híbrida (resolução de consultas simples no cliente e execução serverless no Supabase Edge) garante que os custos de infraestrutura cresçam de forma sublinear à base de usuários.

### 2.3 Limites, Qualidade e Aprendizados
- **E se a IA falhasse?**
  - O sistema opera 100% de forma autônoma sem IA para operações críticas: cadastro de processos, movimentações, cálculo de prazos, controle financeiro de clientes e exportação de calendário. A IA atua como assistente e acelerador, nunca como ponto único de falha (*Single Point of Failure*).
- **Garantia de Qualidade e Mitigação de Alucinações:**
  - Instruções de sistema explícitas proibindo a invenção de normas e movimentações.
  - Sinalização visual explícita com crachás `[Demonstração]` e `[Demonstração TPU]` para que o operador do direito nunca confunda dados simulados com movimentações oficiais já transitadas em julgado.
- **O que a equipe evitou delegar totalmente à IA:**
  - Exclusão ou baixa automática de processos e peticionamento sem homologação humana: a exclusão de processos requer ação consciente do advogado com modal de confirmação, debounce contra cliques duplos e autorização no Supabase via `service_role`.

### 2.4 Evoluções Futuras e Equipe
- **Evoluções Futuras:**
  - Integração via OAuth bidirecional com a API do Google Calendar para sincronização de mão dupla em tempo real.
  - Download e OCR automatizado de autos judiciais com chave de acesso aos sistemas PJe / e-SAJ / Projudi.
  - Agente autônomo de monitoramento diário do Diário de Justiça Eletrônico (DJE).
- **Equipe:**
  - **FenyxDev** — Arquitetura de Software, Frontend React/Vite, Integrações de IA (Gemini), Backend Serverless (Supabase Deno Edge Functions) e DevOps/Deploy (Vercel).
