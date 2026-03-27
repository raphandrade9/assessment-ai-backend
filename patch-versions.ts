import prisma from './src/lib/prisma';

async function main() {
  console.log('Fetching applications to patch legacy assessments...');
  
  const applications = await prisma.applications.findMany({
    include: {
      assessments: {
        orderBy: {
          started_at: 'asc', // Oldest first
        }
      }
    }
  });

  let totalPatched = 0;

  for (const app of applications) {
    if (!app.assessments || app.assessments.length === 0) continue;

    let currentVersion = 1;
    for (const assessment of app.assessments) {
      // Force assign sequential version numbers and lock if COMPLETED
      await prisma.assessments.update({
        where: { id: assessment.id },
        data: { 
          version_number: currentVersion,
          is_locked: assessment.status === 'COMPLETED' ? true : assessment.is_locked
        }
      });
      console.log(`Updated assessment ${assessment.id} for app ${app.name} to version ${currentVersion}`);
      totalPatched++;
      currentVersion++;
    }
  }

  console.log(`Successfully patched ${totalPatched} legacy assessments.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
