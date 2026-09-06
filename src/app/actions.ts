"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertCanEditPeriod,
  createSaleCredits,
  isFirstVisitSale,
  saleCloserAssignmentsChanged,
  settingsFromRows,
} from "@/lib/commission";
import { getCommissionSummary, saleMonthWhere, specialSpiffMonthWhere } from "@/lib/data";
import { findStaffForUser } from "@/lib/current-staff";
import { getPrisma } from "@/lib/db";
import {
  dollarInputToCents,
  percentInputToBasisPoints,
  basisPointsToDecimalString,
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
  clientRecordDeleteSchema,
  clientRecordEditSchema,
  closeOpportunitySchema,
  completeOpportunityTaskSchema,
  commissionSettingSchema,
  crmStepTemplateSchema,
  ensureRoleCanClose,
  ensureRoleCanFinalize,
  ensureRoleCanReopen,
  loginSchema,
  membershipTypeCreateSchema,
  membershipTypeEditSchema,
  nextActionSchema,
  opportunityCloserSchema,
  passwordResetSchema,
  saleEntrySchema,
  specialSpiffApprovalSchema,
  specialSpiffAwardSchema,
  specialSpiffCreateSchema,
  specialSpiffDeleteSchema,
  specialSpiffEditSchema,
  staffSchema,
  userCreateSchema,
  userDeactivateSchema,
  userEditSchema,
} from "@/lib/validation";
import { getNextActionAfterCompletion } from "@/lib/opportunity-next-action";
import { isSpecialSpiffAvailableForDate } from "@/lib/special-spiffs";
import {
  initialNewClientFormState,
  newClientValuesFromFormData,
  splitClientName,
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
    redirect(`/login?error=${encodeURIComponent("Incorrect Password")}&userName=${encodeURIComponent(user.username)}`);
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
  const parsed = clientEntrySchema.safeParse({ ...Object.fromEntries(formData), name: values.name });
  if (!parsed.success) {
    return clientFormError(values, parsed.error.issues[0]?.message ?? "Check the form.", fieldErrorsFromIssues(parsed.error.issues));
  }

  const data = parsed.data;
  const clientName = splitClientName(data.name);
  const phone = normalizePhone(data.phone);
  const firstVisitDate = toLocalDate(data.firstVisitDate);
  if (soldMembership && !data.membershipSaleDate) {
    return clientFormError(values, "Enter the actual membership purchase date.", {
      membershipSaleDate: "Enter the actual membership purchase date.",
    });
  }
  const membershipSaleDate = soldMembership ? toLocalDate(data.membershipSaleDate!) : null;
  const submittedAt = new Date();
  const prisma = getPrisma();
  const duplicate = await prisma.client.findFirst({
    where: {
      OR: [
        { phoneNormalized: phone.normalized },
        {
          firstName: clientName.firstName,
          lastName: clientName.lastName,
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
      prisma.commissionPeriod.findUnique({ where: { month: monthKey(membershipSaleDate!) } }),
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
        firstName: clientName.firstName,
        lastName: clientName.lastName,
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
      const firstVisitCredit = isFirstVisitSale(firstVisitDate, membershipSaleDate!);
      const sale = await tx.membershipSale.create({
        data: {
          opportunityId: created.id,
          locationId: data.locationId,
          membershipSaleDate: membershipSaleDate!,
          membershipTypeId: soldMembershipSetup.membershipTypeId,
          finalPrimaryCloserId: data.proposedPrimaryCloserId,
          finalSupportCloserId: supportId,
          approvalStatus: "PENDING",
          isFirstVisitSale: firstVisitCredit,
          notes: data.notes || null,
          createdAt: submittedAt,
        },
      });
      await tx.saleCredit.createMany({
        data: createSaleCredits({
          saleId: sale.id,
          primaryStaffId: data.proposedPrimaryCloserId,
          supportStaffId: supportId,
          isFirstVisitSale: firstVisitCredit,
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
          newValue: dateInputValue(membershipSaleDate!),
        },
      });
    }
  });

  revalidateCommissionData();
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
  const membershipType = await prisma.membershipType.findFirst({
    where: { id: data.membershipTypeId, active: true },
  });
  if (!membershipType) {
    redirect(`/opportunities/${opportunity.id}?error=${encodeURIComponent("Select an active membership type.")}`);
  }
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
        fixedCommissionCents: membershipType.commissionKind === "FAMILY_UPGRADE_SPIFF"
          ? settings.familyUpgradeSpiffCents
          : undefined,
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

  revalidateCommissionData();
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
  revalidateCommissionData();
  redirect("/month-end");
}

export async function approveSpecialSpiffAction(formData: FormData) {
  const user = await requireCurrentUser();
  if (!canAdmin(user.role)) {
    redirect(`/month-end?error=${encodeURIComponent("Only administrators can approve Special Spiffs.")}`);
  }
  const parsed = specialSpiffApprovalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/month-end?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the Special Spiff approval.")}`);
  }
  const award = await getPrisma().specialSpiffAward.update({
    where: { id: parsed.data.specialSpiffAwardId },
    data: { approvalStatus: parsed.data.approval },
  });
  await auditAdminChange(
    user.role,
    parsed.data.approval === "APPROVED" ? "SPECIAL_SPIFF_APPROVED" : "SPECIAL_SPIFF_REJECTED",
    "SpecialSpiffAward",
    award.id,
    award.spiffNameSnapshot,
  );
  revalidatePath("/");
  revalidatePath("/commissions");
  revalidatePath("/month-end");
  redirect("/month-end");
}

export async function recordSpecialSpiffAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = specialSpiffAwardSchema.safeParse(Object.fromEntries(formData));
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!parsed.success) {
    redirect(`/opportunities/${opportunityId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the Special Spiff form.")}`);
  }
  const data = parsed.data;
  const prisma = getPrisma();
  const [opportunity, specialSpiff, location, currentStaff] = await Promise.all([
    prisma.membershipOpportunity.findUnique({ where: { id: data.opportunityId }, include: { client: true } }),
    prisma.specialSpiff.findUnique({ where: { id: data.specialSpiffId } }),
    prisma.location.findFirst({ where: { id: data.locationId, active: true } }),
    findStaffForUser(user),
  ]);
  if (!opportunity || !specialSpiff || !location) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("The client, Special Spiff, or location is unavailable.")}`);
  }
  const activityDate = toLocalDate(data.activityDate);
  if (!isSpecialSpiffAvailableForDate(specialSpiff, activityDate)) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("This Special Spiff is no longer active for the selected date.")}`);
  }
  const period = await prisma.commissionPeriod.findUnique({ where: { month: monthKey(activityDate) } });
  if (!assertCanEditPeriod(user.role, period?.status)) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("This commission month is finalized.")}`);
  }
  const staffId = canManage(user.role) ? data.staffId || currentStaff?.id : currentStaff?.id;
  if (!staffId) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("Your user access is not linked to commissionable staff.")}`);
  }
  if (
    !canManage(user.role) &&
    opportunity.proposedPrimaryCloserId !== staffId &&
    opportunity.proposedSupportCloserId !== staffId
  ) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("You can only record a Special Spiff for a customer assigned to you.")}`);
  }
  const staff = await prisma.staff.findFirst({ where: { id: staffId, active: true } });
  if (!staff) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("Select an active commissionable staff member.")}`);
  }
  const existing = await prisma.specialSpiffAward.findUnique({
    where: { specialSpiffId_clientId: { specialSpiffId: specialSpiff.id, clientId: opportunity.clientId } },
  });
  if (existing) {
    redirect(`/opportunities/${data.opportunityId}?error=${encodeURIComponent("This Special Spiff has already been recorded for this customer.")}`);
  }
  const award = await prisma.specialSpiffAward.create({
    data: {
      specialSpiffId: specialSpiff.id,
      clientId: opportunity.clientId,
      staffId: staff.id,
      locationId: location.id,
      activityDate,
      approvalStatus: "PENDING",
      spiffNameSnapshot: specialSpiff.name,
      functionDescriptionSnapshot: specialSpiff.functionDescription,
      amountCentsSnapshot: specialSpiff.amountCents,
      notes: data.notes || null,
    },
  });
  await auditAdminChange(user.role, "SPECIAL_SPIFF_RECORDED", "SpecialSpiffAward", award.id, `${specialSpiff.name}: ${staff.displayName}`);
  revalidatePath("/");
  revalidatePath("/commissions");
  revalidatePath("/month-end");
  revalidatePath(`/opportunities/${data.opportunityId}`);
  redirect(`/opportunities/${data.opportunityId}?spiff=1`);
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
  const pendingSpecialSpiffs = await prisma.specialSpiffAward.count({
    where: { ...specialSpiffMonthWhere(month), approvalStatus: "PENDING" },
  });
  if (pending > 0 || pendingSpecialSpiffs > 0) {
    redirect(`/month-end?month=${month}&error=${encodeURIComponent("Approve or reject pending membership sales and Special Spiffs before finalizing.")}`);
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
        membershipSpiffCents: result.membershipSpiffCents,
        specialSpiffCents: result.specialSpiffCents,
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
    redirect(`/admin?section=commission&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the staff form.")}`);
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
  redirect("/admin?section=commission&staff=created");
}

export async function updateStaffAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.staffId) {
    redirect(`/admin?section=commission&error=${encodeURIComponent(parsed.success ? "Missing staff record." : parsed.error.issues[0]?.message ?? "Check the staff form.")}`);
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
  redirect("/admin?section=commission&staff=updated");
}

export async function createMembershipTypeAction(formData: FormData) {
  const user = await requireCurrentUser();
  requireAdmin(user.role);
  const parsed = membershipTypeCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the membership type.")}`);
  }
  const existing = await getPrisma().membershipType.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    redirect(`/admin?error=${encodeURIComponent("A membership type with this name already exists.")}`);
  }
  const membershipType = await getPrisma().membershipType.create({
    data: { name: parsed.data.name, active: true, commissionKind: "STANDARD" },
  });
  await auditAdminChange(user.role, "MEMBERSHIP_TYPE_CREATED", "MembershipType", membershipType.id, membershipType.name);
  revalidatePath("/admin");
  redirect("/admin?membershipType=created");
}

export async function updateMembershipTypeAction(formData: FormData) {
  const user = await requireCurrentUser();
  requireAdmin(user.role);
  const parsed = membershipTypeEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the membership type.")}`);
  }
  const duplicate = await getPrisma().membershipType.findFirst({
    where: { name: parsed.data.name, NOT: { id: parsed.data.membershipTypeId } },
  });
  if (duplicate) {
    redirect(`/admin?error=${encodeURIComponent("A different membership type already uses this name.")}`);
  }
  const membershipType = await getPrisma().membershipType.update({
    where: { id: parsed.data.membershipTypeId },
    data: { name: parsed.data.name, active: parsed.data.active === "true" },
  });
  await auditAdminChange(user.role, "MEMBERSHIP_TYPE_EDITED", "MembershipType", membershipType.id, membershipType.name);
  revalidatePath("/admin");
  revalidatePath("/opportunities");
  redirect("/admin?membershipType=updated");
}

export async function createSpecialSpiffAction(formData: FormData) {
  const user = await requireCurrentUser();
  requireAdmin(user.role);
  const parsed = specialSpiffCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the Special Spiff.")}`);
  }
  const amountCents = dollarInputToCents(parsed.data.amount);
  if (amountCents === null || amountCents <= 0) {
    redirect(`/admin?error=${encodeURIComponent("Enter a Special Spiff amount greater than zero.")}`);
  }
  const existing = await getPrisma().specialSpiff.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    redirect(`/admin?error=${encodeURIComponent("A Special Spiff with this name already exists.")}`);
  }
  const specialSpiff = await getPrisma().specialSpiff.create({
    data: {
      name: parsed.data.name,
      functionDescription: parsed.data.functionDescription,
      amountCents,
      endDate: parsed.data.endDate ? toLocalDate(parsed.data.endDate) : null,
      active: true,
    },
  });
  await auditAdminChange(user.role, "SPECIAL_SPIFF_CREATED", "SpecialSpiff", specialSpiff.id, specialSpiff.name);
  revalidatePath("/admin");
  redirect("/admin?specialSpiff=created");
}

export async function updateSpecialSpiffAction(formData: FormData) {
  const user = await requireCurrentUser();
  requireAdmin(user.role);
  const parsed = specialSpiffEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the Special Spiff.")}`);
  }
  const amountCents = dollarInputToCents(parsed.data.amount);
  if (amountCents === null || amountCents <= 0) {
    redirect(`/admin?error=${encodeURIComponent("Enter a Special Spiff amount greater than zero.")}`);
  }
  const duplicate = await getPrisma().specialSpiff.findFirst({
    where: { name: parsed.data.name, NOT: { id: parsed.data.specialSpiffId } },
  });
  if (duplicate) {
    redirect(`/admin?error=${encodeURIComponent("A different Special Spiff already uses this name.")}`);
  }
  const specialSpiff = await getPrisma().specialSpiff.update({
    where: { id: parsed.data.specialSpiffId },
    data: {
      name: parsed.data.name,
      functionDescription: parsed.data.functionDescription,
      amountCents,
      endDate: parsed.data.endDate ? toLocalDate(parsed.data.endDate) : null,
      active: parsed.data.active === "true",
    },
  });
  await auditAdminChange(user.role, "SPECIAL_SPIFF_EDITED", "SpecialSpiff", specialSpiff.id, specialSpiff.name);
  revalidatePath("/admin");
  redirect("/admin?specialSpiff=updated");
}

export async function deleteSpecialSpiffAction(formData: FormData) {
  const user = await requireCurrentUser();
  requireAdmin(user.role);
  const parsed = specialSpiffDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?error=${encodeURIComponent("Special Spiff was not found.")}`);
  }
  const prisma = getPrisma();
  const specialSpiff = await prisma.specialSpiff.findUnique({
    where: { id: parsed.data.specialSpiffId },
    include: { _count: { select: { awards: true } } },
  });
  if (!specialSpiff) {
    redirect(`/admin?error=${encodeURIComponent("Special Spiff was not found.")}`);
  }
  if (specialSpiff._count.awards > 0) {
    await prisma.specialSpiff.update({ where: { id: specialSpiff.id }, data: { active: false } });
  } else {
    await prisma.specialSpiff.delete({ where: { id: specialSpiff.id } });
  }
  await auditAdminChange(user.role, "SPECIAL_SPIFF_DELETED", "SpecialSpiff", specialSpiff.id, specialSpiff.name);
  revalidatePath("/admin");
  redirect("/admin?specialSpiff=deleted");
}

export async function updateCommissionSettingAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = commissionSettingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=commission&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the commission setting.")}`);
  }

  const prisma = getPrisma();
  const setting = await prisma.commissionSetting.findUnique({ where: { id: parsed.data.settingId } });
  if (!setting) {
    redirect(`/admin?section=commission&error=${encodeURIComponent("Commission setting was not found.")}`);
  }

  const normalizedValue = normalizeSettingValue(setting.key, parsed.data.value);
  if (!normalizedValue) {
    redirect(`/admin?section=commission&error=${encodeURIComponent("Enter a valid setting value.")}`);
  }

  if (setting.key === "primarySplitBasisPoints" || setting.key === "supportSplitBasisPoints") {
    const siblingKey = setting.key === "primarySplitBasisPoints" ? "supportSplitBasisPoints" : "primarySplitBasisPoints";
    const sibling = await prisma.commissionSetting.findUnique({ where: { key: siblingKey } });
    if (sibling && Number(normalizedValue) + Number(sibling.value) !== 10000) {
      redirect(`/admin?section=commission&error=${encodeURIComponent("Primary and support split percentages must equal 100%.")}`);
    }
  }

  await prisma.commissionSetting.update({
    where: { id: setting.id },
    data: { value: normalizedValue },
  });
  await auditAdminChange(role, "COMMISSION_SETTING_EDITED", "CommissionSetting", setting.id, `${setting.label}: ${normalizedValue}`);
  revalidateCommissionData();
  redirect("/admin?section=commission&settings=updated");
}

export async function updateCrmStepTemplateAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = crmStepTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=other&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the CRM step.")}`);
  }

  const existing = await getPrisma().crmStepTemplate.findUnique({ where: { id: parsed.data.stepId } });
  if (!existing || existing.key !== parsed.data.key) {
    redirect(`/admin?section=other&error=${encodeURIComponent("CRM step was not found.")}`);
  }

  const step = await getPrisma().crmStepTemplate.update({
    where: { id: existing.id },
    data: { content: parsed.data.content },
  });
  await auditAdminChange(role, "CRM_STEP_TEMPLATE_EDITED", "CrmStepTemplate", step.id, step.label);
  revalidatePath("/admin");
  redirect("/admin?section=other&crm=updated");
}

export async function updateClientRecordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = clientRecordEditSchema.safeParse(Object.fromEntries(formData));
  const clientId = String(formData.get("clientId") ?? "");
  if (!parsed.success) {
    redirect(adminClientRedirect(clientId, `error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the client record.")}`));
  }

  const data = parsed.data;
  const prisma = getPrisma();
  const existing = await prisma.client.findUnique({
    where: { id: data.clientId },
    include: { opportunity: { include: { sale: { include: { credits: true } } } } },
  });
  if (!existing || !existing.opportunity || existing.opportunity.id !== data.opportunityId) {
    redirect(adminClientRedirect(data.clientId, `error=${encodeURIComponent("Client record was not found.")}`));
  }
  const existingSale = existing.opportunity.sale;

  const phone = normalizePhone(data.phone);
  const firstVisitDate = toLocalDate(data.firstVisitDate);
  if (existingSale && !data.membershipSaleDate) {
    redirect(adminClientRedirect(data.clientId, `error=${encodeURIComponent("Membership sale date is required for a sold membership.")}`));
  }
  const membershipSaleDate = existingSale ? toLocalDate(data.membershipSaleDate!) : null;
  const supportCloserId = data.proposedSupportCloserId || null;
  const saleClosersChanged = Boolean(
    existingSale &&
      saleCloserAssignmentsChanged(existingSale, data.proposedPrimaryCloserId, supportCloserId),
  );
  const saleCreditSettings = saleClosersChanged
    ? settingsFromRows(await prisma.commissionSetting.findMany())
    : null;
  const saleDateChanged = Boolean(
    existingSale &&
      membershipSaleDate &&
      dateInputValue(existingSale.membershipSaleDate) !== dateInputValue(membershipSaleDate),
  );
  const firstVisitCredit = membershipSaleDate ? isFirstVisitSale(firstVisitDate, membershipSaleDate) : false;
  const lastFollowUpDate = optionalDate(data.lastFollowUpDate);
  const nextFollowUpDate = optionalDate(data.nextFollowUpDate);
  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: data.clientId },
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
    await tx.membershipOpportunity.update({
      where: { id: data.opportunityId },
      data: {
        locationId: data.locationId,
        firstVisitTherapistId: data.firstVisitTherapistId || null,
        interestLevel: data.interestLevel,
        proposedPrimaryCloserId: data.proposedPrimaryCloserId,
        proposedSupportCloserId: supportCloserId,
        collectedBy: data.collectedBy,
        status: data.opportunityStatus,
        closureReason: data.closureReason || null,
        closureNote: data.closureNote || null,
        followUpStatus: data.followUpStatus,
        followUpNotes: data.followUpNotes || null,
        lastFollowUpDate,
        nextFollowUpDate,
      },
    });
    if (existingSale && membershipSaleDate) {
      await tx.membershipSale.update({
        where: { id: existingSale.id },
        data: {
          locationId: data.locationId,
          membershipSaleDate,
          finalPrimaryCloserId: data.proposedPrimaryCloserId,
          finalSupportCloserId: supportCloserId,
          isFirstVisitSale: firstVisitCredit,
        },
      });
      if (saleClosersChanged && saleCreditSettings) {
        await tx.saleCredit.deleteMany({ where: { saleId: existingSale.id } });
        await tx.saleCredit.createMany({
          data: createSaleCredits({
            saleId: existingSale.id,
            primaryStaffId: data.proposedPrimaryCloserId,
            supportStaffId: supportCloserId,
            isFirstVisitSale: firstVisitCredit,
            settings: saleCreditSettings,
          }),
        });
      } else {
        for (const credit of existingSale.credits) {
          await tx.saleCredit.update({
            where: { id: credit.id },
            data: {
              firstVisitCreditUnits: basisPointsToDecimalString(firstVisitCredit ? credit.creditBasisPoints : 0),
            },
          });
        }
      }
      if (saleClosersChanged) {
        await tx.auditLog.create({
          data: {
            actingUser: role,
            action: "MEMBERSHIP_SALE_CLOSERS_EDITED",
            recordType: "MembershipSale",
            recordId: existingSale.id,
            previousValue: `${existingSale.finalPrimaryCloserId}/${existingSale.finalSupportCloserId ?? ""}`,
            newValue: `${data.proposedPrimaryCloserId}/${supportCloserId ?? ""}`,
          },
        });
      }
      if (saleDateChanged) {
        await tx.auditLog.create({
          data: {
            actingUser: role,
            action: "MEMBERSHIP_SALE_DATE_EDITED",
            recordType: "MembershipSale",
            recordId: existingSale.id,
            previousValue: dateInputValue(existingSale.membershipSaleDate),
            newValue: dateInputValue(membershipSaleDate),
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "CLIENT_RECORD_UPDATED",
        recordType: "Client",
        recordId: data.clientId,
        previousValue: `${existing.firstName} ${existing.lastName}`,
        newValue: `${data.firstName} ${data.lastName}`,
      },
    });
  });

  revalidateCommissionData();
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${data.opportunityId}`);
  redirect(adminClientRedirect(data.clientId, "clientUpdated=1"));
}

export async function deleteClientRecordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const role = user.role;
  requireAdmin(role);
  const parsed = clientRecordDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=clients&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Client record was not found.")}`);
  }

  const prisma = getPrisma();
  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { opportunity: { include: { sale: true } } },
  });
  if (!client) {
    redirect(`/admin?section=clients&error=${encodeURIComponent("Client record was not found.")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        actingUser: role,
        action: "CLIENT_RECORD_DELETED",
        recordType: "Client",
        recordId: client.id,
        newValue: `${client.firstName} ${client.lastName}`,
      },
    });
    if (client.opportunity?.sale) {
      await tx.saleCredit.deleteMany({ where: { saleId: client.opportunity.sale.id } });
      await tx.membershipSale.delete({ where: { id: client.opportunity.sale.id } });
    }
    if (client.opportunity) {
      await tx.membershipOpportunity.delete({ where: { id: client.opportunity.id } });
    }
    await tx.client.delete({ where: { id: client.id } });
  });

  revalidateCommissionData();
  revalidatePath("/opportunities");
  redirect("/admin?section=clients&clientDeleted=1");
}

export async function createUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=users&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the user form.")}`);
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email.toLowerCase();
  const existing = await getPrisma().user.findFirst({
    where: { OR: [{ email }, { username: email }] },
  });
  if (existing) {
    redirect(`/admin?section=users&error=${encodeURIComponent("A user with that email already exists.")}`);
  }
  if (data.staffId && await getPrisma().user.findFirst({ where: { staffId: data.staffId } })) {
    redirect(`/admin?error=${encodeURIComponent("That commissionable staff member is already linked to another user.")}`);
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
      staffId: data.staffId || null,
    },
  });
  await auditAdminChange(role, "USER_CREATED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?section=users&user=created");
}

export async function updateUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=users&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the user form.")}`);
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  const email = data.email.toLowerCase();
  const existing = await getPrisma().user.findFirst({
    where: { OR: [{ email }, { username: email }], NOT: { id: data.userId } },
  });
  if (existing) {
    redirect(`/admin?section=users&error=${encodeURIComponent("A different user already has that email.")}`);
  }
  if (data.staffId && await getPrisma().user.findFirst({ where: { staffId: data.staffId, NOT: { id: data.userId } } })) {
    redirect(`/admin?error=${encodeURIComponent("That commissionable staff member is already linked to another user.")}`);
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
      staffId: data.staffId || null,
      ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
    },
  });
  await auditAdminChange(role, "USER_EDITED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?section=users&user=updated");
}

export async function deactivateUserAction(formData: FormData) {
  const userSession = await requireCurrentUser();
  const role = userSession.role;
  requireAdmin(role);
  const parsed = userDeactivateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/admin?section=users&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Missing user.")}`);
  }
  const user = await getPrisma().user.update({
    where: { id: parsed.data.userId },
    data: { active: false },
  });
  await auditAdminChange(role, "USER_DEACTIVATED", "User", user.id, user.email ?? user.username);
  revalidatePath("/admin");
  redirect("/admin?section=users&user=deactivated");
}

function requireAdmin(role: string) {
  if (!canAdmin(role)) {
    redirect(`/admin?error=${encodeURIComponent("Only administrators can change administration settings.")}`);
  }
}

function normalizeSettingValue(key: string, value: string) {
  if (["tier1.rateCents", "tier2.rateCents", "tier3.rateCents", "firstVisitBonusCents", "familyUpgradeSpiffCents"].includes(key)) {
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

function optionalDate(value: string | undefined) {
  return value ? toLocalDate(value) : null;
}

function adminClientRedirect(clientId: string, query: string) {
  return `/admin?section=clients&clientId=${encodeURIComponent(clientId)}&${query}#client-editor`;
}

function revalidateCommissionData() {
  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath("/commissions");
  revalidatePath("/month-end");
  revalidatePath("/admin");
}
