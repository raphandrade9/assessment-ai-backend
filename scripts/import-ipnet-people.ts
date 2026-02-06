
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

const COMPANY_ID = 'ead04834-f5c7-431c-8dfa-9a9143709b94';

// Mappings for reference tables
const archetypesMap: Record<string, number> = {
    "Prompt Commander (Power User IA)": 1,
    "Citizen Developer (Low-Code)": 2,
    "Arquiteto de Processos (Analista)": 3,
    "Engenheiro de Automação (Dev/Pro-Code)": 4,
    "Curador de Dados (Data Steward)": 5,
    "Business Owner (Dono da Dor)": 6,
    "Conector (Evangelista)": 7,
    "Curioso/Iniciante": 8
};

const techLevelsMap: Record<string, number> = {
    "1 - Nenhum (Apenas Usuário Final)": 1,
    "2 - Básico (Prompts, Excel simples)": 2,
    "3 - Intermediário (Low-code, Scripts simples)": 3,
    "4 - Avançado (Dev, APIs, Cloud)": 4,
    "5 - Expert (Arquiteto, IA Avançada)": 5
};

const bizLevelsMap: Record<string, number> = {
    "1 - Executor (Executa sem visão do todo)": 1,
    "2 - Operacional (Conhece a rotina local)": 2,
    "3 - Tático (Conhece o fluxo da área)": 3,
    "4 - Estratégico (Visão cross-área)": 4,
    "5 - Dono do Processo (Visão ponta-a-ponta)": 5
};

const rawData = [
    { name: "Raphael Andrade", area: "DT", title: "AI", archetype: "Conector (Evangelista)", tech: "4 - Avançado (Dev, APIs, Cloud)", biz: "4 - Estratégico (Visão cross-área)" },
    { name: "Brian Breder", area: "GT", title: "Head CO", archetype: "Business Owner (Dono da Dor)", tech: "2 - Básico (Prompts, Excel simples)", biz: "5 - Dono do Processo (Visão ponta-a-ponta)" },
    { name: "Caio Rocha", area: "GT", title: "Estagiário", archetype: "Citizen Developer (Low-Code)", tech: "2 - Básico (Prompts, Excel simples)", biz: "2 - Operacional (Conhece a rotina local)" },
    { name: "Glenda Rocha", area: "GT", title: "Analista de Marketing", archetype: "Arquiteto de Processos (Analista)", tech: "1 - Nenhum (Apenas Usuário Final)", biz: "2 - Operacional (Conhece a rotina local)" },
    { name: "Gabriella Melo", area: "GT", title: "Analista", archetype: "Arquiteto de Processos (Analista)", tech: "2 - Básico (Prompts, Excel simples)", biz: "3 - Tático (Conhece o fluxo da área)" },
    { name: "Gabriele Moreira", area: "GT", title: "Analista", archetype: "Arquiteto de Processos (Analista)", tech: "1 - Nenhum (Apenas Usuário Final)", biz: "3 - Tático (Conhece o fluxo da área)" },
    { name: "José Gomes", area: "GT", title: "Analista", archetype: "Citizen Developer (Low-Code)", tech: "3 - Intermediário (Low-code, Scripts simples)", biz: "2 - Operacional (Conhece a rotina local)" },
    { name: "Guilherme Fialho", area: "DT", title: "Desenvolvedor", archetype: "Engenheiro de Automação (Dev/Pro-Code)", tech: "5 - Expert (Arquiteto, IA Avançada)", biz: "3 - Tático (Conhece o fluxo da área)" },
    { name: "Italo Teixeira", area: "DT", title: "AI OPS", archetype: "Engenheiro de Automação (Dev/Pro-Code)", tech: "5 - Expert (Arquiteto, IA Avançada)", biz: "3 - Tático (Conhece o fluxo da área)" },
    { name: "Mateus Menezes", area: "DT", title: "Estagiário", archetype: "Prompt Commander (Power User IA)", tech: "3 - Intermediário (Low-code, Scripts simples)", biz: "2 - Operacional (Conhece a rotina local)" },
    { name: "Ingra Fernandes", area: "DT", title: "PMO Quality", archetype: "Business Owner (Dono da Dor)", tech: "1 - Nenhum (Apenas Usuário Final)", biz: "4 - Estratégico (Visão cross-área)" },
    { name: "Elisa Flach", area: "DT", title: "Head PMO", archetype: "Business Owner (Dono da Dor)", tech: "1 - Nenhum (Apenas Usuário Final)", biz: "4 - Estratégico (Visão cross-área)" },
    { name: "Rodrigo Vilela", area: "DT", title: "Go To Market", archetype: "Business Owner (Dono da Dor)", tech: "2 - Básico (Prompts, Excel simples)", biz: "2 - Operacional (Conhece a rotina local)" },
    { name: "Marcos Teixeira", area: "DT", title: "Dev Ops", archetype: "Engenheiro de Automação (Dev/Pro-Code)", tech: "5 - Expert (Arquiteto, IA Avançada)", biz: "4 - Estratégico (Visão cross-área)" },
    { name: "Felipe Correa", area: "GT", title: "Gerente CXR", archetype: "Business Owner (Dono da Dor)", tech: "3 - Intermediário (Low-code, Scripts simples)", biz: "5 - Dono do Processo (Visão ponta-a-ponta)" },
    { name: "Tharsya", area: "GT", title: "Coordenadora CXR", archetype: "Business Owner (Dono da Dor)", tech: "1 - Nenhum (Apenas Usuário Final)", biz: "3 - Tático (Conhece o fluxo da área)" },
    { name: "Pedro Falcão", area: "GT", title: "", archetype: "", tech: "", biz: "" }
];

async function main() {
    console.log(`Starting import for ${rawData.length} people...`);

    for (const item of rawData) {
        try {
            const data: any = {
                company_id: COMPANY_ID,
                name: item.name,
                job_title: item.title || null,
                archetype_id: archetypesMap[item.archetype] || null,
                tech_level_id: techLevelsMap[item.tech] || null,
                business_level_id: bizLevelsMap[item.biz] || null,
            };

            await prisma.people.create({ data });
            console.log(`Imported: ${item.name}`);
        } catch (error) {
            console.error(`Error importing ${item.name}:`, error);
        }
    }

    console.log('Import finished!');
}

main().finally(() => prisma.$disconnect());
