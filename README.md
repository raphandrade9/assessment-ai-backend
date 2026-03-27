# Assessment AI Backend

O **Assessment AI Backend** é o motor de Node.js e Prisma responsável por operacionalizar a Plataforma de Governança e Maturidade Integrada (Launchpad).
Ele gerencia Tenants (Empresas), Aplicações de Negócio, Autenticação, Versionamento de Avaliações e Diagnósticos de Maturidade (Assessments).

## Principais Funcionalidades Adicionadas Recentemente
- **Role-Based Access Control (RBAC):** Proteção rigorosa das rotas transacionais. Apenas administradores e donos (Admin/Owner) podem alterar instâncias globais ou editar avaliações passadas.
- **Assessment Versioning (Clonagem Histórica):** Capacidade integralizada de criar "Novas Versões" de um Assessment, versionando de 1 a N de forma segura na Base de Dados Postgres.
- **Definitive Lock (`is_locked`):** Trancas de segurança sistêmicas para proteger Assessments concluídos de sobreeescrita por auditores ou editores comuns.
- **API de Diagnóstico Interativo (`/metrics`):** Exportação direta das arrays combinadas de Múltiplas Versões da Aplicação, para renderização Frontend em Gráficos do tipo Radar (Comparação Histórica Ativa vs Carga Passada).

## Stack
- Node.js & TypeScript
- Express
- Prisma ORM (PostgreSQL)
- Firebase Admin (Token Verification)
