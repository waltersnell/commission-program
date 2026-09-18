import { getPrisma } from "../src/lib/db";
import { reconcileDueOpportunityStatuses } from "../src/lib/crm-status";

async function main() {
  const prisma = getPrisma();
  const transitions = await reconcileDueOpportunityStatuses(prisma);
  console.log(`CRM status reconciliation complete: ${transitions} transition(s).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
