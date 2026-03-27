import prisma from './src/lib/prisma';

async function main() {
  const companyIdStr = 'ead04834-f5c7-431c-8dfa-9a9143709b94';
  try {
    const applications = await prisma.applications.findMany({
      where: {
          company_id: companyIdStr,
      },
      include: {
          business_areas: { select: { id: true, name: true } },
          business_sub_areas: { select: { id: true, name: true } },
          ref_risk_status: { select: { id: true, label: true } },
          ref_business_criticality: { select: { id: true, label: true } },
          ref_sensitivity_levels: { select: { id: true, label: true } },
          ref_operational_status: { select: { id: true, label: true } },
          people_applications_business_owner_idTopeople: { select: { id: true, name: true } },
          people_applications_tech_owner_idTopeople: { select: { id: true, name: true } },
          assessments: {
              orderBy: { started_at: 'desc' },
              take: 1,
              include: {
                  _count: {
                      select: { assessment_answers: true }
                  }
              }
          }
      },
    });
    console.log("Success! Found:", applications.length);
  } catch (error: any) {
    console.error("Query Failed!");
    console.error(error);
  } finally {
    // await prisma.$disconnect();
  }
}

main();
