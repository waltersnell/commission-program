export const crmStepTemplates = [
  {
    key: "initialTextMessage",
    label: "Initial Text Message",
    defaultContent: "",
    sortOrder: 10,
  },
  {
    key: "finalTextMessage",
    label: "Final Text Message",
    defaultContent: "",
    sortOrder: 20,
  },
  {
    key: "initialEmail",
    label: "Initial Email",
    defaultContent: "",
    sortOrder: 30,
  },
  {
    key: "finalEmail",
    label: "Final Email",
    defaultContent: "",
    sortOrder: 40,
  },
  {
    key: "initialVoiceScript",
    label: "Initial Voice Script",
    defaultContent: "",
    sortOrder: 50,
  },
] as const;

export const crmStepKeys = crmStepTemplates.map((template) => template.key) as [
  (typeof crmStepTemplates)[number]["key"],
  ...(typeof crmStepTemplates)[number]["key"][],
];
