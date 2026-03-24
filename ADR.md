# 🧠 Log de Decisões Arquiteturais e Memória (ADR) - AI-Agentic-SaaS

> **Aviso Crítico ao Agente de IA:** A sua janela de contexto de Chat é volátil e sujeita à amnésia em turnos de conversação estendidos. Este documento atua como a memória persistente do projeto, registrando o histórico e o "porquê" por trás de decisões tecnológicas restritivas do passado. **É estritamente proibido reverter, ignorar ou invalidar com código novo uma decisão documentada aqui.** Sempre que uma decisão crítica de design, refatoração ou adoção de *bypass* lógico for estipulada durante o desenvolvimento, VOCÊ DEVE imediatamente adicionar um log resumido no topo deste arquivo.

## 🧭 Resumo do Progresso Atual
O status de alto nível consolidado da API e do ecossistema front/back (Última atualização: Março de 2026).
- **Fase 1 (Frontend SPA):** Concluído. Mocks visuais estáticos deletados; Zustand operando no gerenciamento global de estado.
- **Fase 2 (Backend REST & Firebase Layer 1):** Concluído. Integração GCP/BigQuery estabelecida e blindada usando Service Accounts IAM nativas.
- **Fase 3 (Orquestração Traseira Híbrida):** *[Em andamento]* - Focando na separação matemática da validação de Array do Checkout, despachando lotes Online de lotes retidos de Ticketing Offline.

---

## 🔄 Estado Anterior vs. Atualizações de Hoje
**Como a aplicação era antes:** A API de Aplicações (`ApplicationController`) abstraía agressivamente metadados nativos de temporalidade (ocultava as datas essenciais de criação/atualização aos clientes web) e faltavam rotas granulares de Drill-Down que pudessem suportar nós vazios/nulos num nível 3 da UI de gráficos. Adicionalmente, dados de referência essenciais como `Operational Status` residiam modelados no Prima, porém inacessíveis via REST ou via injeção populacional resiliente.

**Atualizações da Arquitetura e Estrutura de Hoje:**
- Foi quebrado a opacidade dos DTOs, forçando o envio nativo dos logs de auditoria de banco para as respostas JSON sem sobrecarga de selects SQL extra.
- Introduziu-se estratégia de *fallback string* (`'unassigned'`) segura contra falhas de Express Router paramétricos para nós nulos hierárquicos.
- O Seed de banco de dados foi formalizado protegendo inserções com a mecânica robusta e indempotente de Upsert.

---

## 🏛️ Registro de Histórico e Decisões Arquiteturais (ADRs)

### 🔖 ADR 006: Injeção Direta de Rastreabilidade Temporal nos DTOs
* **Data:** 2026-03-24
* **Contexto:** Precisávamos adicionar visibilidade de rastreabilidade temporal (Auditoria) nas tabelas e abas de visão geral da Aplicação no Frontend (Launchpad).
* **Decisão:** Optou-se por **NÃO criar novos campos computados no banco** nem fazer selects customizados complexos, mas sim modificar o DTO / Map na beirada final do fluxo REST (no Controller) para expor de forma nativa e proativa as chaves preexistentes do Prisma: `created_at`, `updated_at`, e extraindo/mapeando `finished_at` relacional sob a chave semântica `completed_at` dentro do Assessment Join. Retornando os dados no padrão ISO Date String.
* **Status:** 🟢 Implementado

### 🔖 ADR 005: Rota REST Hierárquica com Fallback 'unassigned' (Maturity Chart Level 3)
* **Data:** 2026-03-24
* **Contexto:** O Frontend precisava alimentar o Gráfico de Maturidade e navegar no Nível 3 (Listagem de aplicações específicas de uma Área e Sub-área) requisitando a métrica de `avg_score` ordenada decrescentemente. O maior gargalo estrutural é que aplicações podiam ser orfãs (Área = Null / Sub-Área = Null), quebrando URLs puras (`/areas/null/sub-areas/null`).
* **Decisão:** A adoção da *Keyword literal* `unassigned` mapeada dinamicamente no Backend para `id = null` se consolidou como padrão forte de API rest. A ordenação decrescente e ponderada é calculada In-Memory através de `.map` e `.sort` no node process imediatamente após a query, garantindo que o front-end absorva o array JSON 100% limpo, estruturado, e sem esforço computacional visual.
* **Status:** 🟢 Implementado

### 🔖 ADR 004: Tolerância a Múltiplos Deploys (Idempotência via Upsert no DB Seed)
* **Data:** 2026-03-24
* **Contexto:** O mapeamento do Ciclo de Vida real de aplicações exigiu criar o `OperationalStatus` ("Em construção", "Em produção", etc). Popular via insert nativo do SQL geraria erro de duplicação de chave (colisões) caso o CI/CD (Pipeline/Deploy) corresse múltiplas vezes as migrações/scripts na inicialização dos containers.
* **Decisão:** Adoção inegociável do ciclo lógico Iterativo `prisma.model.upsert()`. Scripts de população estática (Seed) agora devem ser blindados, onde a base atua fazendo um merge/update em cima do ID real caso ele já exista, preservando a imutabilidade do ambiente híbrido.
* **Status:** 🟢 Implementado

### 🔖 ADR 003: Adoção Exclusiva do BigQuery como Data Warehouse
* **Data:** 2026-03-20
* **Contexto:** A infraestrutura amadora legada utilizava o Google Sheets atuando travestidamente de banco de dados interativo. A concorrência esporádica e o limite frágil da API de Sheets geravam perda furtiva de transações e pesados *timeouts* concorrentes.
* **Decisão:** Extinguimos a leitura/escrita cruzada em arquivos Google Sheets. As validações fiscais cruzadas e puras inserções efêmeras póstumas (Audit Log do Upsell) passam a gravar unicamente através de *queries SQL Paramétricas* do Node canalizadas à tabela `upsell_transaction_logs` do BigQuery.
* **Status:** 🔴 Irreversível.

### 🔖 ADR 002: Bypass do Faturamento Oficial da Nuvem (Simulador QA Dry-Run)
* **Data:** 2026-03-11
* **Contexto:** A automação e as equipes de Engenharia QA necessitavam testar o formulário Rateado de Checkout do Front-End massivamente. Faturar pedidos validados diretamente na API Parceira Oficial de Revenda do Google imporia absurdos e fúteis gastos em dólares no escopo diário de testes CI/CD da Inguz.
* **Decisão:** Desenvolvemos na raiz o uso da Boolean Flag técnica `DRY_RUN` imbuída nas variáveis do `.env` do Backend. Sendo *true*, o interceptador núcleo de repasse do `resellerService.ts` forja na borda final o Sucesso Transacional gerando Log local JSON OK, cortando e bloqueando ativamente a expedição de Request Real para a API de faturamento B2B Oficial.
* **Status:** 🟢 Ativo para Ambiente QA e Desenvolvedores.
