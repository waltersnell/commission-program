import { updateClientRecordAction } from "@/app/actions";
import { getClientLookupData, getFormOptions } from "@/lib/data";
import { dateInputValue, displayStatus } from "@/lib/format";
import {
  collectedByOptions,
  firstTimeClientSessions,
  firstTimeClientTypes,
  firstTimePrimaryIssues,
  interestLevels,
  nextActionOptions,
} from "@/lib/session-options";
import { DeleteClientRecordButton } from "./delete-client-record-button";

type ClientRecord = NonNullable<Awaited<ReturnType<typeof getClientLookupData>>["selected"]>;
type FormOptions = Awaited<ReturnType<typeof getFormOptions>>;

export function ClientRecordEditor({ client, options }: { client: ClientRecord; options: FormOptions }) {
  const opportunity = client.opportunity;
  if (!opportunity) {
    return <p className="empty-state">This client has no opportunity record to edit.</p>;
  }

  return (
    <div className="space-y-4">
      <form action={updateClientRecordAction} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="clientId" value={client.id} />
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <Field label="First name" name="firstName" defaultValue={client.firstName} required />
        <Field label="Last name" name="lastName" defaultValue={client.lastName} required />
        <Field label="Phone" name="phone" defaultValue={client.phoneDisplay} required inputMode="tel" />
        <Field label="Email" name="email" type="email" defaultValue={client.email ?? ""} />
        <Field label="First visit" name="firstVisitDate" type="date" defaultValue={dateInputValue(client.firstVisitDate)} required />
        <SelectField label="Client type" name="clientType" defaultValue={client.clientType ?? ""} options={firstTimeClientTypes} />
        <SelectField label="Session" name="sessionType" defaultValue={client.sessionType ?? ""} options={firstTimeClientSessions} />
        <Field label="Other session" name="sessionOther" defaultValue={client.sessionOther ?? ""} />
        <SelectField label="Primary issue" name="primaryIssue" defaultValue={client.primaryIssue ?? ""} options={firstTimePrimaryIssues} />
        <SelectField
          label="Location"
          name="locationId"
          defaultValue={opportunity.locationId}
          options={options.locations.map((location) => ({ value: location.id, label: `${location.code} - ${location.name}` }))}
        />
        <SelectField
          label="Therapist"
          name="firstVisitTherapistId"
          defaultValue={opportunity.firstVisitTherapistId ?? ""}
          options={options.therapists.map((person) => ({ value: person.id, label: person.displayName }))}
          includeNone
        />
        <SelectField label="Interest level" name="interestLevel" defaultValue={opportunity.interestLevel} options={interestLevels} />
        <SelectField
          label="Primary closer"
          name="proposedPrimaryCloserId"
          defaultValue={opportunity.proposedPrimaryCloserId}
          options={options.staff.map((person) => ({ value: person.id, label: person.displayName }))}
        />
        <SelectField
          label="Secondary closer"
          name="proposedSupportCloserId"
          defaultValue={opportunity.proposedSupportCloserId ?? ""}
          options={options.staff.map((person) => ({ value: person.id, label: person.displayName }))}
          includeNone
        />
        <SelectField label="Collected by" name="collectedBy" defaultValue={opportunity.collectedBy} options={collectedByOptions} />
        <SelectField
          label="Opportunity status"
          name="opportunityStatus"
          defaultValue={opportunity.status}
          options={["OPEN", "MEMBERSHIP_SOLD", "CLOSED_NO_SALE", "INVALID", "DISPUTED"]}
        />
        <SelectField
          label="Follow-up status"
          name="followUpStatus"
          defaultValue={opportunity.followUpStatus}
          options={uniqueOptions([opportunity.followUpStatus, ...nextActionOptions])}
        />
        <SelectField
          label="Closure reason"
          name="closureReason"
          defaultValue={opportunity.closureReason ?? ""}
          options={["CLIENT_DECLINED", "UNABLE_TO_REACH", "NOT_A_GOOD_FIT", "DUPLICATE_RECORD", "MEMBERSHIP_ALREADY_ACTIVE", "INVALID_ENTRY", "OTHER"]}
          includeNone
        />
        <Field label="Last follow-up" name="lastFollowUpDate" type="date" defaultValue={opportunity.lastFollowUpDate ? dateInputValue(opportunity.lastFollowUpDate) : ""} />
        <Field label="Next follow-up" name="nextFollowUpDate" type="date" defaultValue={opportunity.nextFollowUpDate ? dateInputValue(opportunity.nextFollowUpDate) : ""} />
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-semibold">Notes</span>
          <textarea className="field min-h-24" name="notes" defaultValue={client.notes ?? ""} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-semibold">Closure note</span>
          <textarea className="field min-h-20" name="closureNote" defaultValue={opportunity.closureNote ?? ""} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-semibold">Follow-up notes</span>
          <textarea className="field min-h-20" name="followUpNotes" defaultValue={opportunity.followUpNotes ?? ""} />
        </label>
        <div className="md:col-span-2">
          <button className="button-primary" type="submit">Save client record</button>
        </div>
      </form>

      <div className="border-t border-[var(--border)] pt-4">
        <p className="mb-2 text-sm text-[var(--text-muted)]">Deleting this record also deletes its opportunity, follow-ups, sale, and sale credits.</p>
        <DeleteClientRecordButton clientId={client.id} />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  inputMode?: "tel" | "email";
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <input className="field" name={name} type={type} defaultValue={defaultValue} required={required} inputMode={inputMode} />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  includeNone = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly (string | { value: string; label: string })[];
  includeNone?: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <select className="field" name={name} defaultValue={defaultValue} required={!includeNone}>
        {includeNone ? <option value="">None</option> : <option value="">Select {label.toLowerCase()}</option>}
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const labelText = typeof option === "string" ? displayStatus(option) : option.label;
          return <option key={value} value={value}>{labelText}</option>;
        })}
      </select>
    </label>
  );
}

function uniqueOptions(options: (string | null | undefined)[]) {
  return Array.from(new Set(options.filter((option): option is string => Boolean(option))));
}
