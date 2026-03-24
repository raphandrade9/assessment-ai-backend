import prisma from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log('🔌 Conectando ao banco de origem para exportação...');

    // 1. Buscar a empresa (ajuste o nome ou ID se necessário, aqui pegamos a primeira encontrada ou filtre por ID)
    // Se você souber o ID da empresa na Railway, substitua aqui.
    const company = await prisma.companies.findFirst();

    if (!company) {
        console.error('❌ Nenhuma empresa encontrada.');
        return;
    }

    console.log(`🏢 Exportando dados da empresa: ${company.name} (${company.id})`);

    // 2. Buscar Áreas e Sub-áreas
    const businessAreas = await prisma.business_areas.findMany({
        where: { company_id: company.id },
        include: {
            business_sub_areas: true
        }
    });

    // 3. Buscar Pessoas (Owners)
    const people = await prisma.people.findMany({
        where: { company_id: company.id }
    });

    // 4. Buscar Aplicações com seus relacionamentos atuais
    const applications = await prisma.applications.findMany({
        where: { company_id: company.id },
        include: {
            business_areas: true,
            business_sub_areas: true,
            people_applications_business_owner_idTopeople: true,
            people_applications_tech_owner_idTopeople: true
        }
    });

    // Montar o payload
    const data = {
        company: {
            name: company.name,
            cnpj: company.cnpj,
            sector: company.sector
        },
        areas: businessAreas.map(area => ({
            name: area.name,
            description: area.description,
            sub_areas: area.business_sub_areas.map(sub => ({
                name: sub.name
            }))
        })),
        people: people.map(p => ({
            name: p.name,
            email: p.email,
            job_title: p.job_title,
            phone: p.phone,
            // Mapeando IDs de referência se necessário, ou apenas dados brutos
            tech_level_id: p.tech_level_id,
            business_level_id: p.business_level_id,
            archetype_id: p.archetype_id
        })),
        applications: applications.map(app => ({
            name: app.name,
            description: app.description,
            // Nomes para lookup (já que IDs mudarão)
            area_name: app.business_areas?.name,
            sub_area_name: app.business_sub_areas?.name,
            business_owner_email: app.people_applications_business_owner_idTopeople?.email,
            business_owner_name: app.people_applications_business_owner_idTopeople?.name,
            tech_owner_email: app.people_applications_tech_owner_idTopeople?.email,
            tech_owner_name: app.people_applications_tech_owner_idTopeople?.name,
            // Outros campos importantes
            criticality_id: app.criticality_id,
            risk_status_id: app.risk_status_id,
            operational_status_id: app.operational_status_id,
            data_sensitivity_id: app.data_sensitivity_id
        }))
    };

    // Salvar em arquivo
    const outputPath = path.resolve(__dirname, 'migration-data.json');
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));

    console.log(`✅ Exportação concluída! Dados salvos em: ${outputPath}`);
    console.log(`   - Áreas: ${data.areas.length}`);
    console.log(`   - Pessoas: ${data.people.length}`);
    console.log(`   - Aplicações: ${data.applications.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
