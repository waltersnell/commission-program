import { Prisma } from "@prisma/client";
import {
  calculateCommissionByStaff,
  filterCreditsForMonth,
  settingsFromRows,
  type CommissionCreditInput,
} from "./commission";
import { getPrisma } from "./db";
import { crmStepTemplates } from "./crm-steps";
import { monthKey, monthRange } from "./format";
import { canManage, isCloserRole } from "./roles";
import { staffMatchesUser } from "./current-staff";

type CurrentUser = {
  role: string;
  displayName: string;
  username: string;
  email?: string | null;
};

type PendingSaleForSummary = {
  id: string;
  isFirstVisitSale: boolean;
  credits: {
    staffId: string;
    creditBasisPoints: number;
    staff: {
      displayName: string;
    };
  }[];
};

export type PendingStaffSummary = {
  staffId: string;
  staffName: string;
  pendingMembershipCount: number;
  pendingCreditBasisPoints: number;
  pendingFirstVisitCreditBasisPoints: number;
};

export async function getFormOptions() {
  const prisma = getPrisma();
  const [allStaff, users, therapists, locations, membershipTypes] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { displayName: true, username: true, email: true, role: true } }),
    prisma.staff.findMany({ where: { active: true, role: "THERAPIST" }, orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.membershipType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const staff = allStaff.filter((person) =>
    isCloserRole(person.role) || users.some((user) => isCloserRole(user.role) && staffMatchesUser(person, user)),
  );
  return { staff, therapists, locations, membershipTypes };
}

export async function getDashboardData(month = monthKey()) {
  const prisma = getPrisma();
  const [openCount, pendingApprovals, recentOpportunities, salesThisMonth, locations, commissionSummary] = await Promise.all([
    prisma.membershipOpportunity.count({ where: { status: "OPEN" } }),
    prisma.membershipSale.count({
      where: { ...saleMonthWhere(month), approvalStatus: "PENDING" },
    }),
    prisma.membershipOpportunity.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        location: true,
        firstVisitTherapist: true,
        proposedPrimaryCloser: true,
        proposedSupportCloser: true,
      },
    }),
    prisma.membershipSale.findMany({
      where: saleMonthWhere(month),
      include: { location: true },
      orderBy: [{ membershipSaleDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.location.findMany({ orderBy: { code: "asc" } }),
    getCommissionSummary(month, null, { includePendingAsEstimated: true }),
  ]);

  const leaderboardSummary = commissionSummary
    .sort((a, b) => {
      const commissionDiff = b.result.finalCommissionCents - a.result.finalCommissionCents;
      if (commissionDiff !== 0) {
        return commissionDiff;
      }
      const creditDiff = b.result.totalCreditBasisPoints - a.result.totalCreditBasisPoints;
      return creditDiff !== 0 ? creditDiff : a.staff.displayName.localeCompare(b.staff.displayName);
    });
  const firstVisitSales = salesThisMonth.filter((sale) => sale.isFirstVisitSale).length;
  const soldByLocation = locations.map((location) => ({
    code: location.code,
    count: salesThisMonth.filter((sale) => sale.locationId === location.id).length,
  }));

  return {
    openCount,
    pendingApprovals,
    recentOpportunities,
    salesThisMonth,
    firstVisitCloseRate: salesThisMonth.length ? Math.round((firstVisitSales / salesThisMonth.length) * 100) : 0,
    soldByLocation,
    commissionSummary: leaderboardSummary,
  };
}

export type OpportunityScope = "all" | "assigned" | "other";

export async function getOpportunities(
  params: Record<string, string | string[] | undefined>,
  visibleStaffId?: string | null,
  scope: OpportunityScope = visibleStaffId ? "assigned" : "all",
) {
  const prisma = getPrisma();
  const page = Number(params.page ?? 1);
  const take = 25;
  const paginate = !visibleStaffId;
  const skip = (Math.max(page, 1) - 1) * take;
  const search = scalar(params.search);
  const locationId = scalar(params.locationId);
  const closerId = scalar(params.closerId);

  const andFilters: Prisma.MembershipOpportunityWhereInput[] = [];

  if (visibleStaffId && scope === "assigned") {
    andFilters.push({
      OR: [
        { proposedPrimaryCloserId: visibleStaffId },
        { proposedSupportCloserId: visibleStaffId },
      ],
    });
  }
  if (visibleStaffId && scope === "other") {
    andFilters.push({
      NOT: {
        OR: [
          { proposedPrimaryCloserId: visibleStaffId },
          { proposedSupportCloserId: visibleStaffId },
        ],
      },
    });
  }
  if (!visibleStaffId && locationId) {
    andFilters.push({ locationId });
  }
  if (!visibleStaffId && closerId) {
    andFilters.push({ proposedPrimaryCloserId: closerId });
  }
  if (search) {
    andFilters.push({
      OR: [
        { client: { firstName: { contains: search } } },
        { client: { lastName: { contains: search } } },
        { client: { phoneNormalized: { contains: search.replace(/\D/g, "") } } },
      ],
    });
  }

  const where: Prisma.MembershipOpportunityWhereInput = {
    status: "OPEN",
    interestLevel: { in: ["Hot", "Warm"] },
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.membershipOpportunity.findMany({
      where,
      ...(paginate ? { take, skip } : {}),
      orderBy: [{ client: { firstVisitDate: "desc" } }, { createdAt: "desc" }],
      include: {
        client: true,
        location: true,
        firstVisitTherapist: true,
        proposedPrimaryCloser: true,
        proposedSupportCloser: true,
      },
    }),
    prisma.membershipOpportunity.count({ where }),
  ]);

  const now = Date.now();
  const rowsWithDaysOpen = rows.map((row) => ({
    ...row,
    daysOpen: Math.max(0, Math.floor((now - row.createdAt.getTime()) / 86_400_000)),
  }));

  return {
    rows: rowsWithDaysOpen,
    total,
    page: paginate ? page : 1,
    pageCount: paginate ? Math.max(1, Math.ceil(total / take)) : 1,
  };
}

export async function getOpportunity(id: string) {
  return getPrisma().membershipOpportunity.findUnique({
    where: { id },
    include: {
      client: true,
      location: true,
      firstVisitTherapist: true,
      proposedPrimaryCloser: true,
      proposedSupportCloser: true,
      sale: {
        include: {
          membershipType: true,
          finalPrimaryCloser: true,
          finalSupportCloser: true,
          credits: { include: { staff: true } },
        },
      },
      followUps: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getMembershipSales(params: Record<string, string | string[] | undefined>, user?: CurrentUser | null, visibleStaffId?: string | null) {
  const prisma = getPrisma();
  const canSeeAll = user ? canManage(user.role) : false;
  const month = scalar(params.month) || monthKey();
  const locationId = scalar(params.locationId);
  const primaryId = scalar(params.primaryId);
  const supportId = scalar(params.supportId);
  const firstVisit = scalar(params.firstVisit);
  const approvalStatus = scalar(params.approvalStatus);

  return prisma.membershipSale.findMany({
    where: {
      ...saleMonthWhere(month),
      ...(canSeeAll && locationId ? { locationId } : {}),
      ...(canSeeAll && primaryId ? { finalPrimaryCloserId: primaryId } : {}),
      ...(canSeeAll && supportId ? { finalSupportCloserId: supportId } : {}),
      ...(canSeeAll && firstVisit ? { isFirstVisitSale: firstVisit === "true" } : {}),
      ...(canSeeAll && approvalStatus ? { approvalStatus } : {}),
      ...(!canSeeAll
        ? visibleStaffId
          ? {
              OR: [
                { finalPrimaryCloserId: visibleStaffId },
                { finalSupportCloserId: visibleStaffId },
              ],
            }
          : { id: "__no_matching_staff__" }
        : {}),
    },
    orderBy: [{ membershipSaleDate: "desc" }, { createdAt: "desc" }],
    include: {
      opportunity: { include: { client: true } },
      location: true,
      membershipType: true,
      finalPrimaryCloser: true,
      finalSupportCloser: true,
      credits: { include: { staff: true } },
    },
  });
}

export async function getCommissionSummary(
  month = monthKey(),
  visibleStaffId?: string | null,
  options: { includePendingAsEstimated?: boolean } = {},
) {
  const prisma = getPrisma();
  const [creditInputs, staff, settingsRows, pendingSplits, openOpportunities] = await Promise.all([
    getSaleCreditInputs(month),
    prisma.staff.findMany({
      where: { active: true, ...(visibleStaffId ? { id: visibleStaffId } : {}) },
      orderBy: { displayName: "asc" },
    }),
    prisma.commissionSetting.findMany(),
    prisma.membershipSale.findMany({
      where: { ...saleMonthWhere(month), approvalStatus: "PENDING" },
      include: { finalPrimaryCloser: true, finalSupportCloser: true },
    }),
    prisma.membershipOpportunity.findMany({ where: { status: "OPEN" } }),
  ]);

  const settings = settingsFromRows(settingsRows);
  const estimatedCreditInputs = options.includePendingAsEstimated
    ? creditInputs.map((credit) => credit.approvalStatus === "PENDING" ? { ...credit, approvalStatus: "APPROVED" } : credit)
    : creditInputs;
  const results = calculateCommissionByStaff(filterCreditsForMonth(estimatedCreditInputs, month), settings);

  return staff.map((person) => {
    const result = results.find((item) => item.staffId === person.id);
    return {
      staff: person,
      result: result ?? {
        staffId: person.id,
        staffName: person.displayName,
        fullSaleCount: 0,
        splitCreditBasisPoints: 0,
        totalCreditBasisPoints: 0,
        firstVisitCreditBasisPoints: 0,
        baseCommissionCents: 0,
        firstVisitBonusCents: 0,
        adjustmentsCents: 0,
        finalCommissionCents: 0,
        currentTier: "Tier 1",
        creditsToNextTierBasisPoints: settings.tier1UpperBasisPoints,
      },
      pendingSplitCount: pendingSplits.filter(
        (sale) => sale.finalPrimaryCloserId === person.id || sale.finalSupportCloserId === person.id,
      ).length,
      openOpportunityCount: openOpportunities.filter(
        (opportunity) =>
          opportunity.proposedPrimaryCloserId === person.id || opportunity.proposedSupportCloserId === person.id,
      ).length,
    };
  });
}

export async function getMonthEndData(month = monthKey()) {
  const prisma = getPrisma();
  const [period, summary, pendingSplits, disputes, invalids] = await Promise.all([
    prisma.commissionPeriod.findUnique({ where: { month }, include: { results: { include: { staff: true } } } }),
    getCommissionSummary(month),
    prisma.membershipSale.findMany({
      where: { ...saleMonthWhere(month), approvalStatus: "PENDING" },
      include: {
        opportunity: { include: { client: true } },
        finalPrimaryCloser: true,
        finalSupportCloser: true,
        credits: { include: { staff: true } },
      },
      orderBy: [{ membershipSaleDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.membershipOpportunity.findMany({ where: { status: "DISPUTED" }, include: { client: true } }),
    prisma.membershipOpportunity.findMany({ where: { status: "INVALID" }, include: { client: true } }),
  ]);

  return { period, summary, pendingSplits, pendingByStaff: summarizePendingSalesByStaff(pendingSplits), disputes, invalids };
}

export function summarizePendingSalesByStaff(sales: PendingSaleForSummary[]): PendingStaffSummary[] {
  const rows = new Map<string, PendingStaffSummary>();

  for (const sale of sales) {
    const creditedStaffIds = new Set<string>();

    for (const credit of sale.credits) {
      const row = rows.get(credit.staffId) ?? {
        staffId: credit.staffId,
        staffName: credit.staff.displayName,
        pendingMembershipCount: 0,
        pendingCreditBasisPoints: 0,
        pendingFirstVisitCreditBasisPoints: 0,
      };

      row.pendingCreditBasisPoints += credit.creditBasisPoints;
      if (sale.isFirstVisitSale) {
        row.pendingFirstVisitCreditBasisPoints += credit.creditBasisPoints;
      }
      creditedStaffIds.add(credit.staffId);
      rows.set(credit.staffId, row);
    }

    for (const staffId of creditedStaffIds) {
      const row = rows.get(staffId);
      if (row) {
        row.pendingMembershipCount += 1;
      }
    }
  }

  return Array.from(rows.values()).sort((a, b) => {
    const creditDiff = b.pendingCreditBasisPoints - a.pendingCreditBasisPoints;
    if (creditDiff !== 0) {
      return creditDiff;
    }
    const saleDiff = b.pendingMembershipCount - a.pendingMembershipCount;
    return saleDiff !== 0 ? saleDiff : a.staffName.localeCompare(b.staffName);
  });
}

export async function getAdminData() {
  const prisma = getPrisma();
  await Promise.all(
    crmStepTemplates.map((template) =>
      prisma.crmStepTemplate.upsert({
        where: { key: template.key },
        update: {
          label: template.label,
          sortOrder: template.sortOrder,
        },
        create: {
          key: template.key,
          label: template.label,
          content: template.defaultContent,
          sortOrder: template.sortOrder,
        },
      }),
    ),
  );
  const [users, staff, locations, membershipTypes, settings, crmSteps, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }] }),
    prisma.staff.findMany({ orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ orderBy: { code: "asc" } }),
    prisma.membershipType.findMany({ orderBy: { name: "asc" } }),
    prisma.commissionSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.crmStepTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.auditLog.findMany({ take: 30, orderBy: { createdAt: "desc" } }),
  ]);
  return { users, staff, locations, membershipTypes, settings, crmSteps, auditLogs };
}

export async function getClientLookupData(params: Record<string, string | string[] | undefined>) {
  const prisma = getPrisma();
  const search = scalar(params.clientSearch)?.trim();
  const locationId = scalar(params.clientLocationId);
  const closerId = scalar(params.clientCloserId);
  const selectedId = scalar(params.clientId);
  const opportunityFilter = locationId || closerId
    ? {
        ...(locationId ? { locationId } : {}),
        ...(closerId ? { proposedPrimaryCloserId: closerId } : {}),
      }
    : undefined;
  const where: Prisma.ClientWhereInput = {
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phoneNormalized: { contains: search.replace(/\D/g, "") } },
          ],
        }
      : {}),
    ...(opportunityFilter ? { opportunity: opportunityFilter } : {}),
  };
  const include = {
    opportunity: {
      include: {
        location: true,
        firstVisitTherapist: true,
        proposedPrimaryCloser: true,
        proposedSupportCloser: true,
        sale: true,
      },
    },
  } as const;
  const [rows, selected] = await Promise.all([
    prisma.client.findMany({
      where,
      take: 50,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include,
    }),
    selectedId ? prisma.client.findUnique({ where: { id: selectedId }, include }) : null,
  ]);

  return { rows, selected, search, locationId, closerId };
}

export async function getSaleCreditInputs(month?: string): Promise<CommissionCreditInput[]> {
  const prisma = getPrisma();
  const sales = await prisma.membershipSale.findMany({
    where: month ? saleMonthWhere(month) : undefined,
    include: {
      opportunity: true,
      credits: { include: { staff: true } },
    },
    orderBy: [{ membershipSaleDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  return sales.flatMap((sale) =>
    sale.credits.map((credit) => ({
      id: credit.id,
      saleId: sale.id,
      staffId: credit.staffId,
      staffName: credit.staff.displayName,
      saleDate: sale.membershipSaleDate,
      saleCreatedAt: sale.createdAt,
      creditBasisPoints: credit.creditBasisPoints,
      firstVisitCreditBasisPoints: sale.isFirstVisitSale ? credit.creditBasisPoints : 0,
      approvalStatus: sale.approvalStatus,
      opportunityStatus: sale.opportunity.status,
    })),
  );
}

export function saleMonthWhere(month: string): Prisma.MembershipSaleWhereInput {
  const { start, end } = monthRange(month);
  return {
    membershipSaleDate: {
      gte: start,
      lt: end,
    },
  };
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
