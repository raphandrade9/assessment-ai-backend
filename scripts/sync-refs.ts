
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Syncing Reference Tables ---');

    // 1. Archetypes (Already mostly correct, just ensuring)
    const archetypes = [
        { id: 1, label: "Prompt Commander (Power User IA)" },
        { id: 2, label: "Citizen Developer (Low-Code)" },
        { id: 3, label: "Engenheiro de Automação (Dev/Pro-Code)" },
        { id: 4, label: "Arquiteto de Processos (Analista)" },
        { id: 5, label: "Curador de Dados (Data Steward)" },
        { id: 6, label: "Business Owner (Dono da Dor)" },
        { id: 7, label: "Conector (Evangelista)" },
        { id: 8, label: "Curioso/Iniciante" }
    ];
    for (const a of archetypes) {
        await prisma.ref_archetypes.upsert({
            where: { id: a.id },
            update: { label: a.label },
            create: { id: a.id, label: a.label }
        });
    }

    // 2. Risk Status
    const riskStatus = [
        { id: 1, label: "✅ Controlado (Compliance OK)" },
        { id: 2, label: "⚠️ Atenção (Monitorar)" },
        { id: 3, label: "⛔ Alto Risco (Shadow IT)" },
        { id: 4, label: "🔒 Violação (Bloquear Imediato)" },
        { id: 5, label: "❓ Não Avaliado" }
    ];
    for (const r of riskStatus) {
        await prisma.ref_risk_status.upsert({
            where: { id: r.id },
            update: { label: r.label },
            create: { id: r.id, label: r.label }
        });
    }

    // 3. Business Criticality
    const criticality = [
        { id: 1, label: "Crítica (S0 - Para a operação/faturamento)" },
        { id: 2, label: "Alta (Impacta cliente final/SLA)" },
        { id: 3, label: "Média (Impacta produtividade interna)" },
        { id: 4, label: "Baixa (Cosmético/Nice-to-have)" },
        { id: 5, label: "Desconhecida" }
    ];
    for (const c of criticality) {
        await prisma.ref_business_criticality.upsert({
            where: { id: c.id },
            update: { label: c.label },
            create: { id: c.id, label: c.label }
        });
    }

    // 4. Sensitivity Levels
    const sensitivity = [
        { id: 1, label: "Não (Dados Públicos/Gerais)" },
        { id: 2, label: "Sim - PII (Dados Pessoais/LGPD)" },
        { id: 3, label: "Sim - Financeiro/Bancário" },
        { id: 4, label: "Sim - Estratégico (Segredo Industrial)" },
        { id: 5, label: "Sim - Senhas/Credenciais" }
    ];
    for (const s of sensitivity) {
        await prisma.ref_sensitivity_levels.upsert({
            where: { id: s.id },
            update: { label: s.label },
            create: { id: s.id, label: s.label }
        });
    }

    // 5. Operational Status
    const operational = [
        { id: 1, label: "Em Produção" },
        { id: 2, label: "Em Piloto / POC" },
        { id: 3, label: "Em Desenvolvimento" },
        { id: 4, label: "Em Manutenção (Parado)" },
        { id: 5, label: "Bloqueado" },
        { id: 6, label: "Descomissionado (Morto)" }
    ];
    for (const o of operational) {
        await prisma.ref_operational_status.upsert({
            where: { id: o.id },
            update: { label: o.label },
            create: { id: o.id, label: o.label }
        });
    }

    console.log('Reference tables synced successfully!');
}

main().finally(() => prisma.$disconnect());
