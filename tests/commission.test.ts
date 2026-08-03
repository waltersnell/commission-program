import { describe, expect, it } from "vitest";
import {
  assertCanEditPeriod,
  calculateCommissionByStaff,
  calculateCommissionForStaff,
  createSaleCredits,
  isFirstVisitSale,
  type CommissionCreditInput,
} from "../src/lib/commission";
import { clientEntrySchema, opportunityCloserSchema, saleEntrySchema } from "../src/lib/validation";
import { currentDateInputValue, currentMonthKey, dateInputValue, formatDateTime, monthRange, toLocalDate } from "../src/lib/format";
import { getNextActionAfterCompletion, getOpportunityNextAction } from "../src/lib/opportunity-next-action";
import { summarizePendingSalesByStaff } from "../src/lib/data";
import { getNavItems, isActivePath } from "../src/lib/navigation";
import { staffMatchesUser } from "../src/lib/current-staff";

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

  it("does not count pending approvals in final commission results", () => {
    const result = calculateCommissionForStaff(staffId, [credit({ approvalStatus: "PENDING" })]);
    expect(result.finalCommissionCents).toBe(0);
  });

  it("produces the same result when recalculated repeatedly", () => {
    const input = [...credits(12), credit({ index: 13, creditBasisPoints: 3000, firstVisitCreditBasisPoints: 3000 })];
    expect(calculateCommissionForStaff(staffId, input)).toEqual(calculateCommissionForStaff(staffId, input));
  });
});

describe("Pacific business dates", () => {
  it("keeps the Pacific calendar date when UTC has rolled to tomorrow", () => {
    const latePacific = new Date("2026-08-02T05:30:00.000Z");

    expect(currentDateInputValue(latePacific)).toBe("2026-08-01");
    expect(currentMonthKey(latePacific)).toBe("2026-08");
  });

  it("keeps stored date-only values stable across server timezones", () => {
    expect(toLocalDate("2026-08-01").toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(dateInputValue(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
  });

  it("builds month ranges from stored date-only calendar boundaries", () => {
    const range = monthRange("2026-08");

    expect(range.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("displays timestamps in Pacific time", () => {
    expect(formatDateTime(new Date("2026-08-02T05:30:00.000Z"))).toContain("Aug 1, 2026");
  });
});

describe("month-end pending review", () => {
  it("summarizes pending memberships by credited staff", () => {
    const pending = summarizePendingSalesByStaff([
      {
        id: "sale-one",
        isFirstVisitSale: true,
        credits: [
          { staffId: "betsy", creditBasisPoints: 7000, staff: { displayName: "Betsy" } },
          { staffId: "dennis", creditBasisPoints: 3000, staff: { displayName: "Dennis" } },
        ],
      },
      {
        id: "sale-two",
        isFirstVisitSale: false,
        credits: [
          { staffId: "betsy", creditBasisPoints: 10000, staff: { displayName: "Betsy" } },
        ],
      },
    ]);

    expect(pending).toEqual([
      {
        staffId: "betsy",
        staffName: "Betsy",
        pendingMembershipCount: 2,
        pendingCreditBasisPoints: 17000,
        pendingFirstVisitCreditBasisPoints: 7000,
      },
      {
        staffId: "dennis",
        staffName: "Dennis",
        pendingMembershipCount: 1,
        pendingCreditBasisPoints: 3000,
        pendingFirstVisitCreditBasisPoints: 3000,
      },
    ]);
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

  it("rejects a secondary closer matching the primary closer", () => {
    const result = opportunityCloserSchema.safeParse({
      opportunityId: "opp",
      proposedPrimaryCloserId: "staff",
      proposedSupportCloserId: "staff",
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
      collectedBy: "Primary Closer",
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
      collectedBy: "Primary Closer",
      notes: "",
    });

    expect(result.success).toBe(true);
  });

  it("prevents Front Desk users from editing finalized months", () => {
    expect(assertCanEditPeriod("FRONT_DESK", "FINALIZED")).toBe(false);
    expect(assertCanEditPeriod("ADMINISTRATOR", "FINALIZED")).toBe(true);
  });
});

describe("role navigation", () => {
  it("gives managers Month-End access without Admin", () => {
    const labels = getNavItems("MANAGER").map((item) => item.label);

    expect(labels).toContain("Month-End");
    expect(labels).not.toContain("Admin");
  });

  it("keeps Admin visible only to administrators", () => {
    expect(getNavItems("ADMINISTRATOR").map((item) => item.label)).toContain("Admin");
    expect(getNavItems("FRONT_DESK").map((item) => item.label)).not.toContain("Month-End");
  });

  it("marks nested opportunity routes active without marking Dashboard active", () => {
    expect(isActivePath("/opportunities/client-1", "/opportunities")).toBe(true);
    expect(isActivePath("/opportunities/client-1", "/")).toBe(false);
    expect(isActivePath("/", "/")).toBe(true);
  });
});

describe("closer eligibility", () => {
  it("matches an administrator user to an existing staff record by first name", () => {
    expect(staffMatchesUser(
      { displayName: "Lawani", firstName: "Lawani" },
      { displayName: "Lawani N", username: "lawani@thaisportusa.com", email: "lawani@thaisportusa.com", role: "ADMINISTRATOR" },
    )).toBe(true);
  });

  it("does not match a therapist user as a privileged closer", () => {
    expect(staffMatchesUser(
      { displayName: "Alice", firstName: "Alice" },
      { displayName: "Alice", username: "alice@thaisportusa.com", email: "alice@thaisportusa.com", role: "THERAPIST" },
    )).toBe(false);
  });
});

describe("opportunity next actions", () => {
  it("sets Hot personal SMS due one day after first visit", () => {
    const action = getOpportunityNextAction({
      interestLevel: "Hot",
      firstVisitDate: toLocalDate("2026-07-12"),
    });

    expect(action?.label).toBe("Personal SMS");
    expect(action?.dueDate?.toISOString().slice(0, 10)).toBe("2026-07-13");
  });

  it("sets Warm personal SMS due two days after first visit", () => {
    const action = getOpportunityNextAction({
      interestLevel: "Warm",
      firstVisitDate: toLocalDate("2026-07-12"),
    });

    expect(action?.label).toBe("Personal SMS");
    expect(action?.dueDate?.toISOString().slice(0, 10)).toBe("2026-07-14");
  });

  it("advances a Hot completed personal SMS to phone outreach", () => {
    const next = getNextActionAfterCompletion({
      interestLevel: "Hot",
      firstVisitDate: toLocalDate("2026-07-12"),
    });

    expect(next.status).toBe("Phone Outreach");
    expect(next.dueDate?.toISOString().slice(0, 10)).toBe("2026-07-15");
  });
});
