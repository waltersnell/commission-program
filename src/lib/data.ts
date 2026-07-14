import { Prisma } from "@prisma/client";
import {
  calculateCommissionByStaff,
  filterCreditsForMonth,
  settingsFromRows,
  type CommissionCreditInput,
} from "./commission";
import { getPrisma } from "./db";
import { monthKey } from "./format";

export async function getFormOptions() {
  const prisma = getPrisma();
  const [staff, therapists, locations, membershipTypes] = await Promise.all([
    prisma.staff.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
    prisma.staff.findMany({ where: { active: true, role: "THERAPIST" }, orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.membershipType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return { staff, therapists, locations, membershipTypes };
}

export async function getDashboardData(month = monthKey()) {
  const prisma = getPrisma();
  const [openCount, pendingApprovals, recentOpportunities, salesThisMonth, locations, commissionSummary] = await Promise.all([
    prisma.membershipOpportunity.count({ where: { status: "OPEN" } }),
    prisma.membershipSale.count({ where: { approvalStatus: "PENDING_SPLIT_APPROVAL" } }),
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
    getCommissionSummary(month),
  ]);

  const firstVisitSales = salesThisMonth.filter((sale) => sale.isFirstVisitSale).length;
  const soldByLocation = locations.map((location) => ({
    code: location.code,
    count: salesThisMonth.filter((sale) => sale.locationId === location.id && sale.approvalStatus === "APPROVED").length,
  }));

  return {
    openCount,
    pendingApprovals,
    recentOpportunities,
    salesThisMonth,
    firstVisitCloseRate: salesThisMonth.length ? Math.round((firstVisitSales / salesThisMonth.length) * 100) : 0,
    soldByLocation,
    commissionSummary,
  };
}

export async function getOpportunities(params: Record<string, string | string[] | undefined>) {
  const prisma = getPrisma();
  const page = Number(params.page ?? 1);
  const take = 25;
  const skip = (Math.max(page, 1) - 1) * take;
  const search = scalar(params.search);
  const status = scalar(params.status);
  const locationId = scalar(params.locationId);
  const closerId = scalar(params.closerId);

  const where: Prisma.MembershipOpportunityWhereInput = {
    ...(status ? { status } : {}),
    ...(locationId ? { locationId } : {}),
    ...(closerId ? { proposedPrimaryCloserId: closerId } : {}),
    ...(search
      ? {
          OR: [
            { client: { firstName: { contains: search } } },
            { client: { lastName: { contains: search } } },
            { client: { phoneNormalized: { contains: search.replace(/\D/g, "") } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.membershipOpportunity.findMany({
      where,
      take,
      skip,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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

  return { rows: rowsWithDaysOpen, total, page, pageCount: Math.max(1, Math.ceil(total / take)) };
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

export async function getMembershipSales(params: Record<string, string | string[] | undefined>) {
  const prisma = getPrisma();
  const month = scalar(params.month) || monthKey();
  const locationId = scalar(params.locationId);
  const primaryId = scalar(params.primaryId);
  const supportId = scalar(params.supportId);
  const firstVisit = scalar(params.firstVisit);
  const approvalStatus = scalar(params.approvalStatus);

  return prisma.membershipSale.findMany({
    where: {
      ...saleMonthWhere(month),
      ...(locationId ? { locationId } : {}),
      ...(primaryId ? { finalPrimaryCloserId: primaryId } : {}),
      ...(supportId ? { finalSupportCloserId: supportId } : {}),
      ...(firstVisit ? { isFirstVisitSale: firstVisit === "true" } : {}),
      ...(approvalStatus ? { approvalStatus } : {}),
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

export async function getCommissionSummary(month = monthKey()) {
  const prisma = getPrisma();
  const [creditInputs, staff, settingsRows, pendingSplits, openOpportunities] = await Promise.all([
    getSaleCreditInputs(month),
    prisma.staff.findMany({ where: { active: true }, orderBy: { displayName: "asc" } }),
    prisma.commissionSetting.findMany(),
    prisma.membershipSale.findMany({
      where: { ...saleMonthWhere(month), approvalStatus: "PENDING_SPLIT_APPROVAL" },
      include: { finalPrimaryCloser: true, finalSupportCloser: true },
    }),
    prisma.membershipOpportunity.findMany({ where: { status: "OPEN" } }),
  ]);

  const settings = settingsFromRows(settingsRows);
  const results = calculateCommissionByStaff(filterCreditsForMonth(creditInputs, month), settings);

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
      where: { ...saleMonthWhere(month), approvalStatus: "PENDING_SPLIT_APPROVAL" },
      include: { opportunity: { include: { client: true } }, finalPrimaryCloser: true, finalSupportCloser: true },
    }),
    prisma.membershipOpportunity.findMany({ where: { status: "DISPUTED" }, include: { client: true } }),
    prisma.membershipOpportunity.findMany({ where: { status: "INVALID" }, include: { client: true } }),
  ]);

  return { period, summary, pendingSplits, disputes, invalids };
}

export async function getAdminData() {
  const prisma = getPrisma();
  const [users, staff, locations, membershipTypes, settings, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { displayName: "asc" }] }),
    prisma.staff.findMany({ orderBy: { displayName: "asc" } }),
    prisma.location.findMany({ orderBy: { code: "asc" } }),
    prisma.membershipType.findMany({ orderBy: { name: "asc" } }),
    prisma.commissionSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.auditLog.findMany({ take: 30, orderBy: { createdAt: "desc" } }),
  ]);
  return { users, staff, locations, membershipTypes, settings, auditLogs };
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
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);
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
