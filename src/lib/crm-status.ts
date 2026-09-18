import type { Prisma, PrismaClient } from "@prisma/client";
import { addCalendarDays, startOfCalendarDay } from "./format";

export const crmStatuses = ["Hot", "Warm", "Cold", "None"] as const;
export type CrmStatus = (typeof crmStatuses)[number];

export const defaultStatusDurations: Record<Exclude<CrmStatus, "None">, number> = {
  Hot: 30,
  Warm: 30,
  Cold: 360,
};

export function isCrmStatus(value: string): value is CrmStatus {
  return crmStatuses.includes(value as CrmStatus);
}

export function nextAutomaticStatus(status: CrmStatus): CrmStatus | null {
  if (status === "Hot" || status === "Warm") return "Cold";
  if (status === "Cold") return "None";
  return null;
}

export function allowedManualDowngrades(status: CrmStatus): CrmStatus[] {
  const index = crmStatuses.indexOf(status);
  return crmStatuses.slice(index + 1);
}

export function calculateDowngradeDate(status: CrmStatus, since: Date, durations: Map<string, number>) {
  if (status === "None") return null;
  return addCalendarDays(since, durations.get(status) ?? defaultStatusDurations[status]);
}

export async function ensureCrmStatusSettings(prisma: PrismaClient | Prisma.TransactionClient) {
  await Promise.all(
    Object.entries(defaultStatusDurations).map(([status, durationDays]) =>
      prisma.crmStatusSetting.upsert({
        where: { status },
        update: {},
        create: { status, durationDays },
      }),
    ),
  );
}

export async function reconcileDueOpportunityStatuses(prisma: PrismaClient, now = new Date()) {
  await ensureCrmStatusSettings(prisma);
  const settings = await prisma.crmStatusSetting.findMany();
  const durations = new Map(settings.map((setting) => [setting.status, setting.durationDays]));
  const due = await prisma.membershipOpportunity.findMany({
    where: {
      status: "OPEN",
      sale: null,
      interestLevel: { in: ["Hot", "Warm", "Cold"] },
      statusDowngradeAt: { lte: startOfCalendarDay(now) },
    },
  });

  let transitions = 0;
  for (const opportunity of due) {
    await prisma.$transaction(async (tx) => {
      let current = opportunity.interestLevel as CrmStatus;
      let since = opportunity.statusSinceAt;
      let downgradeAt = opportunity.statusDowngradeAt;
      while (downgradeAt && downgradeAt <= startOfCalendarDay(now)) {
        const next = nextAutomaticStatus(current);
        if (!next) break;
        await tx.opportunityStatusHistory.create({
          data: {
            opportunityId: opportunity.id,
            previousStatus: current,
            newStatus: next,
            source: "AUTOMATIC",
            notes: `Scheduled ${current} status period completed.`,
          },
        });
        transitions += 1;
        current = next;
        since = downgradeAt;
        downgradeAt = calculateDowngradeDate(current, since, durations);
      }
      await tx.membershipOpportunity.update({
        where: { id: opportunity.id },
        data: { interestLevel: current, statusSinceAt: since, statusDowngradeAt: downgradeAt, statusSource: "AUTOMATIC" },
      });
    });
  }
  return transitions;
}
