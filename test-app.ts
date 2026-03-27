import prisma from './src/lib/prisma';

async function main() {
  const assessments = await prisma.assessments.findMany({
    include: { applications: { select: { name: true } } },
    take: 10,
    orderBy: { started_at: 'desc' }
  });
  console.log(JSON.stringify(assessments.map(a => ({
    id: a.id,
    app: a.applications?.name,
    started: a.started_at,
    status: a.status,
    locked: a.is_locked,
    version: a.version_number
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
