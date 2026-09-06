import {
  calculateCommissionLineItemsForStaff,
  type CommissionCreditInput,
  type CommissionLineItem,
  type CommissionSettings,
} from "./commission";
import { addCalendarDays, dateInputValue, monthKey, monthRange, toLocalDate } from "./format";

export type PayrollRange = {
  from: string;
  until: string;
  start: Date;
  endExclusive: Date;
};

export type PayrollMembershipItem = {
  id: string;
  opportunityId: string;
  clientName: string;
  date: Date;
  month: string;
  locationCode: string;
  membershipType: string;
  approvalStatus: string;
  primaryCloser: string;
  supportCloser: string | null;
  payoutBasisPoints: number;
  tierLabel: string;
  creditBasisPoints: number;
  baseCommissionCents: number;
  firstVisitBonusCents: number;
  membershipSpiffCents: number;
  amountCents: number;
};

export type PayrollSpiffItem = {
  id: string;
  clientName: string;
  date: Date;
  month: string;
  locationCode: string;
  spiffName: string;
  functionDescription: string;
  approvalStatus: string;
  amountCents: number;
};

export type PayrollStaffReport = {
  staffId: string;
  staffName: string;
  staffRole: string;
  active: boolean;
  approvedCents: number;
  pendingCents: number;
  rejectedCents: number;
  reviewedCents: number;
  status: "READY" | "NEEDS_APPROVAL" | "NO_APPROVED_EARNINGS";
  membershipItems: PayrollMembershipItem[];
  specialSpiffItems: PayrollSpiffItem[];
};

export type PayrollReport = {
  range: PayrollRange;
  staff: PayrollStaffReport[];
  approvedCents: number;
  pendingCents: number;
  rejectedCents: number;
  reviewedCents: number;
  commissionedStaffCount: number;
  transactionCount: number;
};

export function parsePayrollRange(from?: string, until?: string): { range?: PayrollRange; error?: string } {
  if (!from && !until) {
    return {};
  }
  if (!from || !until) {
    return { error: "Select both payroll period dates." };
  }
  if (!isDateInput(from) || !isDateInput(until)) {
    return { error: "Enter valid payroll period dates." };
  }
  const start = toLocalDate(from);
  const untilDate = toLocalDate(until);
  if (untilDate.getTime() < start.getTime()) {
    return { error: "Payroll period until must be on or after payroll period from." };
  }
  return {
    range: {
      from,
      until,
      start,
      endExclusive: addCalendarDays(untilDate, 1),
    },
  };
}

export function payrollMonthKeys(range: PayrollRange) {
  const keys: string[] = [];
  let cursor = monthRange(monthKey(range.start)).start;
  while (cursor.getTime() < range.endExclusive.getTime()) {
    keys.push(monthKey(cursor));
    const current = monthRange(monthKey(cursor));
    cursor = current.end;
  }
  return keys;
}

export function isDateInPayrollRange(date: Date, range: PayrollRange) {
  const time = date.getTime();
  return time >= range.start.getTime() && time < range.endExclusive.getTime();
}

export function calculatePayrollMembershipItems(
  staffId: string,
  credits: CommissionCreditInput[],
  settings: CommissionSettings,
) {
  const calculations = new Map<string, CommissionLineItem>();
  const months = Array.from(new Set(credits.map((credit) => monthKey(credit.saleDate))));

  for (const month of months) {
    const monthlyCredits = credits.filter((credit) => monthKey(credit.saleDate) === month);
    const approved = calculationMap(calculateCommissionLineItemsForStaff(staffId, monthlyCredits, settings));
    const approvedAndPending = calculationMap(calculateCommissionLineItemsForStaff(
      staffId,
      monthlyCredits.map((credit) => credit.approvalStatus === "PENDING" ? { ...credit, approvalStatus: "APPROVED" } : credit),
      settings,
    ));
    const all = calculationMap(calculateCommissionLineItemsForStaff(
      staffId,
      monthlyCredits.map((credit) => ({ ...credit, approvalStatus: "APPROVED" })),
      settings,
    ));

    for (const credit of monthlyCredits.filter((item) => item.staffId === staffId)) {
      const calculation = credit.approvalStatus === "APPROVED"
        ? approved.get(credit.id)
        : credit.approvalStatus === "PENDING"
          ? approvedAndPending.get(credit.id)
          : all.get(credit.id);
      if (calculation) {
        calculations.set(credit.id, calculation);
      }
    }
  }

  return calculations;
}

function calculationMap(items: CommissionLineItem[]) {
  return new Map(items.map((item) => [item.creditId, item]));
}

function isDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = toLocalDate(value);
  return !Number.isNaN(parsed.getTime()) && dateInputValue(parsed) === value;
}
