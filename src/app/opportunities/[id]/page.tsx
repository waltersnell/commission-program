import { notFound } from "next/navigation";
import { closeOpportunityAction, recordSaleAction, updateOpportunityClosersAction } from "@/app/actions";
import { getFormOptions, getOpportunity } from "@/lib/data";
import { currentDateInputValue, dateInputValue, displayStatus, formatBasisPointsPercent, formatDateTime } from "@/lib/format";
import { canManage } from "@/lib/roles";
import { displayClientSession } from "@/lib/session-options";
import { getCurrentUser } from "@/lib/session";
import { getOpportunityNextAction } from "@/lib/opportunity-next-action";
import { NextActionCard } from "./next-action-card";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpportunityDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [opportunity, options, user] = await Promise.all([getOpportunity(id), getFormOptions(), getCurrentUser()]);
  if (!opportunity) {
    notFound();
  }

  const error = scalar(query.error);
  const taskCompleted = scalar(query.task) === "completed";
  const saleRecorded = scalar(query.sale) === "1";
  const closed = scalar(query.closed) === "1";
  const updated = scalar(query.updated) === "1";
  const canClose = canManage(user?.role ?? "");
  const nextAction = getOpportunityNextAction({
    interestLevel: opportunity.interestLevel,
    firstVisitDate: opportunity.client.firstVisitDate,
    followUpStatus: opportunity.followUpStatus,
    nextFollowUpDate: opportunity.nextFollowUpDate,
  });
  const smsMessage = buildPersonalSms({
    clientFirstName: opportunity.client.firstName,
    firstVisitDate: dateInputValue(opportunity.client.firstVisitDate),
    therapistName: opportunity.firstVisitTherapist?.displayName ?? "your therapist",
    primaryIssue: opportunity.client.primaryIssue ?? "primary issue",
    userName: user?.displayName ?? "Thai Sport",
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{opportunity.client.firstName} {opportunity.client.lastName}</h1>
          <p className="text-[var(--text-muted)]">{opportunity.location.name} - {opportunity.client.phoneDisplay}</p>
        </div>
        <span className="badge badge-orange">{opportunity.interestLevel}</span>
      </div>
      {error ? <p className="message border-[var(--orange)]">{error}</p> : null}
      {taskCompleted ? <p className="message border-[var(--teal)]">Task completed. The next action is updated.</p> : null}
      {saleRecorded ? <p className="message border-[var(--teal)]">Membership sale recorded and sent for approval.</p> : null}
      {closed ? <p className="message border-[var(--teal)]">Opportunity closed.</p> : null}
      {updated ? <p className="message border-[var(--teal)]">Closer assignments updated.</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="section-title mb-3">Client Information</h2>
          <dl className="space-y-2 text-sm">
            <Row label="First visit" value={dateInputValue(opportunity.client.firstVisitDate)} />
            <Row label="Session" value={displayClientSession(opportunity.client.sessionType, opportunity.client.sessionOther)} />
            <Row label="Client type" value={opportunity.client.clientType ?? "-"} />
            <Row label="Primary issue" value={opportunity.client.primaryIssue ?? "-"} />
            <Row label="Therapist" value={opportunity.firstVisitTherapist?.displayName ?? "-"} />
            <Row label="Interest level" value={opportunity.interestLevel} />
            <Row label="Email" value={opportunity.client.email ?? "-"} />
            <Row label="Status" value={displayStatus(opportunity.status)} />
            <Row label="Primary" value={opportunity.proposedPrimaryCloser.displayName} />
            <Row label="Support" value={opportunity.proposedSupportCloser?.displayName ?? "-"} />
            <Row label="Collected By" value={opportunity.collectedBy} />
            <Row label="Submitted" value={formatDateTime(opportunity.intakeSubmittedAt ?? opportunity.createdAt)} />
            <Row label="Collection notes" value={opportunity.client.notes ?? "-"} />
          </dl>
        </div>

        <div className="grid gap-4 lg:col-span-2">
          {nextAction ? (
            <NextActionCard
              opportunityId={opportunity.id}
              actionLabel={nextAction.label}
              dueDate={nextAction.dueDate ? dateInputValue(nextAction.dueDate) : null}
              isLate={nextAction.isLate}
              canComplete={nextAction.canComplete}
              defaultMessage={smsMessage}
            />
          ) : null}

          {!opportunity.sale && opportunity.status === "OPEN" ? (
            <div className="card p-4">
              <h2 className="section-title mb-3">Opportunity Assignment</h2>
              <form action={updateOpportunityClosersAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Primary closer</span>
                  <select className="field" name="proposedPrimaryCloserId" defaultValue={opportunity.proposedPrimaryCloserId} required>
                    {options.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Secondary closer</span>
                  <select className="field" name="proposedSupportCloserId" defaultValue={opportunity.proposedSupportCloserId ?? ""}>
                    <option value="">None</option>
                    {options.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <button className="button-primary" type="submit">Save assignment</button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="card p-4">
            <h2 className="section-title mb-3">Membership Sale</h2>
            {opportunity.sale ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Row label="Sale date" value={dateInputValue(opportunity.sale.membershipSaleDate)} />
                <Row label="Membership type" value={opportunity.sale.membershipType.name} />
                <Row label="Primary closer" value={opportunity.sale.finalPrimaryCloser.displayName} />
                <Row label="Support closer" value={opportunity.sale.finalSupportCloser?.displayName ?? "-"} />
                <Row label="First-visit sale" value={opportunity.sale.isFirstVisitSale ? "Yes" : "No"} />
                <Row label="Approval" value={displayStatus(opportunity.sale.approvalStatus)} />
                <Row label="Recorded" value={formatDateTime(opportunity.sale.createdAt)} />
                <div className="md:col-span-2">
                  <p className="mb-1 text-sm font-semibold text-[var(--text-muted)]">Credits</p>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.sale.credits.map((credit) => (
                      <span key={credit.id} className="badge badge-teal">
                        {credit.staff.displayName}: {formatBasisPointsPercent(credit.creditBasisPoints)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <form action={recordSaleAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="opportunityId" value={opportunity.id} />
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Membership sale date</span>
                  <input className="field" type="date" name="membershipSaleDate" defaultValue={currentDateInputValue(new Date())} required />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Membership type</span>
                  <select className="field" name="membershipTypeId" required>
                    {options.membershipTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Final primary closer</span>
                  <select className="field" name="finalPrimaryCloserId" defaultValue={opportunity.proposedPrimaryCloserId} required>
                    {options.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-semibold">Final support closer</span>
                  <select className="field" name="finalSupportCloserId" defaultValue={opportunity.proposedSupportCloserId ?? ""}>
                    <option value="">None</option>
                    {options.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 md:col-span-2">
                  <span className="text-sm font-semibold">Sale notes</span>
                  <textarea className="field min-h-24" name="notes" />
                </label>
                <div className="md:col-span-2">
                  <button className="button-accent" type="submit">Record membership sale</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {canClose && !opportunity.sale ? (
        <section className="card p-4">
          <h2 className="section-title mb-3">Close Without Sale</h2>
          <form action={closeOpportunityAction} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <select className="field" name="closureReason" required>
              <option value="">Closure reason</option>
              {["CLIENT_DECLINED", "UNABLE_TO_REACH", "NOT_A_GOOD_FIT", "DUPLICATE_RECORD", "MEMBERSHIP_ALREADY_ACTIVE", "INVALID_ENTRY", "OTHER"].map((reason) => (
                <option key={reason} value={reason}>{displayStatus(reason)}</option>
              ))}
            </select>
            <input className="field" name="closureNote" placeholder="Optional note" />
            <button className="button-danger" type="submit">Close opportunity</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-[var(--text-muted)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPersonalSms({
  clientFirstName,
  firstVisitDate,
  therapistName,
  primaryIssue,
  userName,
}: {
  clientFirstName: string;
  firstVisitDate: string;
  therapistName: string;
  primaryIssue: string;
  userName: string;
}) {
  return `${clientFirstName}, Thank you for trying Thai Sport Bodyworks on ${firstVisitDate} with ${therapistName} to help your ${primaryIssue}. Our goal at Thai Sport is to meet your lifestyle goals and no-one can do it better since SmartCare can tell you and us, what your body really needs to reach those goals. If you have any questions about how SmartCare can make the difference, please review our SmartCare FAQ.\n\nBest ${userName}.`;
}
