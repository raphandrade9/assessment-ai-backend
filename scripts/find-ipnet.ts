
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for company "IPNET"...');
    const companies = await prisma.companies.findMany({
        where: {
            name: {
                contains: 'IPNET',
                mode: 'insensitive',
            },
        },
    });

    if (companies.length === 0) {
        console.log('No company found with name containing "IPNET"');
        // Listar todas para debug
        const all = await prisma.companies.findMany({ take: 5 });
        console.log('First 5 companies in DB:', all.map((c: any) => c.name));
    } else {
        console.log('Companies found:', JSON.stringify(companies, null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
