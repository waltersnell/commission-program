export type OpportunityNextActionInput = {
  interestLevel: string;
  firstVisitDate: Date;
  followUpStatus?: string | null;
  nextFollowUpDate?: Date | null;
};

export type OpportunityNextAction = {
  label: string;
  dueDate: Date | null;
  isLate: boolean;
  canComplete: boolean;
};

export function getOpportunityNextAction(input: OpportunityNextActionInput): OpportunityNextAction | null {
  if (input.followUpStatus === "Phone Outreach") {
    const dueDate = input.nextFollowUpDate ?? addDays(input.firstVisitDate, 3);
    return nextAction("Phone Outreach", dueDate, true);
  }

  if (input.followUpStatus?.endsWith("Completed")) {
    return nextAction(input.followUpStatus, null, false);
  }

  if (input.interestLevel === "Hot") {
    return nextAction("Personal SMS", addDays(input.firstVisitDate, 1), true);
  }

  if (input.interestLevel === "Warm") {
    return nextAction("Personal SMS", addDays(input.firstVisitDate, 2), true);
  }

  return null;
}

export function getNextActionAfterCompletion(input: OpportunityNextActionInput) {
  const current = getOpportunityNextAction(input);
  if (!current) {
    return { status: "Completed", dueDate: null };
  }

  if (current.label === "Personal SMS" && input.interestLevel === "Hot") {
    return { status: "Phone Outreach", dueDate: addDays(input.firstVisitDate, 3) };
  }

  return { status: `${current.label} Completed`, dueDate: null };
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextAction(label: string, dueDate: Date | null, canComplete: boolean): OpportunityNextAction {
  return {
    label,
    dueDate,
    isLate: dueDate ? startOfDay(new Date()).getTime() > startOfDay(dueDate).getTime() : false,
    canComplete,
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
