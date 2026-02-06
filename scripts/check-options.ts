
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Question Options Score Values...');

    const options = await prisma.question_options.findMany({
        take: 20,
        select: {
            id: true,
            text: true,
            score_value: true,
            question_id: true
        }
    });

    console.log('Sample Options:', options);

    // Check min/max scores
    const agg = await prisma.question_options.aggregate({
        _min: { score_value: true },
        _max: { score_value: true }
    });

    console.log('Min Score:', agg._min.score_value);
    console.log('Max Score:', agg._max.score_value);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
