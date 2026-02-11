
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

const quests = [
    { id: 1, text: "Origem e Conectividade: Como a aplicação se conecta às fontes de dados originais (CRM, ERP, Documentos, Banco de Dados) para obter informações?" },
    { id: 2, text: "Tratamento e Qualidade do Dado (ETL): Qual o nível de tratamento da informação antes dela ser enviada para a Inteligência Artificial processar?" },
    { id: 3, text: "Estratégia de Recuperação e Busca (RAG): Quando o usuário faz uma pergunta, como a aplicação encontra a informação correta dentro da base de conhecimento?" },
    { id: 4, text: "Rastreabilidade e Linhagem (Governança): Se a IA der uma resposta, conseguimos identificar exatamente qual documento ou dado gerou aquela informação?" },
    { id: 5, text: "Acoplamento e Localização da Lógica de IA" },
    { id: 6, text: "Padrões de Integração e Conectividade" },
    { id: 7, text: "Gestão de Estado e Memória (Contexto)" },
    { id: 8, text: "Resiliência, Escalabilidade e Disponibilidade" },
    { id: 9, text: "Estratégia de Prompt e Instrução: Como são construídas as instruções (prompts) que guiam o comportamento da Inteligência Artificial?" },
    { id: 10, text: "Agência e Uso de Ferramentas: Qual o nível de autonomia da aplicação? Ela apenas \"conversa\" ou consegue realizar tarefas no mundo real?" },
    { id: 11, text: "Controle de Alucinação e Veracidade (Grounding): Como a aplicação garante que a IA não está inventando fatos ou mentindo (\"alucinando\")?" },
    { id: 12, text: "Gestão e Roteamento de Modelos: Como a aplicação escolhe qual Modelo de IA (ex: GPT-4, Gemini, Claude, Llama) utilizar para processar uma requisição?" },
    { id: 13, text: "Privacidade de Dados e Tratamento de PII (Informações Pessoalmente Identificáveis): Como a aplicação lida com dados sensíveis (CPF, Salários, Segredos Industriais) ao interagir com Modelos de IA?" },
    { id: 14, text: "Controle de Acesso e Permissões (RAG): A Inteligência Artificial respeita as permissões de acesso aos documentos originais da empresa?" },
    { id: 15, text: "Guardrails e Moderação de Conteúdo: Como garantimos que a IA não responda a perguntas inapropriadas, tóxicas ou fora do escopo de trabalho?" },
    { id: 16, text: "Auditoria e Rastreabilidade: Em caso de incidente jurídico ou operacional, qual o nível de detalhe que temos sobre as interações passadas?" },
    { id: 17, text: "Observabilidade e Diagnóstico (Tracing): Qual o nível de detalhe que a equipe técnica possui para investigar erros ou respostas ruins?" },
    { id: 18, text: "Métricas de Performance e Experiência do Usuário (UX): Como a velocidade de resposta da IA é gerenciada e percebida pelo usuário final?" },
    { id: 19, text: "Controle de Custos (FinOps e Tokenomics): Como a empresa gerencia e controla os gastos com as APIs de Inteligência Artificial (consumo de tokens)?" },
    { id: 20, text: "Gestão de Erros e Robustez (Confiabilidade): O que acontece na aplicação se o provedor de IA (ex: OpenAI, Google) estiver instável, fora do ar ou responder com erro?" }
];

async function main() {
    console.log('Updating questions text...');

    for (const q of quests) {
        await prisma.questions.update({
            where: { id: q.id },
            data: { text: q.text }
        });
        console.log(`Updated Question ${q.id}`);
    }

    console.log('Update successful!');
}

main().finally(() => prisma.$disconnect());
