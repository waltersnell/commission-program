"use client";

import { useState } from "react";
import { updateCrmStepTemplateAction } from "@/app/actions";

type CrmStep = {
  id: string;
  key: string;
  label: string;
  content: string;
};

export function CrmStepsEditor({ steps }: { steps: CrmStep[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const isOpen = openKey === step.key;
        return (
          <div key={step.id} className="rounded-[8px] border border-[var(--border)] p-3">
            <button
              className="admin-panel-trigger font-semibold"
              type="button"
              onClick={() => setOpenKey(isOpen ? null : step.key)}
            >
              <span>{step.label}</span>
              <span className="badge badge-gray">{isOpen ? "Close" : "Edit"}</span>
            </button>
            {isOpen ? (
              <form action={updateCrmStepTemplateAction} className="mt-3 grid gap-3">
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="key" value={step.key} />
                <textarea className="field min-h-56" name="content" defaultValue={step.content} />
                <div>
                  <button className="button-primary" type="submit">
                    Save CRM step
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
