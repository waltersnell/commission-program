export const firstTimeClientSessions = [
  "Thai Sport",
  "Sport Recovery",
  "Neuromuscular",
  "SmartCare Muscle Balance",
  "SmartCare Pain Reset",
  "SmartCare Performance Tune-Up",
  "Fascia Realign",
  "Movement Mastery",
  "Sructural Bodywork",
  "Other",
] as const;

export const firstTimeClientTypes = [
  "Resident",
  "Long Term Visitor",
  "Tourist",
  "Prospect - Partner",
  "Prospect - Other",
] as const;

export const firstTimePrimaryIssues = [
  "Acute Pain",
  "Chronic Pain",
  "Tightness",
  "Stress Relief",
  "Maintenance",
] as const;

export const interestLevels = ["Hot", "Warm", "Cold", "None"] as const;

export function displayClientSession(sessionType?: string | null, sessionOther?: string | null) {
  if (!sessionType) {
    return "-";
  }
  if (sessionType === "Other") {
    return sessionOther ? `Other - ${sessionOther}` : "Other";
  }
  return sessionType;
}
