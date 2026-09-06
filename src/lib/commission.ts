import { basisPointsToDecimalString, dateInputValue, monthKey } from "./format";

export const defaultCommissionSettings = {
  tier1UpperBasisPoints: 100000,
  tier1RateCents: 2500,
  tier2UpperBasisPoints: 200000,
  tier2RateCents: 3000,
  tier3RateCents: 4000,
  firstVisitBonusCents: 1000,
  familyUpgradeSpiffCents: 1000,
  primarySplitBasisPoints: 7000,
  supportSplitBasisPoints: 3000,
};

export type CommissionSettings = typeof defaultCommissionSettings;

export type CommissionCreditInput = {
  id: string;
  saleId: string;
  staffId: string;
  staffName?: string;
  saleDate: Date;
  saleCreatedAt: Date;
  creditBasisPoints: number;
  firstVisitCreditBasisPoints: number;
  payoutBasisPoints: number;
  fixedCommissionCents: number;
  approvalStatus: string;
  opportunityStatus: string;
};

export type StaffCommissionResult = {
  staffId: string;
  staffName?: string;
  fullSaleCount: number;
  splitCreditBasisPoints: number;
  totalCreditBasisPoints: number;
  firstVisitCreditBasisPoints: number;
  baseCommissionCents: number;
  firstVisitBonusCents: number;
  membershipSpiffCents: number;
  specialSpiffCents: number;
  adjustmentsCents: number;
  finalCommissionCents: number;
  currentTier: string;
  creditsToNextTierBasisPoints: number;
};

export type CommissionLineItem = {
  creditId: string;
  saleId: string;
  saleDate: Date;
  creditBasisPoints: number;
  payoutBasisPoints: number;
  firstVisitCreditBasisPoints: number;
  tierLabel: string;
  baseCommissionCents: number;
  firstVisitBonusCents: number;
  membershipSpiffCents: number;
  totalCommissionCents: number;
};

export function isFirstVisitSale(firstVisitDate: Date, membershipSaleDate: Date) {
  return dateInputValue(firstVisitDate) === dateInputValue(membershipSaleDate);
}

export function saleCloserAssignmentsChanged(
  sale: { finalPrimaryCloserId: string; finalSupportCloserId: string | null },
  primaryCloserId: string,
  supportCloserId: string | null,
) {
  return sale.finalPrimaryCloserId !== primaryCloserId || sale.finalSupportCloserId !== supportCloserId;
}

export function createSaleCredits(input: {
  saleId: string;
  primaryStaffId: string;
  supportStaffId?: string | null;
  isFirstVisitSale: boolean;
  fixedCommissionCents?: number;
  settings?: CommissionSettings;
}) {
  const settings = input.settings ?? defaultCommissionSettings;
  const isFixedCommission = input.fixedCommissionCents !== undefined;
  if (input.supportStaffId) {
    const primaryFixedCents = isFixedCommission
      ? Math.round((input.fixedCommissionCents ?? 0) * settings.primarySplitBasisPoints / 10000)
      : 0;
    const supportFixedCents = isFixedCommission ? (input.fixedCommissionCents ?? 0) - primaryFixedCents : 0;
    return [
      creditRow({
        saleId: input.saleId,
        staffId: input.primaryStaffId,
        creditBasisPoints: isFixedCommission ? 0 : settings.primarySplitBasisPoints,
        payoutBasisPoints: settings.primarySplitBasisPoints,
        isFirstVisit: input.isFirstVisitSale && !isFixedCommission,
        fixedCommissionCents: primaryFixedCents,
      }),
      creditRow({
        saleId: input.saleId,
        staffId: input.supportStaffId,
        creditBasisPoints: isFixedCommission ? 0 : settings.supportSplitBasisPoints,
        payoutBasisPoints: settings.supportSplitBasisPoints,
        isFirstVisit: input.isFirstVisitSale && !isFixedCommission,
        fixedCommissionCents: supportFixedCents,
      }),
    ];
  }

  return [creditRow({
    saleId: input.saleId,
    staffId: input.primaryStaffId,
    creditBasisPoints: isFixedCommission ? 0 : 10000,
    payoutBasisPoints: 10000,
    isFirstVisit: input.isFirstVisitSale && !isFixedCommission,
    fixedCommissionCents: input.fixedCommissionCents ?? 0,
  })];
}

export function calculateCommissionForStaff(
  staffId: string,
  credits: CommissionCreditInput[],
  settings: CommissionSettings = defaultCommissionSettings,
): StaffCommissionResult {
  const lineItems = calculateCommissionLineItemsForStaff(staffId, credits, settings);
  let totalCreditBasisPoints = 0;
  let firstVisitCreditBasisPoints = 0;
  let fullSaleCount = 0;
  let splitCreditBasisPoints = 0;
  let baseCommissionCents = 0;
  let firstVisitBonusCents = 0;
  let membershipSpiffCents = 0;

  for (const item of lineItems) {
    totalCreditBasisPoints += item.creditBasisPoints;
    firstVisitCreditBasisPoints += item.firstVisitCreditBasisPoints;
    baseCommissionCents += item.baseCommissionCents;
    firstVisitBonusCents += item.firstVisitBonusCents;
    membershipSpiffCents += item.membershipSpiffCents;
    if (item.creditBasisPoints === 10000) {
      fullSaleCount += 1;
    } else if (item.creditBasisPoints > 0) {
      splitCreditBasisPoints += item.creditBasisPoints;
    }
  }

  return {
    staffId,
    staffName: credits.find((credit) => credit.staffId === staffId)?.staffName,
    fullSaleCount,
    splitCreditBasisPoints,
    totalCreditBasisPoints,
    firstVisitCreditBasisPoints,
    baseCommissionCents,
    firstVisitBonusCents,
    membershipSpiffCents,
    specialSpiffCents: 0,
    adjustmentsCents: 0,
    finalCommissionCents: baseCommissionCents + firstVisitBonusCents + membershipSpiffCents,
    currentTier: currentTierLabel(totalCreditBasisPoints, settings),
    creditsToNextTierBasisPoints: creditsToNextTier(totalCreditBasisPoints, settings),
  };
}

export function calculateCommissionLineItemsForStaff(
  staffId: string,
  credits: CommissionCreditInput[],
  settings: CommissionSettings = defaultCommissionSettings,
): CommissionLineItem[] {
  const eligibleCredits = credits
    .filter((credit) => credit.staffId === staffId)
    .filter((credit) => credit.approvalStatus === "APPROVED")
    .filter((credit) => credit.opportunityStatus === "MEMBERSHIP_SOLD")
    .sort(sortCreditsChronologically);
  let consumedBasisPoints = 0;

  return eligibleCredits.map((credit) => {
    let remaining = credit.creditBasisPoints;
    let baseCommissionCents = 0;
    const tierLabels = new Set<string>();
    while (remaining > 0) {
      const tier = tierForConsumedCredits(consumedBasisPoints, settings);
      const chunk = Math.min(remaining, tier.remainingBasisPoints);
      tierLabels.add(tier.label);
      baseCommissionCents += prorateCents(chunk, tier.rateCents);
      consumedBasisPoints += chunk;
      remaining -= chunk;
    }
    const firstVisitBonusCents = prorateCents(credit.firstVisitCreditBasisPoints, settings.firstVisitBonusCents);
    const membershipSpiffCents = credit.fixedCommissionCents;
    return {
      creditId: credit.id,
      saleId: credit.saleId,
      saleDate: credit.saleDate,
      creditBasisPoints: credit.creditBasisPoints,
      payoutBasisPoints: credit.payoutBasisPoints,
      firstVisitCreditBasisPoints: credit.firstVisitCreditBasisPoints,
      tierLabel: tierLabels.size > 0 ? Array.from(tierLabels).join(" / ") : "Not tier eligible",
      baseCommissionCents,
      firstVisitBonusCents,
      membershipSpiffCents,
      totalCommissionCents: baseCommissionCents + firstVisitBonusCents + membershipSpiffCents,
    };
  });
}

export function calculateCommissionByStaff(
  credits: CommissionCreditInput[],
  settings: CommissionSettings = defaultCommissionSettings,
) {
  const staffIds = Array.from(new Set(credits.map((credit) => credit.staffId))).sort();
  return staffIds.map((staffId) => calculateCommissionForStaff(staffId, credits, settings));
}

export function filterCreditsForMonth(credits: CommissionCreditInput[], month = monthKey()) {
  return credits.filter((credit) => monthKey(credit.saleDate) === month);
}

export function sumCreditBasisPoints(credits: Pick<CommissionCreditInput, "creditBasisPoints">[]) {
  return credits.reduce((total, credit) => total + credit.creditBasisPoints, 0);
}

export function settingsFromRows(rows: { key: string; value: string }[]): CommissionSettings {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    tier1UpperBasisPoints: Number(byKey["tier1.upperCredits"] ?? 10) * 10000,
    tier1RateCents: Number(byKey["tier1.rateCents"] ?? 2500),
    tier2UpperBasisPoints: Number(byKey["tier2.upperCredits"] ?? 20) * 10000,
    tier2RateCents: Number(byKey["tier2.rateCents"] ?? 3000),
    tier3RateCents: Number(byKey["tier3.rateCents"] ?? 4000),
    firstVisitBonusCents: Number(byKey["firstVisitBonusCents"] ?? 1000),
    familyUpgradeSpiffCents: Number(byKey["familyUpgradeSpiffCents"] ?? 1000),
    primarySplitBasisPoints: Number(byKey["primarySplitBasisPoints"] ?? 7000),
    supportSplitBasisPoints: Number(byKey["supportSplitBasisPoints"] ?? 3000),
  };
}

export function assertCanEditPeriod(role: string, periodStatus?: string) {
  if (periodStatus !== "FINALIZED") {
    return true;
  }
  return role === "ADMINISTRATOR";
}

function creditRow(input: {
  saleId: string;
  staffId: string;
  creditBasisPoints: number;
  payoutBasisPoints: number;
  isFirstVisit: boolean;
  fixedCommissionCents: number;
}) {
  return {
    saleId: input.saleId,
    staffId: input.staffId,
    creditBasisPoints: input.creditBasisPoints,
    creditUnits: basisPointsToDecimalString(input.creditBasisPoints),
    firstVisitCreditUnits: basisPointsToDecimalString(input.isFirstVisit ? input.creditBasisPoints : 0),
    payoutBasisPoints: input.payoutBasisPoints,
    fixedCommissionCents: input.fixedCommissionCents,
  };
}

function sortCreditsChronologically(a: CommissionCreditInput, b: CommissionCreditInput) {
  return (
    a.saleDate.getTime() - b.saleDate.getTime() ||
    a.saleCreatedAt.getTime() - b.saleCreatedAt.getTime() ||
    a.saleId.localeCompare(b.saleId)
  );
}

function tierForConsumedCredits(consumedBasisPoints: number, settings: CommissionSettings) {
  if (consumedBasisPoints < settings.tier1UpperBasisPoints) {
    return {
      label: "Tier 1",
      remainingBasisPoints: settings.tier1UpperBasisPoints - consumedBasisPoints,
      rateCents: settings.tier1RateCents,
    };
  }
  if (consumedBasisPoints < settings.tier2UpperBasisPoints) {
    return {
      label: "Tier 2",
      remainingBasisPoints: settings.tier2UpperBasisPoints - consumedBasisPoints,
      rateCents: settings.tier2RateCents,
    };
  }
  return {
    label: "Tier 3",
    remainingBasisPoints: Number.MAX_SAFE_INTEGER,
    rateCents: settings.tier3RateCents,
  };
}

function prorateCents(creditBasisPoints: number, rateCents: number) {
  return Math.round((creditBasisPoints * rateCents) / 10000);
}

function currentTierLabel(totalBasisPoints: number, settings: CommissionSettings) {
  if (totalBasisPoints < settings.tier1UpperBasisPoints) {
    return "Tier 1";
  }
  if (totalBasisPoints < settings.tier2UpperBasisPoints) {
    return "Tier 2";
  }
  return "Tier 3";
}

function creditsToNextTier(totalBasisPoints: number, settings: CommissionSettings) {
  if (totalBasisPoints < settings.tier1UpperBasisPoints) {
    return settings.tier1UpperBasisPoints - totalBasisPoints;
  }
  if (totalBasisPoints < settings.tier2UpperBasisPoints) {
    return settings.tier2UpperBasisPoints - totalBasisPoints;
  }
  return 0;
}
