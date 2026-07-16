"use client";

import { useRef, useState } from "react";
import { completeOpportunityTaskAction } from "@/app/actions";

type NextActionCardProps = {
  opportunityId: string;
  actionLabel: string;
  dueDate: string | null;
  isLate: boolean;
  canComplete: boolean;
  defaultMessage: string;
};

export function NextActionCard({
  opportunityId,
  actionLabel,
  dueDate,
  isLate,
  canComplete,
  defaultMessage,
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
    <section className="card p-4">
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
        <input type="hidden" name="completedAction" value={actionLabel} />
        <label className="grid gap-1">
          <span className="text-sm font-semibold">SMS message</span>
          <textarea
            ref={textareaRef}
            className="field min-h-[22rem] md:min-h-[28rem]"
            name="smsMessage"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary"
            type="button"
            onClick={copyMessage}
          >
            Copy SMS
          </button>
          <button className="button-primary" type="submit" disabled={!canComplete}>
            Task Completed
          </button>
          {copyStatus ? <span className="self-center text-sm font-semibold text-[var(--teal)]">{copyStatus}</span> : null}
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
