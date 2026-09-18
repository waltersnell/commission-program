"use client";

import { useState } from "react";
import { updateCrmStepTemplateAction } from "@/app/actions";

type CrmStep = {
  id: string;
  key: string;
  label: string;
  content: string;
  communicationType: string;
  delayDays: number;
  applicableStatuses: string;
  active: boolean;
  resultingStatus: string | null;
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
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1"><span className="text-sm font-semibold">Communication type</span><select className="field" name="communicationType" defaultValue={step.communicationType}>{["SMS", "EMAIL", "PHONE", "INTERNAL"].map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label className="grid gap-1"><span className="text-sm font-semibold">Days after previous step</span><input className="field" name="delayDays" type="number" min="0" max="365" defaultValue={step.delayDays} required /></label>
                  <label className="grid gap-1"><span className="text-sm font-semibold">After completion</span><select className="field" name="resultingStatus" defaultValue={step.resultingStatus ?? ""}><option value="">Keep current status</option><option>Warm</option><option>Cold</option><option>None</option></select></label>
                </div>
                <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Applies to account statuses</legend><div className="flex flex-wrap gap-4">{["Hot", "Warm", "Cold"].map((status) => <label key={status} className="flex items-center gap-2"><input type="checkbox" name="applicableStatuses" value={status} defaultChecked={step.applicableStatuses.split(",").includes(status)} />{status}</label>)}</div></fieldset>
                <input type="hidden" name="active" value="false" />
                <label className="flex items-center gap-2"><input type="checkbox" name="active" value="true" defaultChecked={step.active} />Active step</label>
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
