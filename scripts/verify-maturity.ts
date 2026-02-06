
require('dotenv').config();
import { PrismaClient } from '../src/generated/prisma/client';
import { calculateMaturityPercentage } from '../src/utils/metrics';

const prisma = new PrismaClient();
const COMPANY_ID = 'ead04834-f5c7-431c-8dfa-9a9143709b94'; // IPNET

async function main() {
    console.log(`\n=== Verifying Maturity Calculation for Company: IPNET (${COMPANY_ID}) ===\n`);

    // 1. Fetch raw data exactly as the controller does (but with more details for debug)
    const assessments = await prisma.assessments.findMany({
        where: {
            applications: { company_id: COMPANY_ID },
            status: 'COMPLETED'
        },
        select: {
            id: true,
            calculated_score: true,
            applications: {
                select: { name: true }
            }
        }
    });

    console.log(`Found ${assessments.length} COMPLETED assessments.`);

    // 2. Replicate Aggregation
    let totalScore = 0;
    assessments.forEach((a, i) => {
        const score = Number(a.calculated_score || 0);
        totalScore += score;
        console.log(`  ${i + 1}. App: "${a.applications?.name}" | Raw Score: ${score}`);
    });

    const avgRawScore = assessments.length > 0 ? totalScore / assessments.length : 0;

    console.log('\n--- Calculation Steps ---');
    console.log(`Total Score Sum: ${totalScore}`);
    console.log(`Count: ${assessments.length}`);
    console.log(`Average Raw Score (Total/Count): ${avgRawScore.toFixed(4)}`);

    // 3. Normalize
    // The utility function: Math.round(Number(rawScore) / 20)
    // But verify if the aggregation logic in controller matches our manual avg.
    // Controller uses: prisma.assessments.aggregate({ _avg: { calculated_score: true } })

    const dbAggregation = await prisma.assessments.aggregate({
        where: {
            applications: { company_id: COMPANY_ID },
            status: 'COMPLETED'
        },
        _avg: { calculated_score: true }
    });

    const dbAvg = Number(dbAggregation._avg.calculated_score || 0);
    console.log(`DB Aggregated Average (from Prisma): ${dbAvg}`);

    const normalizedMaturity = calculateMaturityPercentage(dbAvg);

    console.log(`\n--- Final Result ---`);
    console.log(`Formula: Math.round(RawAverage / 20)`);
    console.log(`Calculation: Math.round(${dbAvg} / 20) = Math.round(${dbAvg / 20})`);
    console.log(`\n> FINAL MATURITY PERCENTAGE: ${normalizedMaturity}%`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
