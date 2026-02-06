
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Archetypes ---');
    console.log(JSON.stringify(await prisma.ref_archetypes.findMany(), null, 2));

    console.log('\n--- Tech Levels ---');
    console.log(JSON.stringify(await prisma.ref_tech_levels.findMany(), null, 2));

    console.log('\n--- Business Levels ---');
    console.log(JSON.stringify(await prisma.ref_business_levels.findMany(), null, 2));

    console.log('\n--- Risk Status ---');
    console.log(JSON.stringify(await prisma.ref_risk_status.findMany(), null, 2));

    console.log('\n--- Business Criticality ---');
    console.log(JSON.stringify(await prisma.ref_business_criticality.findMany(), null, 2));

    console.log('\n--- Sensitivity Levels ---');
    console.log(JSON.stringify(await prisma.ref_sensitivity_levels.findMany(), null, 2));

    console.log('\n--- Operational Status ---');
    console.log(JSON.stringify(await prisma.ref_operational_status.findMany(), null, 2));
}

main().finally(() => prisma.$disconnect());
