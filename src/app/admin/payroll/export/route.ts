import { NextResponse } from "next/server";
import { getPayrollReport } from "@/lib/data";
import { dateInputValue } from "@/lib/format";
import { parsePayrollRange } from "@/lib/payroll";
import { canAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAdmin(user.role)) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const url = new URL(request.url);
  const parsed = parsePayrollRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("until") ?? undefined);
  if (!parsed.range) {
    return NextResponse.json({ error: parsed.error ?? "Select a payroll period." }, { status: 400 });
  }
  const report = await getPayrollReport(parsed.range);
  const rows = [[
    "Commissioned member", "Role", "Active", "Transaction type", "Client", "Date", "Location", "Description",
    "Approval status", "Share percent", "Tier", "Tier credits", "Base commission", "First-visit bonus",
    "Family Upgrade", "Amount", "Approved payable", "Pending estimate", "Rejected excluded",
  ]];
  for (const person of report.staff) {
    for (const item of person.membershipItems) {
      rows.push([
        person.staffName, person.staffRole, person.active ? "Yes" : "No", "Membership", item.clientName,
        displayDate(item.date), item.locationCode, item.membershipType, item.approvalStatus,
        (item.payoutBasisPoints / 100).toFixed(2), item.tierLabel, (item.creditBasisPoints / 10000).toFixed(4),
        cents(item.baseCommissionCents), cents(item.firstVisitBonusCents), cents(item.membershipSpiffCents), cents(item.amountCents),
        item.approvalStatus === "APPROVED" ? cents(item.amountCents) : "0.00",
        item.approvalStatus === "PENDING" ? cents(item.amountCents) : "0.00",
        item.approvalStatus === "REJECTED" ? cents(item.amountCents) : "0.00",
      ]);
    }
    for (const item of person.specialSpiffItems) {
      rows.push([
        person.staffName, person.staffRole, person.active ? "Yes" : "No", "Special Spiff", item.clientName,
        displayDate(item.date), item.locationCode, `${item.spiffName}: ${item.functionDescription}`, item.approvalStatus,
        "100.00", "Not tier eligible", "0.0000", "0.00", "0.00", "0.00", cents(item.amountCents),
        item.approvalStatus === "APPROVED" ? cents(item.amountCents) : "0.00",
        item.approvalStatus === "PENDING" ? cents(item.amountCents) : "0.00",
        item.approvalStatus === "REJECTED" ? cents(item.amountCents) : "0.00",
      ]);
    }
  }
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payroll-${parsed.range.from}-to-${parsed.range.until}.csv"`,
    },
  });
}

function displayDate(date: Date) {
  const [year, month, day] = dateInputValue(date).split("-");
  return `${day}/${month}/${year}`;
}

function cents(value: number) {
  return (value / 100).toFixed(2);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
