import prisma from '../src/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log('🔌 Conectando ao banco de origem para gerar SQL...');

    // 1. Buscar a empresa
    const company = await prisma.companies.findFirst({
        include: { tenants: true }
    });

    if (!company) {
        console.error('❌ Nenhuma empresa encontrada.');
        return;
    }

    const companyName = company.name;
    const companyId = company.id; // ID original para referência nos comentários

    console.log(`🏢 Gerando script para empresa: ${companyName}`);

    let sql = `-- MIGRATION SCRIPT GENERATED AUTOMATICALLY
-- DATA DE GERAÇÃO: ${new Date().toISOString()}
-- EMPRESA ORIGEM: ${companyName} (${companyId})
-- 
-- INSTRUÇÕES:
-- 1. Execute este script no banco de destino (GCP) usando DBeaver ou psql.
-- 2. Este script assume que a empresa já existe no destino com o nome '${companyName}'.
-- 3. Ele irá criar as Áreas, Sub-áreas e Pessoas se não existirem (baseado no nome/email).
-- 4. Ele irá atualizar as Aplicações existentes (baseado no nome) com os novos vínculos.

DO $$
DECLARE
    target_company_id uuid;
    area_id uuid;
    sub_area_id uuid;
    person_id uuid;
    app_id uuid;
BEGIN
    -- 1. BUSCAR ID DA EMPRESA NO DESTINO
    SELECT id INTO target_company_id FROM companies WHERE name = '${companyName}' LIMIT 1;
    
    IF target_company_id IS NULL THEN
        RAISE NOTICE 'Empresa ${companyName} não encontrada. Criando...';
        -- Opcional: Criar empresa se não existir (Descomente se desejar)
        -- INSERT INTO tenants (name, slug) VALUES ('Tenant ${companyName}', 'slug-${Date.now()}') RETURNING id INTO ...;
        -- INSERT INTO companies (name, tenant_id) VALUES ('${companyName}', ...) RETURNING id INTO target_company_id;
        RAISE EXCEPTION 'Abortando: Empresa não encontrada.';
    END IF;

    RAISE NOTICE 'Empresa alvo ID: %', target_company_id;

`;

    // 2. Áreas e Sub-áreas
    sql += `\n    -- ==========================================`;
    sql += `\n    -- 2. ÁREAS DE NEGÓCIO E SUB-ÁREAS`;
    sql += `\n    -- ==========================================\n`;

    const areas = await prisma.business_areas.findMany({
        where: { company_id: companyId },
        include: { business_sub_areas: true }
    });

    for (const area of areas) {
        sql += `
    -- Área: ${area.name}
    SELECT id INTO area_id FROM business_areas WHERE name = '${area.name}' AND company_id = target_company_id;
    IF area_id IS NULL THEN
        INSERT INTO business_areas (name, description, company_id)
        VALUES ('${area.name}', ${area.description ? `'${area.description.replace(/'/g, "''")}'` : 'NULL'}, target_company_id)
        RETURNING id INTO area_id;
    END IF;`;

        for (const sub of area.business_sub_areas) {
            sql += `
        -- Sub-área: ${sub.name}
        SELECT id INTO sub_area_id FROM business_sub_areas WHERE name = '${sub.name}' AND area_id = area_id;
        IF sub_area_id IS NULL THEN
            INSERT INTO business_sub_areas (name, area_id)
            VALUES ('${sub.name}', area_id)
            RETURNING id INTO sub_area_id;
        END IF;`;
        }
    }

    // 3. Pessoas (Owners)
    sql += `\n\n    -- ==========================================`;
    sql += `\n    -- 3. PESSOAS (OWNERS)`;
    sql += `\n    -- ==========================================\n`;

    const people = await prisma.people.findMany({
        where: { company_id: companyId }
    });

    for (const p of people) {
        if (!p.email) continue;
        const safeName = p.name.replace(/'/g, "''");
        const safeJob = p.job_title ? `'${p.job_title.replace(/'/g, "''")}'` : 'NULL';
        const safePhone = p.phone ? `'${p.phone.replace(/'/g, "''")}'` : 'NULL';

        sql += `
    -- Pessoa: ${p.name} (${p.email})
    SELECT id INTO person_id FROM people WHERE email = '${p.email}' AND company_id = target_company_id;
    IF person_id IS NULL THEN
        INSERT INTO people (name, email, job_title, phone, company_id, tech_level_id, business_level_id, archetype_id)
        VALUES ('${safeName}', '${p.email}', ${safeJob}, ${safePhone}, target_company_id, ${p.tech_level_id || 'NULL'}, ${p.business_level_id || 'NULL'}, ${p.archetype_id || 'NULL'})
        RETURNING id INTO person_id;
    ELSE
        UPDATE people SET
            name = '${safeName}',
            job_title = ${safeJob},
            phone = ${safePhone},
            tech_level_id = ${p.tech_level_id || 'NULL'},
            business_level_id = ${p.business_level_id || 'NULL'},
            archetype_id = ${p.archetype_id || 'NULL'}
        WHERE id = person_id;
    END IF;`;
    }

    // 4. Atualizar Aplicações
    sql += `\n\n    -- ==========================================`;
    sql += `\n    -- 4. ATUALIZAR APLICAÇÕES`;
    sql += `\n    -- ==========================================\n`;

    const apps = await prisma.applications.findMany({
        where: { company_id: companyId },
        include: {
            business_areas: true,
            business_sub_areas: true,
            people_applications_business_owner_idTopeople: true,
            people_applications_tech_owner_idTopeople: true
        }
    });

    for (const app of apps) {
        const safeAppName = app.name.replace(/'/g, "''");
        const areaName = app.business_areas?.name;
        const subAreaName = app.business_sub_areas?.name;
        const boEmail = app.people_applications_business_owner_idTopeople?.email;
        const toEmail = app.people_applications_tech_owner_idTopeople?.email;

        sql += `
    -- Atualizando App: ${app.name}
    SELECT id INTO app_id FROM applications WHERE name = '${safeAppName}' AND company_id = target_company_id;
    
    IF app_id IS NOT NULL THEN
        -- Buscar IDs Relacionados
        ${areaName ? `SELECT id INTO area_id FROM business_areas WHERE name = '${areaName}' AND company_id = target_company_id;` : `area_id := NULL;`}
        ${subAreaName ? `SELECT id INTO sub_area_id FROM business_sub_areas WHERE name = '${subAreaName}' AND area_id = area_id;` : `sub_area_id := NULL;`}
        ${boEmail ? `SELECT id INTO person_id FROM people WHERE email = '${boEmail}' AND company_id = target_company_id;` : ''}
        
        UPDATE applications SET
            business_area_id = area_id,
            sub_area_id = sub_area_id,
            ${boEmail ? `business_owner_id = person_id,` : 'business_owner_id = NULL,'}
            ${toEmail ? `tech_owner_id = (SELECT id FROM people WHERE email = '${toEmail}' AND company_id = target_company_id),` : 'tech_owner_id = NULL,'}
            risk_status_id = ${app.risk_status_id || 'NULL'},
            criticality_id = ${app.criticality_id || 'NULL'},
            operational_status_id = ${app.operational_status_id || 'NULL'},
            data_sensitivity_id = ${app.data_sensitivity_id || 'NULL'}
        WHERE id = app_id;
    ELSE
        RAISE NOTICE 'Aplicação ${safeAppName} não encontrada no destino. Ignorando.';
    END IF;`;
    }

    sql += `\n\nEND $$;`;

    // Salvar arquivo
    const outputPath = path.resolve(__dirname, 'manual-migration.sql');
    await fs.writeFile(outputPath, sql);

    console.log(`✅ Script SQL gerado com sucesso: ${outputPath}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
