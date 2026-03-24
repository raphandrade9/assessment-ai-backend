# 📝 Product Requirements Document (PRD) - Assessment AI Backend

## 1. Descrição do Produto
O **Assessment AI Backend** é o pilar de processamento de dados para o ecossistema de governança, maturidade e auditoria de TI da plataforma (SaaS). Ele é responsável por gerenciar e relacionar empresas, pessoas, aplicações tecnológicas, áreas de negócio e aplicar, contabilizar e cruzar de forma estruturada as respostas e notas das "Avaliações" (Assessments) realizadas contra cada ativo tecnológico, consolidando métricas visuais avançadas para Data Visualization.

## 2. Objetivos Principais
- Fornecer APIs robustas e performáticas (REST/JSON) para o front de "Launchpad" e Painéis Administrativos.
- Manter Rastreabilidade e Auditoria nativa de Criação e Atualização (Timestamps) em todos os níveis vitais das interações.
- Sustentar níveis avançados de relatórios estatísticos (Maturity Charts, Drill-downs).
- Escabilidade Multi-Tenant em banco Postgres através do ORM (Prisma), amparada por Identidade Centralizada.

## 3. Topologia Técnica
- **Stack:** Node.js, Express, TypeScript, Prisma (PostgreSQL).
- **Lógica e Identity:** Firebase Admin (Firebase JWT Bearer Auth Verification `requireAuth`).
- **Authorization:** RBAC via tabelas nativas (`user_company_access` e `tenant_users` definindo `OWNER`, `ADMIN`, etc).
- **Tratamento de Exceções e Resiliência:** Validação de payload em Controller, com isolamento modular (Routes → Controllers → [Utils/Services]).

---

## 4. Estruturas Chave e Modelos Fundamentais (Mapeamento de Domínio)

### 4.1. Companies & Tenants
Toda a plataforma gira em torno de Tenants/Companies. `companies` é a entidade primária a que todos os demais agrupamentos pertencem. Os dados retornados protegem escopos de outras empresas ativando middlewares de validação cruzada do Prisma (`user_company_access`).

### 4.2. Applications (Ativos) e Rastreabilidade Temporal
Representa os ativos de software gerenciados.  
- **Metadados Temporais Expostos via API:** `created_at` (Cadastro) e `updated_at` (Última Edição).  
- Possui relações fortes como: Owner de Negócio, Owner Técnico, Sensibilidade de Dados, Status de Risco.
- Rotas essenciais: `/api/applications` (Listagem) e `/api/applications/:id` (Get By Id).

### 4.3. Business Areas e Sub-Areas
O agrupamento lógico dos ativos dentro das estruturas departamentais do cliente.
- Mecanismo vital implementado para suportar "Órfãos": A utilização nativa de identificadores (fallback string) `'unassigned'` ao navegar nas árvores de filtro via REST.

### 4.4. Rotas Multi-níveis de Métricas (Gráfico de Maturidade)
Para atender às rigorosas exigências do front de visualização em painéis interativos:
- **Nível 1:** Visão por Área (`/metrics/areas`)
- **Nível 2:** Visão por Sub-Area (`/metrics/areas/:areaId/sub-areas`)
- **Nível 3 (Drill-Down Fino):** Visão direta da Aplicação cruzada com seu score resultante (`/metrics/areas/:areaId/sub-areas/:subAreaId/applications`) com array já ordenado de forma decrescente pela coluna calculada `avg_score` e possuindo injeção do id vital de roteamento.

### 4.5. Referências e Lifecycle (Operational Status)
Rotas de dados auxiliares (`/api/references/...`) fornecem dicionários dinâmicos de dados para preenchimento de formulários UI (Pickers, Selects, Dropdowns).
Destaque para a Gestão do Ciclo de Vida real (`operational_status`) povoado nativamente na inicialização via Banco de Dados (Seed upsert resiliente), filtrando no endpoint aqueles valores inativos.

### 4.6. Assessments (Avaliações Computadas)
Avaliações lançadas para as Aplicações e respondidas por Indivíduos. O backend cuida de interações como Init, Save Answers e Finalize. Todo assessment carrega status e pontuações calculadas localmente antes do Dispatch.
- Em relacionamentos aninhados expostos na requisição, ele insere ativamente o valor `completed_at` originado das triggers de `finished_at`.

---

## 5. Diretrizes do Frontend - Contrato
Todas as datas são manipuladas e entregues em estrito formato nativo **ISO Date String** do Postgres para facilitar parse (ex: `Date.parse()` ou `date-fns` ou Luxon) pelos clientes.  
Toda a arquitetura é blindada por um middleware `requireAuth` globalmente nas rotas chaves, o que denota uso compulsório do Firebase JWT no cabeçalho Authorization da parte solicitante.
