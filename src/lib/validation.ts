import { z } from "zod";
import { normalizePhone } from "./format";
import { canAdmin, canManage, roles, staffJobs } from "./roles";
import { firstTimeClientSessions, firstTimeClientTypes, firstTimePrimaryIssues, interestLevels } from "./session-options";

const requiredString = z.string().trim().min(1, "This field is required.");
const optionalString = z.string().trim().optional().or(z.literal(""));

export const clientEntrySchema = z
  .object({
    firstName: requiredString,
    lastName: requiredString,
    phone: z.string().trim().min(1, "Phone number is required."),
    email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
    firstVisitDate: requiredString,
    sessionType: z.enum(firstTimeClientSessions, { message: "Select a session." }),
    sessionOther: optionalString,
    clientType: z.enum(firstTimeClientTypes, { message: "Select a client type." }),
    primaryIssue: z.enum(firstTimePrimaryIssues, { message: "Select a primary issue." }),
    locationId: requiredString,
    firstVisitTherapistId: requiredString,
    interestLevel: z.enum(interestLevels, { message: "Select an interest level." }),
    proposedPrimaryCloserId: requiredString,
    proposedSupportCloserId: optionalString,
    notes: optionalString,
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.phone);
    if (phone.normalized.length !== 10) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit US phone number." });
    }
    if (data.proposedSupportCloserId && data.proposedSupportCloserId === data.proposedPrimaryCloserId) {
      ctx.addIssue({ code: "custom", path: ["proposedSupportCloserId"], message: "Support closer must be different from primary closer." });
    }
    if (data.sessionType === "Other" && !data.sessionOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["sessionOther"], message: "Enter the other session name." });
    }
  });

export const saleEntrySchema = z
  .object({
    opportunityId: requiredString,
    membershipSaleDate: requiredString,
    membershipTypeId: requiredString,
    finalPrimaryCloserId: requiredString,
    finalSupportCloserId: optionalString,
    notes: optionalString,
    managerOverride: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.finalSupportCloserId && data.finalSupportCloserId === data.finalPrimaryCloserId) {
      ctx.addIssue({ code: "custom", path: ["finalSupportCloserId"], message: "Support closer must be different from primary closer." });
    }
  });

export const closeOpportunitySchema = z.object({
  opportunityId: requiredString,
  closureReason: requiredString,
  closureNote: optionalString,
});

export const staffSchema = z.object({
  staffId: optionalString,
  firstName: requiredString,
  lastName: optionalString,
  displayName: requiredString,
  role: z.enum(staffJobs),
  active: z.string().optional(),
});

export const userCreateSchema = z
  .object({
    displayName: requiredString,
    role: z.enum(roles),
    phone: requiredString,
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.phone);
    if (phone.normalized.length !== 10) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit US phone number." });
    }
  });

export const userEditSchema = z
  .object({
    userId: requiredString,
    displayName: requiredString,
    role: z.enum(roles),
    phone: requiredString,
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().optional(),
    active: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const phone = normalizePhone(data.phone);
    if (phone.normalized.length !== 10) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a 10-digit US phone number." });
    }
    if (data.password && data.password.length < 8) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password must be at least 8 characters." });
    }
  });

export const userDeactivateSchema = z.object({
  userId: requiredString,
});

export const commissionSettingSchema = z.object({
  settingId: requiredString,
  value: requiredString,
});

export const loginSchema = z.object({
  userName: requiredString,
  password: requiredString,
});

export const passwordResetSchema = z
  .object({
    userName: requiredString,
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
    }
  });

export function ensureRoleCanClose(role: string) {
  if (!canManage(role)) {
    return "Only managers and administrators can close opportunities without a sale.";
  }
  return null;
}

export function ensureRoleCanFinalize(role: string) {
  if (!canManage(role)) {
    return "Only managers and administrators can finalize a commission month.";
  }
  return null;
}

export function ensureRoleCanReopen(role: string) {
  if (!canAdmin(role)) {
    return "Only administrators can reopen finalized commission months.";
  }
  return null;
}
