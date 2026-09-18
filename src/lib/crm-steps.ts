export const crmStepTemplates = [
  {
    key: "initialTextMessage",
    label: "Initial Text Message",
    defaultContent: "",
    sortOrder: 10,
    communicationType: "SMS",
    delayDays: 1,
  },
  {
    key: "finalTextMessage",
    label: "Final Text Message",
    defaultContent: "",
    sortOrder: 30,
    communicationType: "SMS",
    delayDays: 2,
  },
  {
    key: "initialEmail",
    label: "Initial Email",
    defaultContent: "",
    sortOrder: 40,
    communicationType: "EMAIL",
    delayDays: 2,
  },
  {
    key: "finalEmail",
    label: "Final Email",
    defaultContent: "",
    sortOrder: 50,
    communicationType: "EMAIL",
    delayDays: 2,
  },
  {
    key: "initialVoiceScript",
    label: "Initial Voice Script",
    defaultContent: "",
    sortOrder: 20,
    communicationType: "PHONE",
    delayDays: 2,
  },
] as const;

export const crmStepKeys = crmStepTemplates.map((template) => template.key) as [
  (typeof crmStepTemplates)[number]["key"],
  ...(typeof crmStepTemplates)[number]["key"][],
];
