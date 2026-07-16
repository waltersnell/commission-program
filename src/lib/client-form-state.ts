export type NewClientFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  firstVisitDate: string;
  sessionType: string;
  sessionOther: string;
  clientType: string;
  primaryIssue: string;
  locationId: string;
  firstVisitTherapistId: string;
  interestLevel: string;
  proposedPrimaryCloserId: string;
  proposedSupportCloserId: string;
  collectedBy: string;
  notes: string;
  allowDuplicate: string;
};

export type NewClientFormState = {
  status: "idle" | "error";
  message: string;
  duplicateId?: string;
  values: NewClientFormValues;
  fieldErrors: Partial<Record<keyof NewClientFormValues, string>>;
};

export const emptyNewClientFormValues: NewClientFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  firstVisitDate: "",
  sessionType: "",
  sessionOther: "",
  clientType: "",
  primaryIssue: "",
  locationId: "",
  firstVisitTherapistId: "",
  interestLevel: "None",
  proposedPrimaryCloserId: "",
  proposedSupportCloserId: "",
  collectedBy: "Primary Closer",
  notes: "",
  allowDuplicate: "",
};

export const initialNewClientFormState: NewClientFormState = {
  status: "idle",
  message: "",
  values: emptyNewClientFormValues,
  fieldErrors: {},
};

export function newClientValuesFromFormData(formData: FormData): NewClientFormValues {
  return {
    firstName: stringValue(formData, "firstName"),
    lastName: stringValue(formData, "lastName"),
    phone: stringValue(formData, "phone"),
    email: stringValue(formData, "email"),
    firstVisitDate: stringValue(formData, "firstVisitDate"),
    sessionType: stringValue(formData, "sessionType"),
    sessionOther: stringValue(formData, "sessionOther"),
    clientType: stringValue(formData, "clientType"),
    primaryIssue: stringValue(formData, "primaryIssue"),
    locationId: stringValue(formData, "locationId"),
    firstVisitTherapistId: stringValue(formData, "firstVisitTherapistId"),
    interestLevel: stringValue(formData, "interestLevel") || "None",
    proposedPrimaryCloserId: stringValue(formData, "proposedPrimaryCloserId"),
    proposedSupportCloserId: stringValue(formData, "proposedSupportCloserId"),
    collectedBy: stringValue(formData, "collectedBy") || "Primary Closer",
    notes: stringValue(formData, "notes"),
    allowDuplicate: stringValue(formData, "allowDuplicate"),
  };
}

function stringValue(formData: FormData, key: keyof NewClientFormValues) {
  return String(formData.get(key) ?? "");
}
