"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertCanEditPeriod,
  createSaleCredits,
  isFirstVisitSale,
  settingsFromRows,
} from "@/lib/commission";
import { getCommissionSummary, saleMonthWhere } from "@/lib/data";
import { getPrisma } from "@/lib/db";
import {
  dollarInputToCents,
  percentInputToBasisPoints,
  dateInputValue,
  monthKey,
  normalizePhone,
  toLocalDate,
} from "@/lib/format";
import { hashPassword } from "@/lib/passwords";
import { verifyPassword } from "@/lib/passwords";
import { canAdmin, canManage } from "@/lib/roles";
import {
  clearCurrentUserSession,
  requireCurrentUser,
  setCurrentUserSession,
} from "@/lib/session";
import {
  clientEntrySchema,
  closeOpportunitySchema,
  completeOpportunityTaskSchema,
  commissionSettingSchema,
  crmStepTemplateSchema,
  ensureRoleCanClose,
  ensureRoleCanFinalize,
  ensureRoleCanReopen,
  loginSchema,
  nextActionSchema,
  opportunityCloserSchema,
  passwordResetSchema,
  saleEntrySchema,
  staffSchema,
  userCreateSchema,
  userDeactivateSchema,
  userEditSchema,
} from "@/lib/validation";
import { getNextActionAfterCompletion } from "@/lib/opportunity-next-action";
import {
  initialNewClientFormState,
  newClientValuesFromFormData,
  type NewClientFormState,
  type NewClientFormValues,
} from "@/lib/client-form-state";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Incorrect User Name")}`);
  }

  const userName = parsed.data.userName.trim();
  const userNameLower = userName.toLowerCase();
  const users = await getPrisma().user.findMany({
    where: { active: true },
  });
  const user = users.find(
    (candidate) =>
      candidate.username.toLowerCase() === userNameLower ||
      candidate.email?.toLowerCase() === userNameLower,
  );

  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Incorrect User Name")}`);
  }

  if (!user.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
    redirect(`/login?error=${encodeURIComponent("Incorrect Password")}&showForgot=1&userName=${encodeURIComponent(user.username)}`);
  }

  await setCurrentUserSession(user);
  redirect("/");
}

export async function logoutAction() {
  await clearCurrentUserSession();
  redirect("/login");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the password fields.")}`);
  }

  const userName = parsed.data.userName.trim();
  const userNameLower = userName.toLowerCase();
  const users = await getPrisma().user.findMany({ where: { active: true } });
  const user = users.find(
    (candidate) =>
      candidate.username.toLowerCase() === userNameLower ||
      candidate.email?.toLowerCase() === userNameLower,
  );

  if (!user) {
    redirect(`/forgot-password?error=${encodeURIComponent("Incorrect User Name")}`);
  }

  await getPrisma().user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.password) },
  });
  await auditAdminChange(user.role, "USER_PASSWORD_RESET", "User", user.id, user.email ?? user.username);
  redirect(`/login?message=${encodeURIComponent("Password updated. Please sign in.")}`);
}

export async function createClientAction(_state: NewClientFormState = initialNewClientFormState, formData: FormData): Promise<NewClientFormState> {
  void _state;
  const user = await requireCurrentUser();
  const role = user.role;
  const soldMembership = formData.get("intent") === "soldMembership";
  const values = newClientValuesFromFormData(formData);
  const parsed = clientEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return clientFormError(values, parsed.error.issues[0]?.message ?? "Check the form.", fieldErrorsFromIssues(parsed.error.issues));
  }

  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const firstVisitDate = toLocalDate(data.firstVisitDate);
  const submittedAt = new Date();
  const prisma = getPrisma();
  const duplicate = await prisma.client.findFirst({
    where: {
      OR: [
        { phoneNormalized: phone.normalized },
        {
          firstName: data.firstName,
          lastName: data.lastName,
          firstVisitDate,
        },
      ],
    },
  });

  if (duplicate && (role === "FRONT_DESK" || formData.get("allowDuplicate") !== "true")) {
    const message = role === "FRONT_DESK"
      ? "Possible duplicate found. Ask a manager to review before continuing."
      : "Possible duplicate found. Check continue if this is a separate client.";
    return clientFormError(values, message, {}, duplicate.id);
  }

  let soldMembershipSetup: { membershipTypeId: string; settings: ReturnType<typeof settingsFromRows> } | null = null;
  if (soldMembership) {
    const [preferredMembershipType, fallbackMembershipType, period, settingsRows] = await Promise.all([
      prisma.membershipType.findFirst({ where: { active: true, name: "Individual Membership" } }),
      prisma.membershipType.findFirst({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.commissionPeriod.findUnique({ where: { month: monthKey(firstVisitDate) } }),
      prisma.commissionSetting.findMany(),
    ]);

    const membershipType = preferredMembershipType ?? fallbackMembershipType;
    if (!membershipType) {
      return clientFormError(values, "Create at least one active membership type before marking a membership sold.");
    }
    if (!assertCanEditPeriod(role, period?.status)) {
      return clientFormError(values, "Front Desk users cannot edit records in finalized months.");
    }

    soldMembershipSetup = {
      membershipTypeId: membershipType.id,
      settings: settingsFromRows(settingsRows),
    };
  }

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNormalized: phone.normalized,
        phoneDisplay: phone.display,
        email: data.email || null,
        firstVisitDate,
        sessionType: data.sessionType,
        sessionOther: data.sessionType === "Other" ? data.sessionOther || null : null,
        clientType: data.clientType,
        primaryIssue: data.primaryIssue,
        notes: data.notes || null,
      },
    });
    const created = await tx.membershipOpportunity.create({
      data: {
        clientId: client.id,
        locationId: data.locationId,
        firstVisitTherapistId: data.firstVisitTherapistId,
        interestLevel: data.interestLevel,
        proposedPrimaryCloserId: data.proposedPrimaryCloserId,
        proposedSupportCloserId: data.proposedSupportCloserId || null,
        collectedBy: data.collectedBy,
        followUpStatus: "Follow Up Needed",
        intakeSubmittedAt: submittedAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "CLIENT_CREATED",
        recordType: "MembershipOpportunity",
        recordId: created.id,
        newValue: `${client.firstName} ${client.lastName}`,
      },
    });

    if (soldMembershipSetup) {
      const supportId = data.proposedSupportCloserId || null;
      const sale = await tx.membershipSale.create({
        data: {
          opportunityId: created.id,
          locationId: data.locationId,
          membershipSaleDate: firstVisitDate,
          membershipTypeId: soldMembershipSetup.membershipTypeId,
          finalPrimaryCloserId: data.proposedPrimaryCloserId,
          finalSupportCloserId: supportId,
          approvalStatus: "PENDING",
          isFirstVisitSale: true,
          notes: data.notes || null,
          createdAt: submittedAt,
        },
      });
      await tx.saleCredit.createMany({
        data: createSaleCredits({
          saleId: sale.id,
          primaryStaffId: data.proposedPrimaryCloserId,
          supportStaffId: supportId,
          isFirstVisitSale: true,
          settings: soldMembershipSetup.settings,
        }),
      });
      await tx.membershipOpportunity.update({
        where: { id: created.id },
        data: { status: "MEMBERSHIP_SOLD" },
      });
      await tx.auditLog.create({
        data: {
          actingUser: role,
          action: "MEMBERSHIP_RECORDED",
          recordType: "MembershipSale",
          recordId: sale.id,
          newValue: dateInputValue(firstVisitDate),
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/opportunities");
  redirect(`/?message=${encodeURIComponent(soldMembership ? "Good Job" : "Opportunity is created")}`);
}

export async function updateNextActionAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = nextActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return;
  }

  const now = new Date();
  await getPrisma().$transaction(async (tx) => {
    await tx.membershipOpportunity.update({
      where: { id: parsed.data.opportunityId },
      data: {
        followUpStatus: parsed.data.nextAction,
        lastFollowUpDate: now,
      },
    });
    await tx.followUp.create({
      data: {
        opportunityId: parsed.data.opportunityId,
        followUpDate: now,
        ownerId: null,
        status: parsed.data.nextAction,
      },
    });
    await tx.auditLog.create({
      data: {
        actingUser: user.role,
        action: "NEXT_ACTION_UPDATED",
        recordType: "MembershipOpportunity",
        recordId: parsed.data.opportunityId,
        newValue: parsed.data.nextAction,
      },
    });
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${parsed.data.opportunityId}`);
}

export async function updateOpportunityClosersAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = opportunityCloserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/opportunities/${formData.get("opportunityId")}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the closer assignments.")}`);
  }

  const prisma = getPrisma();
  const opportunity = await prisma.membershipOpportunity.findUnique({
    where: { id: parsed.data.opportunityId },
    include: { sale: true },
  });
  if (!opportunity) {
    redirect(`/opportunities?error=${encodeURIComponent("Opportunity was not found.")}`);
  }
  if (opportunity.status !== "OPEN" || opportunity.sale) {
    redirect(`/opportunities/${opportunity.id}?error=${encodeURIComponent("Closer assignments can only be edited on open opportunities.")}`);
  }

  const supportId = parsed.data.proposedSupportCloserId || null;
  await prisma.$transaction(async (tx) => {
    await tx.membershipOpportunity.update({
      where: { id: opportunity.id },
      data: {
        proposedPrimaryCloserId: parsed.data.proposedPrimaryCloserId,
        proposedSupportCloserId: supportId,
      },
    });
    await tx.auditLog.create({
      data: {
        actingUser: user.role,
        action: "OPPORTUNITY_CLOSERS_UPDATED",
        recordType: "MembershipOpportunity",
        recordId: opportunity.id,
        previousValue: `${opportunity.proposedPrimaryCloserId}/${opportunity.proposedSupportCloserId ?? ""}`,
        newValue: `${parsed.data.proposedPrimaryCloserId}/${supportId ?? ""}`,
      },
    });
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunity.id}`);
  redirect(`/opportunities/${opportunity.id}?updated=1`);
}

export async function completeOpportunityTaskAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = completeOpportunityTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/opportunities/${formData.get("opportunityId")}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the task.")}`);
  }

  const prisma = getPrisma();
  const opportunity = await prisma.membershipOpportunity.findUnique({
    where: { id: parsed.data.opportunityId },
    include: { client: true },
  });
  if (!opportunity) {
    redirect(`/opportunities?error=${encodeURIComponent("Opportunity was not found.")}`);
  }

  const next = getNextActionAfterCompletion({
    interestLevel: opportunity.interestLevel,
    firstVisitDate: opportunity.client.firstVisitDate,
    followUpStatus: opportunity.followUpStatus,
    nextFollowUpDate: opportunity.nextFollowUpDate,
  });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.followUp.create({
      data: {
        opportunityId: opportunity.id,
        followUpDate: now,
        status: `${parsed.data.completedAction} Completed`,
        notes: parsed.data.smsMessage || null,
      },
    });
    await tx.membershipOpportunity.update({
      where: { id: opportunity.id },
      data: {
        followUpStatus: next.status,
        nextFollowUpDate: next.dueDate,
        lastFollowUpDate: now,
      },
    });
    await tx.auditLog.create({
      data: {
        actingUser: user.role,
        action: "OPPORTUNITY_TASK_COMPLETED",
        recordType: "MembershipOpportunity",
        recordId: opportunity.id,
        previousValue: parsed.data.completedAction,
        newValue: next.status,
      },
    });
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunity.id}`);
  redirect(`/opportunities/${opportunity.id}?task=completed`);
}

export async function recordSaleAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  const parsed = saleEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/opportunities/${formData.get("opportunityId")}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the sale form.")}`);
  }

  const data = parsed.data;
  const prisma = getPrisma();
  const opportunity = await prisma.membershipOpportunity.findUnique({
    where: { id: data.opportunityId },
    include: { client: true, sale: true },
  });
  if (!opportunity) {
    redirect(`/opportunities?error=${encodeURIComponent("Opportunity was not found.")}`);
  }
  if (opportunity.sale) {
    redirect(`/opportunities/${opportunity.id}?error=${encodeURIComponent("This opportunity already has a membership sale.")}`);
  }

  const saleDate = toLocalDate(data.membershipSaleDate);
  if (saleDate < opportunity.client.firstVisitDate && !canManage(role)) {
    redirect(`/opportunities/${opportunity.id}?error=${encodeURIComponent("Sale date cannot be earlier than first visit without manager override.")}`);
  }

  const period = await prisma.commissionPeriod.findUnique({ where: { month: monthKey(saleDate) } });
  if (!assertCanEditPeriod(role, period?.status)) {
    redirect(`/opportunities/${opportunity.id}?error=${encodeURIComponent("Front Desk users cannot edit records in finalized months.")}`);
  }

  const settings = settingsFromRows(await prisma.commissionSetting.findMany());
  const firstVisit = isFirstVisitSale(opportunity.client.firstVisitDate, saleDate);
  const supportId = data.finalSupportCloserId || null;

  await prisma.$transaction(async (tx) => {
    const sale = await tx.membershipSale.create({
      data: {
        opportunityId: opportunity.id,
        locationId: opportunity.locationId,
        membershipSaleDate: saleDate,
        membershipTypeId: data.membershipTypeId,
        finalPrimaryCloserId: data.finalPrimaryCloserId,
        finalSupportCloserId: supportId,
        approvalStatus: "PENDING",
        isFirstVisitSale: firstVisit,
        notes: data.notes || null,
      },
    });
    await tx.saleCredit.createMany({
      data: createSaleCredits({
        saleId: sale.id,
        primaryStaffId: data.finalPrimaryCloserId,
        supportStaffId: supportId,
        isFirstVisitSale: firstVisit,
        settings,
      }),
    });
    await tx.membershipOpportunity.update({
      where: { id: opportunity.id },
      data: { status: "MEMBERSHIP_SOLD" },
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "MEMBERSHIP_RECORDED",
        recordType: "MembershipSale",
        recordId: sale.id,
        newValue: dateInputValue(saleDate),
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/opportunities");
  redirect(`/opportunities/${opportunity.id}?sale=1`);
}

export async function approveSplitAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  if (!canAdmin(role)) {
    redirect(`/month-end?error=${encodeURIComponent("Only administrators can approve membership sales.")}`);
  }
  const saleId = String(formData.get("saleId") ?? "");
  const action = String(formData.get("approval") ?? "APPROVED");
  await getPrisma().$transaction(async (tx) => {
    await tx.membershipSale.update({
      where: { id: saleId },
      data: { approvalStatus: action },
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: action === "APPROVED" ? "SALE_APPROVED" : "SALE_REJECTED",
        recordType: "MembershipSale",
        recordId: saleId,
      },
    });
  });
  revalidatePath("/month-end");
  redirect("/month-end");
}

export async function closeOpportunityAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  const roleError = ensureRoleCanClose(role);
  const parsed = closeOpportunitySchema.safeParse(Object.fromEntries(formData));
  if (roleError) {
    redirect(`/opportunities/${formData.get("opportunityId")}?error=${encodeURIComponent(roleError)}`);
  }
  if (!parsed.success) {
    redirect(`/opportunities/${formData.get("opportunityId")}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the closure form.")}`);
  }

  const data = parsed.data;
  await getPrisma().$transaction(async (tx) => {
    await tx.membershipOpportunity.update({
      where: { id: data.opportunityId },
      data: {
        status: data.closureReason === "INVALID_ENTRY" ? "INVALID" : "CLOSED_NO_SALE",
        closureReason: data.closureReason,
        closureNote: data.closureNote || null,
      },
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "OPPORTUNITY_CLOSED",
        recordType: "MembershipOpportunity",
        recordId: data.opportunityId,
        reason: data.closureReason,
      },
    });
  });

  revalidatePath("/opportunities");
  redirect(`/opportunities/${data.opportunityId}?closed=1`);
}

export async function finalizeMonthAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  const error = ensureRoleCanFinalize(role);
  const month = String(formData.get("month") || monthKey());
  if (error) {
    redirect(`/month-end?month=${month}&error=${encodeURIComponent(error)}`);
  }

  const prisma = getPrisma();
  const pending = await prisma.membershipSale.count({ where: { ...saleMonthWhere(month), approvalStatus: "PENDING" } });
  if (pending > 0) {
    redirect(`/month-end?month=${month}&error=${encodeURIComponent("Approve or reject pending membership sales before finalizing.")}`);
  }

  const summary = await getCommissionSummary(month);
  await prisma.$transaction(async (tx) => {
    const period = await tx.commissionPeriod.upsert({
      where: { month },
      update: { status: "FINALIZED", finalizedAt: new Date() },
      create: { month, status: "FINALIZED", finalizedAt: new Date() },
    });
    await tx.commissionResult.deleteMany({ where: { periodId: period.id } });
    await tx.commissionResult.createMany({
      data: summary.map(({ staff, result }) => ({
        periodId: period.id,
        staffId: staff.id,
        fullSaleCount: result.fullSaleCount,
        splitCreditUnits: result.splitCreditBasisPoints / 10000,
        totalCredits: result.totalCreditBasisPoints / 10000,
        firstVisitCredits: result.firstVisitCreditBasisPoints / 10000,
        baseCommissionCents: result.baseCommissionCents,
        firstVisitBonusCents: result.firstVisitBonusCents,
        adjustmentsCents: result.adjustmentsCents,
        finalCommissionCents: result.finalCommissionCents,
      })),
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "COMMISSION_MONTH_FINALIZED",
        recordType: "CommissionPeriod",
        recordId: period.id,
        newValue: month,
      },
    });
  });

  revalidatePath("/month-end");
  redirect(`/month-end?month=${month}&finalized=1`);
}

export async function reopenMonthAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  const month = String(formData.get("month") || monthKey());
  const error = ensureRoleCanReopen(role);
  if (error) {
    redirect(`/month-end?month=${month}&error=${encodeURIComponent(error)}`);
  }
  await getPrisma().$transaction(async (tx) => {
    const period = await tx.commissionPeriod.update({
      where: { month },
      data: { status: "OPEN", reopenedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "COMMISSION_MONTH_REOPENED",
        recordType: "CommissionPeriod",
        recordId: period.id,
        newValue: month,
      },
    });
  });
  revalidatePath("/month-end");
  redirect(`/month-end?month=${month}&reopened=1`);
}

export async function createStaffAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the staff form.")}`);
  }
  const data = parsed.data;
  const staff = await getPrisma().staff.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      displayName: data.displayName,
      role: data.role,
      active: true,
    },
  });
  await auditAdminChange(role, "STAFF_CREATED", "Staff", staff.id, staff.displayName);
  revalidatePath("/admin");
  redirect("/admin?staff=created");
}

export async function updateStaffAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.staffId) {
    redirect(`/admin?error=${encodeURIComponent(parsed.success ? "Missing staff record." : parsed.error.issues[0]?.message ?? "Check the staff form.")}`);
  }
  const data = parsed.data;
  const staff = await getPrisma().staff.update({
    where: { id: data.staffId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      displayName: data.displayName,
      role: data.role,
      active: data.active === "true",
    },
  });
  await auditAdminChange(role, "STAFF_EDITED", "Staff", staff.id, staff.displayName);
  revalidatePath("/admin");
  redirect("/admin?staff=updated");
}

export async function updateCommissionSettingAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = commissionSettingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the commission setting.")}`);
  }

  const prisma = getPrisma();
  const setting = await prisma.commissionSetting.findUnique({ where: { id: parsed.data.settingId } });
  if (!setting) {
    redirect(`/admin?error=${encodeURIComponent("Commission setting was not found.")}`);
  }

  const normalizedValue = normalizeSettingValue(setting.key, parsed.data.value);
  if (!normalizedValue) {
    redirect(`/admin?error=${encodeURIComponent("Enter a valid setting value.")}`);
  }

  if (setting.key === "primarySplitBasisPoints" || setting.key === "supportSplitBasisPoints") {
    const siblingKey = setting.key === "primarySplitBasisPoints" ? "supportSplitBasisPoints" : "primarySplitBasisPoints";
    const sibling = await prisma.commissionSetting.findUnique({ where: { key: siblingKey } });
    if (sibling && Number(normalizedValue) + Number(sibling.value) !== 10000) {
      redirect(`/admin?error=${encodeURIComponent("Primary and support split percentages must equal 100%.")}`);
    }
  }

  await prisma.commissionSetting.update({
    where: { id: setting.id },
    data: { value: normalizedValue },
  });
  await auditAdminChange(role, "COMMISSION_SETTING_EDITED", "CommissionSetting", setting.id, `${setting.label}: ${normalizedValue}`);
  revalidatePath("/admin");
  revalidatePath("/commissions");
  revalidatePath("/month-end");
  redirect("/admin?settings=updated");
}

export async function updateCrmStepTemplateAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = crmStepTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the CRM step.")}`);
  }

  const existing = await getPrisma().crmStepTemplate.findUnique({ where: { id: parsed.data.stepId } });
  if (!existing || existing.key !== parsed.data.key) {
    redirect(`/admin?error=${encodeURIComponent("CRM step was not found.")}`);
  }

  const step = await getPrisma().crmStepTemplate.update({
    where: { id: existing.id },
    data: { content: parsed.data.content },
  });
  await auditAdminChange(role, "CRM_STEP_TEMPLATE_EDITED", "CrmStepTemplate", step.id, step.label);
  revalidatePath("/admin");
  redirect("/admin?crm=updated");
}

export async function createUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the user form.")}`);
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email.toLowerCase();
  const existing = await getPrisma().user.findFirst({
    where: { OR: [{ email }, { username: email }] },
  });
  if (existing) {
    redirect(`/admin?error=${encodeURIComponent("A user with that email already exists.")}`);
  }
  const user = await getPrisma().user.create({
    data: {
      username: email,
      displayName: data.displayName,
      role: data.role,
      phoneNormalized: phone.normalized,
      phoneDisplay: phone.display,
      email,
      passwordHash: hashPassword(data.password),
      active: true,
    },
  });
  await auditAdminChange(role, "USER_CREATED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?user=created");
}

export async function updateUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the user form.")}`);
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email.toLowerCase();
  const existing = await getPrisma().user.findFirst({
    where: { OR: [{ email }, { username: email }], NOT: { id: data.userId } },
  });
  if (existing) {
    redirect(`/admin?error=${encodeURIComponent("A different user already has that email.")}`);
  }
  const user = await getPrisma().user.update({
    where: { id: data.userId },
    data: {
      username: email,
      displayName: data.displayName,
      role: data.role,
      phoneNormalized: phone.normalized,
      phoneDisplay: phone.display,
      email,
      active: data.active === "true",
      ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
    },
  });
  await auditAdminChange(role, "USER_EDITED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?user=updated");
}

export async function deactivateUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userDeactivateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Missing user.")}`);
  }
  const user = await getPrisma().user.update({
    where: { id: parsed.data.userId },
    data: { active: false },
  });
  await auditAdminChange(role, "USER_DEACTIVATED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?user=deactivated");
}

function requireAdmin(role: string) {
  if (!canAdmin(role)) {
    redirect(`/admin?error=${encodeURIComponent("Only administrators can change administration settings.")}`);
  }
}

function normalizeSettingValue(key: string, value: string) {
  if (["tier1.rateCents", "tier2.rateCents", "tier3.rateCents", "firstVisitBonusCents"].includes(key)) {
    const cents = dollarInputToCents(value);
    return cents === null ? null : String(cents);
  }
  if (["primarySplitBasisPoints", "supportSplitBasisPoints"].includes(key)) {
    const basisPoints = percentInputToBasisPoints(value);
    return basisPoints === null ? null : String(basisPoints);
  }
  if (["tier1.upperCredits", "tier2.upperCredits"].includes(key)) {
    const credits = Number(value);
    return Number.isFinite(credits) && credits > 0 ? String(credits) : null;
  }
  return value.trim();
}

function clientFormError(
  values: NewClientFormValues,
  message: string,
  fieldErrors: NewClientFormState["fieldErrors"] = {},
  duplicateId?: string,
): NewClientFormState {
  return {
    status: "error",
    message,
    duplicateId,
    values,
    fieldErrors,
  };
}

function fieldErrorsFromIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.reduce<NewClientFormState["fieldErrors"]>((errors, issue) => {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof NewClientFormValues] = issue.message;
    }
    return errors;
  }, {});
}

async function auditAdminChange(role: string, action: string, recordType: string, recordId: string, newValue: string) {
  await getPrisma().auditLog.create({
    data: {
      actingUser: role,
      action,
      recordType,
      recordId,
      newValue,
    },
  });
}
