
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    const questions = await prisma.questions.findMany({
        orderBy: { id: 'asc' }
    });
    console.log(JSON.stringify(questions, null, 2));
}

main().finally(() => prisma.$disconnect());
