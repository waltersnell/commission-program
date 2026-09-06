import { Prisma } from "@prisma/client";
import {
  calculateCommissionByStaff,
  calculateCommissionLineItemsForStaff,
  filterCreditsForMonth,
  settingsFromRows,
  type CommissionCreditInput,
} from "./commission";
import { getPrisma } from "./db";
import { crmStepTemplates } from "./crm-steps";
import { monthKey, monthRange, startOfCurrentCalendarDay } from "./format";
import { canManage, isCloserRole } from "./roles";
import { matchStaffForUser, staffMatchesUser } from "./current-staff";
import {
  calculatePayrollMembershipItems,
  isDateInPayrollRange,
  payrollMonthKeys,
  type PayrollRange,
  type PayrollReport,
  type PayrollStaffReport,
} from "./payroll";

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
  const primaryCloserStaff = staff;
  return { staff, primaryCloserStaff, therapists, locations, membershipTypes };
}

export async function getDashboardData(month = monthKey()) {
  const prisma = getPrisma();
  const [openCount, pendingMembershipApprovals, pendingSpecialSpiffApprovals, recentOpportunities, salesThisMonth, locations, commissionSummary] = await Promise.all([
    prisma.membershipOpportunity.count({ where: { status: "OPEN" } }),
    prisma.membershipSale.count({ where: { ...saleMonthWhere(month), approvalStatus: "PENDING" } }),
    prisma.specialSpiffAward.count({ where: { ...specialSpiffMonthWhere(month), approvalStatus: "PENDING" } }),
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
    totalCount: salesThisMonth.filter((sale) => sale.locationId === location.id).length,
    approvedCount: salesThisMonth.filter((sale) => sale.locationId === location.id && sale.approvalStatus === "APPROVED").length,
  }));

  return {
    openCount,
    pendingApprovals: pendingMembershipApprovals + pendingSpecialSpiffApprovals,
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
      client: {
        include: {
          specialSpiffAwards: {
            include: { specialSpiff: true, staff: true, location: true },
            orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
          },
        },
      },
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

export async function getSpecialSpiffEntryOptions() {
  const prisma = getPrisma();
  const today = startOfCurrentCalendarDay();
  const [specialSpiffs, staff, locations] = await Promise.all([
    prisma.specialSpiff.findMany({
      where: {
        active: true,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      orderBy: { name: "asc" },
    }),
    prisma.staff.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  return { specialSpiffs, staff, locations };
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
  const [creditInputs, staff, settingsRows, pendingSplits, openOpportunities, specialSpiffAwards, activeUsers] = await Promise.all([
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
    prisma.specialSpiffAward.findMany({ where: specialSpiffMonthWhere(month) }),
    prisma.user.findMany({ where: { active: true } }),
  ]);

  const settings = settingsFromRows(settingsRows);
  const estimatedCreditInputs = options.includePendingAsEstimated
    ? creditInputs.map((credit) => credit.approvalStatus === "PENDING" ? { ...credit, approvalStatus: "APPROVED" } : credit)
    : creditInputs;
  const results = calculateCommissionByStaff(filterCreditsForMonth(estimatedCreditInputs, month), settings);

  const staffWithUserAccess = new Set(
    activeUsers
      .map((user) => user.staffId ? staff.find((person) => person.id === user.staffId) ?? null : matchStaffForUser(user, staff))
      .filter((person): person is (typeof staff)[number] => Boolean(person))
      .map((person) => person.id),
  );
  const rows = staff.map((person) => {
    const result = results.find((item) => item.staffId === person.id);
    const specialSpiffCents = specialSpiffAwards
      .filter((award) => award.staffId === person.id)
      .filter((award) => award.approvalStatus === "APPROVED" || (options.includePendingAsEstimated && award.approvalStatus === "PENDING"))
      .reduce((total, award) => total + award.amountCentsSnapshot, 0);
    const baseResult = result ?? {
      staffId: person.id,
      staffName: person.displayName,
      fullSaleCount: 0,
      splitCreditBasisPoints: 0,
      totalCreditBasisPoints: 0,
      firstVisitCreditBasisPoints: 0,
      baseCommissionCents: 0,
      firstVisitBonusCents: 0,
      membershipSpiffCents: 0,
      specialSpiffCents: 0,
      adjustmentsCents: 0,
      finalCommissionCents: 0,
      currentTier: "Tier 1",
      creditsToNextTierBasisPoints: settings.tier1UpperBasisPoints,
    };
    return {
      staff: person,
      hasUserAccess: staffWithUserAccess.has(person.id),
      result: {
        ...baseResult,
        specialSpiffCents,
        finalCommissionCents: baseResult.finalCommissionCents + specialSpiffCents,
      },
      pendingSplitCount: pendingSplits.filter(
        (sale) => sale.finalPrimaryCloserId === person.id || sale.finalSupportCloserId === person.id,
      ).length,
      pendingSpecialSpiffCount: specialSpiffAwards.filter(
        (award) => award.staffId === person.id && award.approvalStatus === "PENDING",
      ).length,
      openOpportunityCount: openOpportunities.filter(
        (opportunity) =>
          opportunity.proposedPrimaryCloserId === person.id || opportunity.proposedSupportCloserId === person.id,
      ).length,
    };
  });
  return rows.sort((a, b) => {
    const groupDiff = Number(b.hasUserAccess) - Number(a.hasUserAccess);
    return groupDiff !== 0 ? groupDiff : a.staff.displayName.localeCompare(b.staff.displayName);
  });
}

export async function getCommissionDetail(staffId: string, month = monthKey(), includePendingAsEstimated = true) {
  const prisma = getPrisma();
  const [staff, credits, specialSpiffAwards, summary, settingsRows] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.saleCredit.findMany({
      where: {
        staffId,
        sale: {
          ...saleMonthWhere(month),
          approvalStatus: { in: includePendingAsEstimated ? ["APPROVED", "PENDING"] : ["APPROVED"] },
        },
      },
      include: {
        sale: {
          include: {
            opportunity: { include: { client: true } },
            location: true,
            membershipType: true,
            finalPrimaryCloser: true,
            finalSupportCloser: true,
          },
        },
      },
      orderBy: [{ sale: { membershipSaleDate: "asc" } }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.specialSpiffAward.findMany({
      where: {
        staffId,
        ...specialSpiffMonthWhere(month),
        approvalStatus: { in: includePendingAsEstimated ? ["APPROVED", "PENDING"] : ["APPROVED"] },
      },
      include: { client: true, location: true },
      orderBy: [{ activityDate: "asc" }, { createdAt: "asc" }],
    }),
    getCommissionSummary(month, staffId, { includePendingAsEstimated }),
    prisma.commissionSetting.findMany(),
  ]);
  if (!staff) {
    return null;
  }
  const settings = settingsFromRows(settingsRows);
  const inputs = credits.map((credit) => ({
    id: credit.id,
    saleId: credit.saleId,
    staffId: credit.staffId,
    staffName: staff.displayName,
    saleDate: credit.sale.membershipSaleDate,
    saleCreatedAt: credit.sale.createdAt,
    creditBasisPoints: credit.creditBasisPoints,
    payoutBasisPoints: credit.payoutBasisPoints,
    fixedCommissionCents: credit.fixedCommissionCents,
    firstVisitCreditBasisPoints: credit.sale.isFirstVisitSale ? credit.creditBasisPoints : 0,
    approvalStatus: includePendingAsEstimated && credit.sale.approvalStatus === "PENDING" ? "APPROVED" : credit.sale.approvalStatus,
    opportunityStatus: credit.sale.opportunity.status,
  }));
  const calculations = new Map(
    calculateCommissionLineItemsForStaff(staffId, inputs, settings).map((item) => [item.creditId, item]),
  );
  return {
    staff,
    summary: summary[0]?.result,
    membershipItems: credits.map((credit) => ({ credit, calculation: calculations.get(credit.id) })),
    specialSpiffItems: specialSpiffAwards,
  };
}

export async function getMonthEndData(month = monthKey()) {
  const prisma = getPrisma();
  const [period, summary, pendingSplits, pendingSpecialSpiffs, disputes, invalids] = await Promise.all([
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
    prisma.specialSpiffAward.findMany({
      where: { ...specialSpiffMonthWhere(month), approvalStatus: "PENDING" },
      include: { client: true, staff: true, location: true },
      orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.membershipOpportunity.findMany({ where: { status: "DISPUTED" }, include: { client: true } }),
    prisma.membershipOpportunity.findMany({ where: { status: "INVALID" }, include: { client: true } }),
  ]);

  return { period, summary, pendingSplits, pendingSpecialSpiffs, pendingByStaff: summarizePendingSalesByStaff(pendingSplits), disputes, invalids };
}

export async function getPayrollReport(range: PayrollRange): Promise<PayrollReport> {
  const prisma = getPrisma();
  const months = payrollMonthKeys(range);
  const fullRangeStart = monthRange(months[0]).start;
  const fullRangeEnd = monthRange(months[months.length - 1]).end;
  const [sales, specialSpiffs, settingsRows] = await Promise.all([
    prisma.membershipSale.findMany({
      where: { membershipSaleDate: { gte: fullRangeStart, lt: fullRangeEnd } },
      include: {
        opportunity: { include: { client: true } },
        location: true,
        membershipType: true,
        finalPrimaryCloser: true,
        finalSupportCloser: true,
        credits: { include: { staff: true } },
      },
      orderBy: [{ membershipSaleDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.specialSpiffAward.findMany({
      where: { activityDate: { gte: range.start, lt: range.endExclusive } },
      include: { client: true, staff: true, location: true },
      orderBy: [{ activityDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.commissionSetting.findMany(),
  ]);
  const settings = settingsFromRows(settingsRows);
  const creditInputs: CommissionCreditInput[] = sales.flatMap((sale) => sale.credits.map((credit) => ({
    id: credit.id,
    saleId: sale.id,
    staffId: credit.staffId,
    staffName: credit.staff.displayName,
    saleDate: sale.membershipSaleDate,
    saleCreatedAt: sale.createdAt,
    creditBasisPoints: credit.creditBasisPoints,
    firstVisitCreditBasisPoints: sale.isFirstVisitSale ? credit.creditBasisPoints : 0,
    payoutBasisPoints: credit.payoutBasisPoints,
    fixedCommissionCents: credit.fixedCommissionCents,
    approvalStatus: sale.approvalStatus,
    opportunityStatus: sale.opportunity.status,
  })));
  const staffById = new Map<string, { id: string; displayName: string; role: string; active: boolean }>();
  for (const sale of sales) {
    for (const credit of sale.credits) {
      staffById.set(credit.staff.id, credit.staff);
    }
  }
  for (const award of specialSpiffs) {
    staffById.set(award.staff.id, award.staff);
  }

  const staffReports: PayrollStaffReport[] = [];
  for (const staff of staffById.values()) {
    const calculations = calculatePayrollMembershipItems(staff.id, creditInputs, settings);
    const membershipItems = sales.flatMap((sale) => sale.credits
      .filter((credit) => credit.staffId === staff.id && isDateInPayrollRange(sale.membershipSaleDate, range))
      .map((credit) => {
        const calculation = calculations.get(credit.id);
        return {
          id: credit.id,
          opportunityId: sale.opportunityId,
          clientName: [sale.opportunity.client.firstName, sale.opportunity.client.lastName].filter(Boolean).join(" "),
          date: sale.membershipSaleDate,
          month: monthKey(sale.membershipSaleDate),
          locationCode: sale.location.code,
          membershipType: sale.membershipType.name,
          approvalStatus: sale.approvalStatus,
          primaryCloser: sale.finalPrimaryCloser.displayName,
          supportCloser: sale.finalSupportCloser?.displayName ?? null,
          payoutBasisPoints: credit.payoutBasisPoints,
          tierLabel: calculation?.tierLabel ?? "Not eligible",
          creditBasisPoints: credit.creditBasisPoints,
          baseCommissionCents: calculation?.baseCommissionCents ?? 0,
          firstVisitBonusCents: calculation?.firstVisitBonusCents ?? 0,
          membershipSpiffCents: calculation?.membershipSpiffCents ?? 0,
          amountCents: calculation?.totalCommissionCents ?? 0,
        };
      }));
    const specialSpiffItems = specialSpiffs
      .filter((award) => award.staffId === staff.id)
      .map((award) => ({
        id: award.id,
        clientName: [award.client.firstName, award.client.lastName].filter(Boolean).join(" "),
        date: award.activityDate,
        month: monthKey(award.activityDate),
        locationCode: award.location.code,
        spiffName: award.spiffNameSnapshot,
        functionDescription: award.functionDescriptionSnapshot,
        approvalStatus: award.approvalStatus,
        amountCents: award.amountCentsSnapshot,
      }));
    const items = [...membershipItems, ...specialSpiffItems];
    const approvedCents = items.filter((item) => item.approvalStatus === "APPROVED").reduce((sum, item) => sum + item.amountCents, 0);
    const pendingCents = items.filter((item) => item.approvalStatus === "PENDING").reduce((sum, item) => sum + item.amountCents, 0);
    const rejectedCents = items.filter((item) => item.approvalStatus === "REJECTED").reduce((sum, item) => sum + item.amountCents, 0);
    if (approvedCents + pendingCents + rejectedCents === 0) {
      continue;
    }
    staffReports.push({
      staffId: staff.id,
      staffName: staff.displayName,
      staffRole: staff.role,
      active: staff.active,
      approvedCents,
      pendingCents,
      rejectedCents,
      reviewedCents: approvedCents + pendingCents,
      status: pendingCents > 0 ? "NEEDS_APPROVAL" : approvedCents > 0 ? "READY" : "NO_APPROVED_EARNINGS",
      membershipItems,
      specialSpiffItems,
    });
  }
  staffReports.sort((a, b) => a.staffName.localeCompare(b.staffName));

  return {
    range,
    staff: staffReports,
    approvedCents: staffReports.reduce((sum, row) => sum + row.approvedCents, 0),
    pendingCents: staffReports.reduce((sum, row) => sum + row.pendingCents, 0),
    rejectedCents: staffReports.reduce((sum, row) => sum + row.rejectedCents, 0),
    reviewedCents: staffReports.reduce((sum, row) => sum + row.reviewedCents, 0),
    commissionedStaffCount: staffReports.length,
    transactionCount: staffReports.reduce((sum, row) => sum + row.membershipItems.length + row.specialSpiffItems.length, 0),
  };
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
  const [users, staff, locations, membershipTypes, settings, crmSteps, specialSpiffs, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }] }),
    prisma.staff.findMany({ orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ orderBy: { code: "asc" } }),
    prisma.membershipType.findMany({ orderBy: { name: "asc" } }),
    prisma.commissionSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.crmStepTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.specialSpiff.findMany({
      include: { _count: { select: { awards: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.auditLog.findMany({ take: 30, orderBy: { createdAt: "desc" } }),
  ]);
  return { users, staff, locations, membershipTypes, settings, crmSteps, specialSpiffs, auditLogs };
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
      payoutBasisPoints: credit.payoutBasisPoints,
      fixedCommissionCents: credit.fixedCommissionCents,
      approvalStatus: sale.approvalStatus,
      opportunityStatus: sale.opportunity.status,
    })),
  );
}

export function specialSpiffMonthWhere(month: string): Prisma.SpecialSpiffAwardWhereInput {
  const { start, end } = monthRange(month);
  return { activityDate: { gte: start, lt: end } };
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
