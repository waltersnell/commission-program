"use client";

import { useState } from "react";
import { createClientAction } from "@/app/actions";
import { dateInputValue } from "@/lib/format";
import { firstTimeClientSessions, firstTimeClientTypes, firstTimePrimaryIssues, interestLevels } from "@/lib/session-options";

type Option = {
  id: string;
  displayName?: string;
  code?: string;
  name?: string;
};

export function NewClientForm({
  staff,
  therapists,
  locations,
  role,
  duplicate,
}: {
  staff: Option[];
  therapists: Option[];
  locations: Option[];
  role: string;
  duplicate?: string;
}) {
  const [sessionType, setSessionType] = useState("");
  const showOtherSession = sessionType === "Other";

  return (
    <form action={createClientAction} className="card grid gap-4 p-5 md:grid-cols-2">
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client first name</span>
        <input className="field" name="firstName" required />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client last name</span>
        <input className="field" name="lastName" required />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Phone number</span>
        <input className="field" name="phone" inputMode="tel" required />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Email address</span>
        <input className="field" name="email" type="email" inputMode="email" />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">First-visit date</span>
        <input className="field" name="firstVisitDate" type="date" defaultValue={dateInputValue(new Date())} required />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client Type</span>
        <select className="field" name="clientType" required>
          <option value="">Select client type</option>
          {firstTimeClientTypes.map((clientType) => (
            <option key={clientType} value={clientType}>
              {clientType}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Session</span>
        <select className="field" name="sessionType" value={sessionType} onChange={(event) => setSessionType(event.target.value)} required>
          <option value="">Select session</option>
          {firstTimeClientSessions.map((session) => (
            <option key={session} value={session}>
              {session}
            </option>
          ))}
        </select>
      </label>
      {showOtherSession ? (
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-semibold">Other session</span>
          <input className="field" name="sessionOther" required={showOtherSession} autoFocus />
        </label>
      ) : (
        <input type="hidden" name="sessionOther" value="" />
      )}
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Primary Issue</span>
        <select className="field" name="primaryIssue" required>
          <option value="">Select primary issue</option>
          {firstTimePrimaryIssues.map((issue) => (
            <option key={issue} value={issue}>
              {issue}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Therapist</span>
        <select className="field" name="firstVisitTherapistId" required>
          <option value="">Select therapist</option>
          {therapists.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Interest Level</span>
        <select className="field" name="interestLevel" defaultValue="None" required>
          {interestLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Location</span>
        <select className="field" name="locationId" required>
          <option value="">Select location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} - {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Proposed primary closer</span>
        <select className="field" name="proposedPrimaryCloserId" required>
          <option value="">Select staff</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Proposed support closer</span>
        <select className="field" name="proposedSupportCloserId">
          <option value="">None</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 md:col-span-2">
        <span className="text-sm font-semibold">Notes</span>
        <textarea className="field min-h-28" name="notes" />
      </label>
      {duplicate && role !== "FRONT_DESK" ? (
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" name="allowDuplicate" value="true" />
          <span className="text-sm font-semibold">Continue despite possible duplicate</span>
        </label>
      ) : null}
      <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
        <button className="button-primary" type="submit" name="intent" value="createOpportunity">
          Create opportunity
        </button>
        <button className="button-accent" type="submit" name="intent" value="soldMembership">
          Sold Membership
        </button>
      </div>
    </form>
  );
}
