import prisma from '../src/lib/prisma';
import dotenv from 'dotenv';
dotenv.config();
async function main() {
    console.log('🌱 Iniciando o script de seed...');

    const operationalStatuses = [
        { id: 1, label: "Em construção", is_active: true },
        { id: 2, label: "Em fase de testes", is_active: true },
        { id: 3, label: "Em produção", is_active: true },
        { id: 4, label: "Descontinuado", is_active: false }
    ];

    for (const status of operationalStatuses) {
        await prisma.ref_operational_status.upsert({
            where: { id: status.id },
            update: { 
                label: status.label,
                is_active: status.is_active
            },
            create: {
                id: status.id,
                label: status.label,
                is_active: status.is_active
            }
        });
    }

    console.log('✅ Operacional Statuses populados via Seed!');
}

main()
    .catch((e) => {
        console.error('❌ Erro durante o seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
