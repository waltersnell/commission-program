"use client";

import { useRef, useState } from "react";
import { completeOpportunityTaskAction } from "@/app/actions";

type NextActionCardProps = {
  opportunityId: string;
  crmStepId: string;
  actionLabel: string;
  communicationType: string;
  dueDate: string | null;
  isLate: boolean;
  canComplete: boolean;
  defaultMessage: string;
  downgradeOptions: string[];
};

export function NextActionCard({
  opportunityId,
  crmStepId,
  actionLabel,
  communicationType,
  dueDate,
  isLate,
  canComplete,
  defaultMessage,
  downgradeOptions,
}: NextActionCardProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [copyStatus, setCopyStatus] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function copyMessage() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        fallbackCopy(textareaRef.current);
      }
      setCopyStatus("Copied");
    } catch {
      const copied = fallbackCopy(textareaRef.current);
      setCopyStatus(copied ? "Copied" : "Select the text and press Command+C");
    }
  }

  return (
    <section className="card card-soft p-4">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="section-title">Next Action</h2>
          <p className="font-semibold">{actionLabel}</p>
        </div>
        {dueDate ? (
          <span className={isLate ? "badge badge-orange" : "badge badge-gray"}>
            Due {dueDate}
          </span>
        ) : null}
      </div>

      <form action={completeOpportunityTaskAction} className="grid gap-3">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="crmStepId" value={crmStepId} />
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{communicationType} message or script</span>
          <textarea
            ref={textareaRef}
            className="field min-h-[22rem] md:min-h-[28rem]"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1"><span className="text-sm font-semibold">Outcome</span><select className="field" name="outcome" required><option value="INTERESTED">Interested</option><option value="NO_ANSWER">No answer</option><option value="FOLLOW_UP_LATER">Follow up later</option><option value="DOWNGRADED">Downgraded</option><option value="DO_NOT_CONTACT">Do not contact</option></select></label>
          <label className="grid gap-1"><span className="text-sm font-semibold">Optional account-status downgrade</span><select className="field" name="requestedStatus"><option value="">Keep current status</option>{downgradeOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <label className="grid gap-1"><span className="text-sm font-semibold">Completion notes</span><textarea className="field min-h-24" name="completionNotes" placeholder="Record the result of this task. Required when selecting None." /></label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="button-secondary"
            type="button"
            onClick={copyMessage}
          >
            {copyStatus === "Copied" ? "Copied" : `Copy ${communicationType.toLowerCase()}`}
          </button>
          <button className="button-primary" type="submit" disabled={!canComplete}>
            Task Completed
          </button>
          {copyStatus && copyStatus !== "Copied" ? <span className="self-center text-sm font-semibold text-[var(--teal)]">{copyStatus}</span> : null}
        </div>
      </form>
    </section>
  );
}

function fallbackCopy(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return false;
  }
  textarea.focus();
  textarea.select();
  return document.execCommand("copy");
}
