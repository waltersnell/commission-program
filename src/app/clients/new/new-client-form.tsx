"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createClientAction } from "@/app/actions";
import { dateInputValue } from "@/lib/format";
import {
  emptyNewClientFormValues,
  initialNewClientFormState,
  type NewClientFormState,
  type NewClientFormValues,
} from "@/lib/client-form-state";
import {
  collectedByOptions,
  firstTimeClientSessions,
  firstTimeClientTypes,
  firstTimePrimaryIssues,
  interestLevels,
} from "@/lib/session-options";

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
  const startingState = useMemo<NewClientFormState>(() => ({
    ...initialNewClientFormState,
    duplicateId: duplicate,
    values: {
      ...emptyNewClientFormValues,
      firstVisitDate: dateInputValue(new Date()),
    },
  }), [duplicate]);
  const [state, formAction] = useActionState(createClientAction, startingState);
  const [sessionType, setSessionType] = useState(state.values.sessionType);
  const [clientErrors, setClientErrors] = useState<NewClientFormState["fieldErrors"]>({});
  const [clientMessage, setClientMessage] = useState("");
  const invalidBeepRef = useRef(false);
  const showOtherSession = sessionType === "Other";
  const fieldErrors = { ...state.fieldErrors, ...clientErrors };
  const message = clientMessage || state.message;
  const duplicateId = state.duplicateId ?? duplicate;

  useEffect(() => {
    if (state.status === "error") {
      playErrorBeep();
    }
  }, [state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    invalidBeepRef.current = false;
    const formData = new FormData(event.currentTarget);
    const phoneDigits = String(formData.get("phone") ?? "").replace(/\D/g, "");
    const primaryCloser = String(formData.get("proposedPrimaryCloserId") ?? "");
    const supportCloser = String(formData.get("proposedSupportCloserId") ?? "");
    const nextErrors: NewClientFormState["fieldErrors"] = {};

    if (phoneDigits.length !== 10) {
      nextErrors.phone = "Enter a 10-digit US phone number.";
    }
    if (primaryCloser && supportCloser && primaryCloser === supportCloser) {
      nextErrors.proposedSupportCloserId = "Support closer must be different from primary closer.";
    }
    if (sessionType === "Other" && !String(formData.get("sessionOther") ?? "").trim()) {
      nextErrors.sessionOther = "Enter the other session name.";
    }

    if (Object.keys(nextErrors).length > 0) {
      event.preventDefault();
      setClientErrors(nextErrors);
      setClientMessage(Object.values(nextErrors)[0] ?? "Check the highlighted field.");
      playErrorBeep();
      focusFirstError(event.currentTarget, nextErrors);
      return;
    }

    setClientErrors({});
    setClientMessage("");
  }

  function handleInvalid() {
    if (!invalidBeepRef.current) {
      invalidBeepRef.current = true;
      playErrorBeep();
      setClientMessage("Check the highlighted required field.");
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} onInvalidCapture={handleInvalid} className="card grid gap-4 p-5 md:grid-cols-2">
      {message ? (
        <div className="message border-[var(--orange)] md:col-span-2" role="alert">
          {message}
        </div>
      ) : null}
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client first name</span>
        <input className="field" name="firstName" defaultValue={state.values.firstName} aria-invalid={Boolean(fieldErrors.firstName)} required />
        <FieldError message={fieldErrors.firstName} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client last name</span>
        <input className="field" name="lastName" defaultValue={state.values.lastName} aria-invalid={Boolean(fieldErrors.lastName)} required />
        <FieldError message={fieldErrors.lastName} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Phone number</span>
        <input className="field" name="phone" inputMode="tel" defaultValue={state.values.phone} aria-invalid={Boolean(fieldErrors.phone)} required />
        <FieldError message={fieldErrors.phone} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Email address</span>
        <input className="field" name="email" type="email" inputMode="email" defaultValue={state.values.email} aria-invalid={Boolean(fieldErrors.email)} />
        <FieldError message={fieldErrors.email} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">First-visit date</span>
        <input className="field" name="firstVisitDate" type="date" defaultValue={state.values.firstVisitDate} aria-invalid={Boolean(fieldErrors.firstVisitDate)} required />
        <FieldError message={fieldErrors.firstVisitDate} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Client Type</span>
        <select className="field" name="clientType" defaultValue={state.values.clientType} aria-invalid={Boolean(fieldErrors.clientType)} required>
          <option value="">Select client type</option>
          {firstTimeClientTypes.map((clientType) => (
            <option key={clientType} value={clientType}>
              {clientType}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.clientType} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Session</span>
        <select className="field" name="sessionType" value={sessionType} onChange={(event) => setSessionType(event.target.value)} aria-invalid={Boolean(fieldErrors.sessionType)} required>
          <option value="">Select session</option>
          {firstTimeClientSessions.map((session) => (
            <option key={session} value={session}>
              {session}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.sessionType} />
      </label>
      {showOtherSession ? (
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-semibold">Other session</span>
          <input className="field" name="sessionOther" defaultValue={state.values.sessionOther} aria-invalid={Boolean(fieldErrors.sessionOther)} required={showOtherSession} autoFocus />
          <FieldError message={fieldErrors.sessionOther} />
        </label>
      ) : (
        <input type="hidden" name="sessionOther" value="" />
      )}
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Primary Issue</span>
        <select className="field" name="primaryIssue" defaultValue={state.values.primaryIssue} aria-invalid={Boolean(fieldErrors.primaryIssue)} required>
          <option value="">Select primary issue</option>
          {firstTimePrimaryIssues.map((issue) => (
            <option key={issue} value={issue}>
              {issue}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.primaryIssue} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Therapist</span>
        <select className="field" name="firstVisitTherapistId" defaultValue={state.values.firstVisitTherapistId} aria-invalid={Boolean(fieldErrors.firstVisitTherapistId)} required>
          <option value="">Select therapist</option>
          {therapists.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.firstVisitTherapistId} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Interest Level</span>
        <select className="field" name="interestLevel" defaultValue={state.values.interestLevel} aria-invalid={Boolean(fieldErrors.interestLevel)} required>
          {interestLevels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.interestLevel} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Location</span>
        <select className="field" name="locationId" defaultValue={state.values.locationId} aria-invalid={Boolean(fieldErrors.locationId)} required>
          <option value="">Select location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} - {location.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.locationId} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Proposed primary closer</span>
        <select className="field" name="proposedPrimaryCloserId" defaultValue={state.values.proposedPrimaryCloserId} aria-invalid={Boolean(fieldErrors.proposedPrimaryCloserId)} required>
          <option value="">Select staff</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.proposedPrimaryCloserId} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Proposed support closer</span>
        <select className="field" name="proposedSupportCloserId" defaultValue={state.values.proposedSupportCloserId} aria-invalid={Boolean(fieldErrors.proposedSupportCloserId)}>
          <option value="">None</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.proposedSupportCloserId} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Collected By</span>
        <select className="field" name="collectedBy" defaultValue={state.values.collectedBy} aria-invalid={Boolean(fieldErrors.collectedBy)} required>
          {collectedByOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.collectedBy} />
      </label>
      <label className="grid gap-1 md:col-span-2">
        <span className="text-sm font-semibold">Notes</span>
        <textarea className="field min-h-28" name="notes" defaultValue={state.values.notes} />
      </label>
      {duplicateId && role !== "FRONT_DESK" ? (
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

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-sm font-semibold text-[var(--orange)]">{message}</span> : null;
}

function focusFirstError(form: HTMLFormElement, errors: NewClientFormState["fieldErrors"]) {
  const firstName = Object.keys(errors)[0] as keyof NewClientFormValues | undefined;
  if (!firstName) {
    return;
  }
  const field = form.elements.namedItem(firstName);
  if (field instanceof HTMLElement) {
    field.focus();
  }
}

function playErrorBeep() {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return;
  }
  const context = new AudioCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = 220;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}
