import prisma from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

// Ajuste o nome do arquivo se necessário
const INPUT_FILE = './migration-data.json';

async function main() {
    console.log('🔄 Iniciando carga/atualização de dados...');

    // 1. Ler os dados exportados
    const filePath = path.resolve(__dirname, INPUT_FILE);
    const rawData = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    // 2. Localizar a empresa de destino (ou criar)
    // Se você já tem a empresa e só quer atualizar, mude para findUnique usando CNPJ ou nome
    const company = await prisma.companies.findFirst({
        where: { name: "Company Name" } // IMPORTANTE: Ajuste o nome ou busque dinamicamente
    });

    // Se a empresa não existir, paramos o script. Ajuste se quiser criar.
    if (!company) {
        console.error(`❌ Empresa não encontrada! Crie-a manualmente ou ajuste o script.`);
        return;
    }

    const companyId = company.id;
    console.log(`🏭 Processando para empresa: ${company.name} (${companyId})`);

    // 3. Cadastrar/Atualizar Áreas e Sub-áreas
    console.log('📂 3. Atualizando hierarquia de Áreas...');
    for (const area of data.areas) {
        // Upsert Business Area
        const businessArea = await prisma.business_areas.upsert({
            where: {
                company_id_name: {
                    company_id: companyId,
                    name: area.name
                }
            },
            update: { description: area.description },
            create: {
                company_id: companyId,
                name: area.name,
                description: area.description
            }
        });

        // Upsert Sub-areas
        if (area.sub_areas) {
            for (const sub of area.sub_areas) {
                await prisma.business_sub_areas.upsert({
                    where: {
                        area_id_name: {
                            area_id: businessArea.id,
                            name: sub.name
                        }
                    },
                    update: {},
                    create: {
                        area_id: businessArea.id,
                        name: sub.name
                    }
                });
            }
        }
    }

    // 4. Cadastrar/Atualizar Pessoas (Owners)
    console.log('👥 4. Atualizando Pessoas (Owners)...');
    for (const p of data.people) {
        if (!p.email) continue; // Pessoas sem email não podem ser identificadas unicamente

        await prisma.people.upsert({
            where: {
                // Assuming email is unique in this context - if it's not unique globally, this logic might need adjustment
                // Prisma currently doesn't enforce strict unique constraint on people.email but logic suggests checking by email
                // Since there is no composite unique index on (email, company_id) we can check via findFirst
            },
            // Since we can't easily upsert people without a unique constraint, let's use check-then-create/update
            update: {}, // Fake update
            create: {} // Fake create
        });

        // Custom logic for people (Checking existence first)
        const existingPerson = await prisma.people.findFirst({
            where: {
                company_id: companyId,
                email: p.email
            }
        });

        if (existingPerson) {
            await prisma.people.update({
                where: { id: existingPerson.id },
                data: {
                    name: p.name,
                    job_title: p.job_title,
                    phone: p.phone,
                    tech_level_id: p.tech_level_id,
                    business_level_id: p.business_level_id,
                    archetype_id: p.archetype_id
                }
            });
        } else {
            await prisma.people.create({
                data: {
                    company_id: companyId,
                    name: p.name,
                    email: p.email,
                    job_title: p.job_title,
                    phone: p.phone,
                    tech_level_id: p.tech_level_id,
                    business_level_id: p.business_level_id,
                    archetype_id: p.archetype_id
                }
            });
        }
    }

    // 5. Cadastrar/Atualizar Aplicações e Relacionamentos
    console.log('🚀 5. Atualizando Aplicações...');

    // Recarregar áreas/subs/pessoas para cache de lookup
    const allAreas = await prisma.business_areas.findMany({ where: { company_id: companyId } });
    const allSubAreas = await prisma.business_sub_areas.findMany({
        where: { business_areas: { company_id: companyId } }
    });
    const allPeople = await prisma.people.findMany({ where: { company_id: companyId } });

    for (const app of data.applications) {
        // Encontrar Area ID
        const area = allAreas.find(a => a.name === app.area_name);
        const areaId = area?.id || null;

        // Encontrar Sub-Area ID
        const subArea = areaId ? allSubAreas.find(s => s.name === app.sub_area_name && s.area_id === areaId) : null;
        const subAreaId = subArea?.id || null;

        // Encontrar Pessoas (Business Owner)
        const businessOwner = allPeople.find(p => p.email === app.business_owner_email);
        const businessOwnerId = businessOwner?.id || null;

        // Encontrar Pessoas (Tech Owner)
        const techOwner = allPeople.find(p => p.email === app.tech_owner_email);
        const techOwnerId = techOwner?.id || null;

        // Buscar aplicação existente por Nome (Assumindo que o Nome é único por empresa)
        const existingApp = await prisma.applications.findFirst({
            where: {
                company_id: companyId,
                name: app.name
            }
        });

        if (existingApp) {
            await prisma.applications.update({
                where: { id: existingApp.id },
                data: {
                    description: app.description,
                    business_area_id: areaId,
                    sub_area_id: subAreaId,
                    business_owner_id: businessOwnerId,
                    tech_owner_id: techOwnerId,
                    // Outros campos opcionais
                    criticality_id: app.criticality_id,
                    risk_status_id: app.risk_status_id,
                    operational_status_id: app.operational_status_id,
                    data_sensitivity_id: app.data_sensitivity_id
                }
            });
            console.log(`   🔸 Atualizada: ${app.name}`);
        } else {
            // Se quiser criar novas também, desconmente abaixo:
            /*
            await prisma.applications.create({
                data: {
                    company_id: companyId,
                    name: app.name,
                    description: app.description,
                    business_area_id: areaId,
                    sub_area_id: subAreaId,
                    business_owner_id: businessOwnerId,
                    tech_owner_id: techOwnerId,
                    // ...
                }
            });
             console.log(`   ✨ Criada: ${app.name}`);
             */
            console.log(`   ⚠️ Aplicação não encontrada para atualizar: ${app.name}`);
        }
    }

    console.log('🏁 Processo finalizado com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
