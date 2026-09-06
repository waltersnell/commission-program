import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

type RouteProps = {
  params: Promise<{ month: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { month } = await params;
  const period = await getPrisma().commissionPeriod.findUnique({
    where: { month },
    include: { results: { include: { staff: true }, orderBy: { staff: { displayName: "asc" } } } },
  });

  if (!period || period.status !== "FINALIZED") {
    return NextResponse.json({ error: "Commission period is not finalized." }, { status: 404 });
  }

  const rows = [
    [
      "Staff name",
      "Commission month",
      "Full-sale equivalents",
      "Fractional credits",
      "Total credited memberships",
      "First-visit credits",
      "Base commission",
      "First-visit bonus",
      "Family Upgrade Spiffs",
      "Special Spiffs",
      "Adjustments",
      "Final commission",
      "Approval status",
    ],
    ...period.results.map((result) => [
      result.staff.displayName,
      displayMonth(period.month),
      String(result.fullSaleCount),
      result.splitCreditUnits.toString(),
      result.totalCredits.toString(),
      result.firstVisitCredits.toString(),
      cents(result.baseCommissionCents),
      cents(result.firstVisitBonusCents),
      cents(result.membershipSpiffCents),
      cents(result.specialSpiffCents),
      cents(result.adjustmentsCents),
      cents(result.finalCommissionCents),
      result.approvalStatus,
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="commission-${month}.csv"`,
    },
  });
}

function displayMonth(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function cents(value: number) {
  return (value / 100).toFixed(2);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
