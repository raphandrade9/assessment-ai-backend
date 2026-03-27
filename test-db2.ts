import prisma from './src/lib/prisma';
async function main() {
  const companyIdStr = 'ead04834-f5c7-431c-8dfa-9a9143709b94';
  const apps = await prisma.applications.findMany({
    where: { company_id: companyIdStr },
    include: { assessments: { orderBy: { started_at: 'desc' }, take: 1, include: { _count: { select: { assessment_answers: true } } } } }
  });
  console.log(JSON.stringify(apps, null, 2));
}
main().finally(() => prisma.$disconnect());
