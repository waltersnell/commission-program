import { describe, expect, it } from "vitest";
import {
  assertCanEditPeriod,
  calculateCommissionByStaff,
  calculateCommissionForStaff,
  createSaleCredits,
  isFirstVisitSale,
  type CommissionCreditInput,
} from "../src/lib/commission";
import { saleEntrySchema } from "../src/lib/validation";
import { clientEntrySchema } from "../src/lib/validation";
import { toLocalDate } from "../src/lib/format";

const staffId = "staff-a";

function credit(input: Partial<CommissionCreditInput> & { creditBasisPoints?: number; index?: number } = {}): CommissionCreditInput {
  const index = input.index ?? 1;
  const saleDate = input.saleDate ?? toLocalDate(`2026-07-${String(index).padStart(2, "0")}`);
  return {
    id: `credit-${index}`,
    saleId: input.saleId ?? `sale-${String(index).padStart(3, "0")}`,
    staffId: input.staffId ?? staffId,
    saleDate,
    saleCreatedAt: input.saleCreatedAt ?? new Date(`${saleDate.toISOString().slice(0, 10)}T12:00:00`),
    creditBasisPoints: input.creditBasisPoints ?? 10000,
    firstVisitCreditBasisPoints: input.firstVisitCreditBasisPoints ?? 0,
    approvalStatus: input.approvalStatus ?? "APPROVED",
    opportunityStatus: input.opportunityStatus ?? "MEMBERSHIP_SOLD",
  };
}

function credits(count: number) {
  return Array.from({ length: count }, (_, index) => credit({ index: index + 1 }));
}

describe("commission calculations", () => {
  it("calculates ten full sales as $250 base commission", () => {
    expect(calculateCommissionForStaff(staffId, credits(10)).baseCommissionCents).toBe(25000);
  });

  it("calculates twelve full sales as $310 base commission", () => {
    expect(calculateCommissionForStaff(staffId, credits(12)).baseCommissionCents).toBe(31000);
  });

  it("calculates twenty full sales as $550 base commission", () => {
    expect(calculateCommissionForStaff(staffId, credits(20)).baseCommissionCents).toBe(55000);
  });

  it("calculates thirty full sales as $950 base commission", () => {
    expect(calculateCommissionForStaff(staffId, credits(30)).baseCommissionCents).toBe(95000);
  });

  it("adds $50 for five first-visit sales", () => {
    const result = calculateCommissionForStaff(
      staffId,
      credits(5).map((item) => ({ ...item, firstVisitCreditBasisPoints: 10000 })),
    );
    expect(result.firstVisitBonusCents).toBe(5000);
  });

  it("splits a first-visit bonus 70/30 into $7 and $3", () => {
    const rows = createSaleCredits({
      saleId: "sale-split",
      primaryStaffId: "primary",
      supportStaffId: "support",
      isFirstVisitSale: true,
    });

    const results = calculateCommissionByStaff(
      rows.map((row, index) =>
        credit({
          id: `credit-split-${index}`,
          saleId: row.saleId,
          staffId: row.staffId,
          creditBasisPoints: row.creditBasisPoints,
          firstVisitCreditBasisPoints: row.creditBasisPoints,
        }),
      ),
    );

    expect(results.find((result) => result.staffId === "primary")?.firstVisitBonusCents).toBe(700);
    expect(results.find((result) => result.staffId === "support")?.firstVisitBonusCents).toBe(300);
  });

  it("uses fractional credits when crossing progressive tiers", () => {
    const result = calculateCommissionForStaff(staffId, [
      ...credits(9),
      credit({ index: 10, creditBasisPoints: 7000 }),
      credit({ index: 11, creditBasisPoints: 7000 }),
    ]);

    expect(result.totalCreditBasisPoints).toBe(104000);
    expect(result.baseCommissionCents).toBe(26200);
  });

  it("marks a sale on first visit as first-visit eligible", () => {
    expect(isFirstVisitSale(toLocalDate("2026-07-12"), toLocalDate("2026-07-12"))).toBe(true);
  });

  it("does not mark a later sale as first-visit eligible", () => {
    expect(isFirstVisitSale(toLocalDate("2026-07-12"), toLocalDate("2026-07-13"))).toBe(false);
  });

  it("does not count open opportunities toward commission", () => {
    const result = calculateCommissionForStaff(staffId, [credit({ opportunityStatus: "OPEN" })]);
    expect(result.finalCommissionCents).toBe(0);
  });

  it("does not count invalid sales toward commission", () => {
    const result = calculateCommissionForStaff(staffId, [credit({ opportunityStatus: "INVALID" })]);
    expect(result.finalCommissionCents).toBe(0);
  });

  it("does not count pending split approvals in final commission results", () => {
    const result = calculateCommissionForStaff(staffId, [credit({ approvalStatus: "PENDING_SPLIT_APPROVAL" })]);
    expect(result.finalCommissionCents).toBe(0);
  });

  it("produces the same result when recalculated repeatedly", () => {
    const input = [...credits(12), credit({ index: 13, creditBasisPoints: 3000, firstVisitCreditBasisPoints: 3000 })];
    expect(calculateCommissionForStaff(staffId, input)).toEqual(calculateCommissionForStaff(staffId, input));
  });
});

describe("validation and locking", () => {
  it("rejects support closer matching primary closer", () => {
    const result = saleEntrySchema.safeParse({
      opportunityId: "opp",
      membershipSaleDate: "2026-07-12",
      membershipTypeId: "membership",
      finalPrimaryCloserId: "staff",
      finalSupportCloserId: "staff",
    });
    expect(result.success).toBe(false);
  });

  it("requires an other session name when Other is selected", () => {
    const result = clientEntrySchema.safeParse({
      firstName: "Test",
      lastName: "Client",
      phone: "858-555-1212",
      email: "",
      firstVisitDate: "2026-07-12",
      sessionType: "Other",
      sessionOther: "",
      clientType: "Resident",
      primaryIssue: "Acute Pain",
      locationId: "location",
      firstVisitTherapistId: "therapist",
      interestLevel: "Warm",
      proposedPrimaryCloserId: "staff-a",
      proposedSupportCloserId: "",
      notes: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a listed session without an other session name", () => {
    const result = clientEntrySchema.safeParse({
      firstName: "Test",
      lastName: "Client",
      phone: "858-555-1212",
      email: "test@example.com",
      firstVisitDate: "2026-07-12",
      sessionType: "Thai Sport",
      sessionOther: "",
      clientType: "Tourist",
      primaryIssue: "Maintenance",
      locationId: "location",
      firstVisitTherapistId: "therapist",
      interestLevel: "Hot",
      proposedPrimaryCloserId: "staff-a",
      proposedSupportCloserId: "",
      notes: "",
    });

    expect(result.success).toBe(true);
  });

  it("prevents Front Desk users from editing finalized months", () => {
    expect(assertCanEditPeriod("FRONT_DESK", "FINALIZED")).toBe(false);
    expect(assertCanEditPeriod("ADMINISTRATOR", "FINALIZED")).toBe(true);
  });
});
