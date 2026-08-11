import { basisPointsToDecimalString, dateInputValue, monthKey } from "./format";

export const defaultCommissionSettings = {
  tier1UpperBasisPoints: 100000,
  tier1RateCents: 2500,
  tier2UpperBasisPoints: 200000,
  tier2RateCents: 3000,
  tier3RateCents: 4000,
  firstVisitBonusCents: 1000,
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
  adjustmentsCents: number;
  finalCommissionCents: number;
  currentTier: string;
  creditsToNextTierBasisPoints: number;
};

export function isFirstVisitSale(firstVisitDate: Date, membershipSaleDate: Date) {
  return dateInputValue(firstVisitDate) === dateInputValue(membershipSaleDate);
}

export function createSaleCredits(input: {
  saleId: string;
  primaryStaffId: string;
  supportStaffId?: string | null;
  isFirstVisitSale: boolean;
  settings?: CommissionSettings;
}) {
  const settings = input.settings ?? defaultCommissionSettings;
  if (input.supportStaffId) {
    return [
      creditRow(input.saleId, input.primaryStaffId, settings.primarySplitBasisPoints, input.isFirstVisitSale),
      creditRow(input.saleId, input.supportStaffId, settings.supportSplitBasisPoints, input.isFirstVisitSale),
    ];
  }

  return [creditRow(input.saleId, input.primaryStaffId, 10000, input.isFirstVisitSale)];
}

export function calculateCommissionForStaff(
  staffId: string,
  credits: CommissionCreditInput[],
  settings: CommissionSettings = defaultCommissionSettings,
): StaffCommissionResult {
  const eligibleCredits = credits
    .filter((credit) => credit.staffId === staffId)
    .filter((credit) => credit.approvalStatus === "APPROVED")
    .filter((credit) => credit.opportunityStatus === "MEMBERSHIP_SOLD")
    .sort(sortCreditsChronologically);

  let consumedBasisPoints = 0;
  let baseCommissionCents = 0;
  let totalCreditBasisPoints = 0;
  let firstVisitCreditBasisPoints = 0;
  let fullSaleCount = 0;
  let splitCreditBasisPoints = 0;

  for (const credit of eligibleCredits) {
    totalCreditBasisPoints += credit.creditBasisPoints;
    firstVisitCreditBasisPoints += credit.firstVisitCreditBasisPoints;
    if (credit.creditBasisPoints === 10000) {
      fullSaleCount += 1;
    } else {
      splitCreditBasisPoints += credit.creditBasisPoints;
    }

    let remaining = credit.creditBasisPoints;
    while (remaining > 0) {
      const tier = tierForConsumedCredits(consumedBasisPoints, settings);
      const chunk = Math.min(remaining, tier.remainingBasisPoints);
      baseCommissionCents += prorateCents(chunk, tier.rateCents);
      consumedBasisPoints += chunk;
      remaining -= chunk;
    }
  }

  const firstVisitBonusCents = prorateCents(firstVisitCreditBasisPoints, settings.firstVisitBonusCents);

  return {
    staffId,
    staffName: eligibleCredits[0]?.staffName,
    fullSaleCount,
    splitCreditBasisPoints,
    totalCreditBasisPoints,
    firstVisitCreditBasisPoints,
    baseCommissionCents,
    firstVisitBonusCents,
    adjustmentsCents: 0,
    finalCommissionCents: baseCommissionCents + firstVisitBonusCents,
    currentTier: currentTierLabel(totalCreditBasisPoints, settings),
    creditsToNextTierBasisPoints: creditsToNextTier(totalCreditBasisPoints, settings),
  };
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

function creditRow(saleId: string, staffId: string, basisPoints: number, isFirstVisit: boolean) {
  return {
    saleId,
    staffId,
    creditBasisPoints: basisPoints,
    creditUnits: basisPointsToDecimalString(basisPoints),
    firstVisitCreditUnits: basisPointsToDecimalString(isFirstVisit ? basisPoints : 0),
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
      remainingBasisPoints: settings.tier1UpperBasisPoints - consumedBasisPoints,
      rateCents: settings.tier1RateCents,
    };
  }
  if (consumedBasisPoints < settings.tier2UpperBasisPoints) {
    return {
      remainingBasisPoints: settings.tier2UpperBasisPoints - consumedBasisPoints,
      rateCents: settings.tier2RateCents,
    };
  }
  return {
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
