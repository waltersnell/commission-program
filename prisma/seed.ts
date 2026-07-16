import { PrismaClient } from "@prisma/client";
import { createSaleCredits, isFirstVisitSale } from "../src/lib/commission";
import { getPrisma } from "../src/lib/db";
import { crmStepTemplates } from "../src/lib/crm-steps";
import { normalizePhone, toLocalDate } from "../src/lib/format";
import { hashPassword } from "../src/lib/passwords";

const prisma: PrismaClient = getPrisma();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.commissionResult.deleteMany();
  await prisma.commissionPeriod.deleteMany();
  await prisma.saleCredit.deleteMany();
  await prisma.membershipSale.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.membershipOpportunity.deleteMany();
  await prisma.client.deleteMany();
  await prisma.crmStepTemplate.deleteMany();
  await prisma.commissionSetting.deleteMany();
  await prisma.membershipType.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.staff.deleteMany();

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: "admin",
        displayName: "Local Administrator",
        role: "ADMINISTRATOR",
        phoneNormalized: "8585550101",
        phoneDisplay: "858-555-0101",
        email: "admin@thaisport.local",
        passwordHash: hashPassword("local-admin"),
      },
    }),
    prisma.user.create({
      data: {
        username: "manager",
        displayName: "Local Manager",
        role: "MANAGER",
        phoneNormalized: "8585550102",
        phoneDisplay: "858-555-0102",
        email: "manager@thaisport.local",
        passwordHash: hashPassword("local-manager"),
      },
    }),
    prisma.user.create({
      data: {
        username: "frontdesk",
        displayName: "Front Desk",
        role: "FRONT_DESK",
        phoneNormalized: "8585550103",
        phoneDisplay: "858-555-0103",
        email: "frontdesk@thaisport.local",
        passwordHash: hashPassword("local-frontdesk"),
      },
    }),
  ]);

  const staffRows = await Promise.all(
    ["Abbott", "Betsy", "Dennis", "Walter"].map((name) =>
      prisma.staff.create({
        data: {
          firstName: name,
          displayName: name,
          role: name === "Walter" ? "MANAGER" : name === "Dennis" ? "THERAPIST" : "SALES",
        },
      }),
    ),
  );
  const staff = Object.fromEntries(staffRows.map((person) => [person.displayName, person]));

  const locations = await Promise.all([
    prisma.location.create({ data: { code: "SV", name: "Sorrento Valley" } }),
    prisma.location.create({ data: { code: "RB", name: "Rancho Bernardo" } }),
    prisma.location.create({ data: { code: "DT", name: "Downtown/Little Italy" } }),
  ]);
  const locationByCode = Object.fromEntries(locations.map((location) => [location.code, location]));

  const membershipTypes = await Promise.all(
    ["Individual Membership", "Family Membership", "Returning Member Reactivation", "Other"].map((name) =>
      prisma.membershipType.create({ data: { name } }),
    ),
  );

  await Promise.all([
    prisma.commissionSetting.create({ data: { key: "tier1.upperCredits", label: "Tier 1 upper limit", value: "10" } }),
    prisma.commissionSetting.create({ data: { key: "tier1.rateCents", label: "Tier 1 rate", value: "2500" } }),
    prisma.commissionSetting.create({ data: { key: "tier2.upperCredits", label: "Tier 2 upper limit", value: "20" } }),
    prisma.commissionSetting.create({ data: { key: "tier2.rateCents", label: "Tier 2 rate", value: "3000" } }),
    prisma.commissionSetting.create({ data: { key: "tier3.rateCents", label: "Tier 3 rate", value: "4000" } }),
    prisma.commissionSetting.create({ data: { key: "firstVisitBonusCents", label: "First-visit bonus", value: "1000" } }),
    prisma.commissionSetting.create({ data: { key: "primarySplitBasisPoints", label: "Primary split percentage", value: "7000" } }),
    prisma.commissionSetting.create({ data: { key: "supportSplitBasisPoints", label: "Support split percentage", value: "3000" } }),
  ]);

  await prisma.crmStepTemplate.createMany({
    data: crmStepTemplates.map((template) => ({
      key: template.key,
      label: template.label,
      content: template.defaultContent,
      sortOrder: template.sortOrder,
    })),
  });

  async function createOpportunity(input: {
    firstName: string;
    lastName: string;
    phone: string;
    firstVisitDate: string;
    locationCode: string;
    primary: string;
    support?: string;
    therapist?: string;
    interestLevel?: string;
    status?: string;
    closureReason?: string;
    saleDate?: string;
    salePrimary?: string;
    saleSupport?: string;
    approvalStatus?: string;
  }) {
    const firstVisitDate = toLocalDate(input.firstVisitDate);
    const phone = normalizePhone(input.phone);
    const client = await prisma.client.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNormalized: phone.normalized,
        phoneDisplay: phone.display,
        email: `${input.firstName.toLowerCase()}.${input.lastName.toLowerCase()}@example.local`,
        firstVisitDate,
        sessionType: "Thai Sport",
        clientType: "Resident",
        primaryIssue: "Maintenance",
      },
    });
    const opportunity = await prisma.membershipOpportunity.create({
      data: {
        clientId: client.id,
        locationId: locationByCode[input.locationCode].id,
        firstVisitTherapistId: staff[input.therapist ?? "Dennis"]?.id,
        interestLevel: input.interestLevel ?? "Warm",
        proposedPrimaryCloserId: staff[input.primary].id,
        proposedSupportCloserId: input.support ? staff[input.support].id : null,
        status: input.status ?? "OPEN",
        closureReason: input.closureReason,
        followUpStatus: "Follow Up Needed",
      },
    });
    if (!input.saleDate) {
      return opportunity;
    }
    const saleDate = toLocalDate(input.saleDate);
    const firstVisit = isFirstVisitSale(firstVisitDate, saleDate);
    const finalSupport = input.saleSupport ? staff[input.saleSupport] : null;
    const sale = await prisma.membershipSale.create({
      data: {
        opportunityId: opportunity.id,
        locationId: locationByCode[input.locationCode].id,
        membershipSaleDate: saleDate,
        membershipTypeId: membershipTypes[0].id,
        finalPrimaryCloserId: staff[input.salePrimary ?? input.primary].id,
        finalSupportCloserId: finalSupport?.id,
        approvalStatus: input.approvalStatus ?? "PENDING",
        isFirstVisitSale: firstVisit,
      },
    });
    await prisma.membershipOpportunity.update({ where: { id: opportunity.id }, data: { status: "MEMBERSHIP_SOLD" } });
    await prisma.saleCredit.createMany({
      data: createSaleCredits({
        saleId: sale.id,
        primaryStaffId: staff[input.salePrimary ?? input.primary].id,
        supportStaffId: finalSupport?.id,
        isFirstVisitSale: firstVisit,
      }),
    });
    return opportunity;
  }

  await createOpportunity({ firstName: "Ari", lastName: "Nguyen", phone: "(858) 555-1201", firstVisitDate: "2026-07-01", locationCode: "SV", primary: "Abbott", saleDate: "2026-07-01" });
  await createOpportunity({ firstName: "Mina", lastName: "Patel", phone: "858.555.1202", firstVisitDate: "2026-07-03", locationCode: "RB", primary: "Betsy", support: "Dennis", saleDate: "2026-07-08", salePrimary: "Betsy", saleSupport: "Dennis" });
  await createOpportunity({ firstName: "Jon", lastName: "Reed", phone: "858-555-1203", firstVisitDate: "2026-07-06", locationCode: "DT", primary: "Dennis" });
  await createOpportunity({ firstName: "Lena", lastName: "Moss", phone: "858-555-1204", firstVisitDate: "2026-07-07", locationCode: "SV", primary: "Walter", support: "Abbott" });
  await createOpportunity({ firstName: "Chris", lastName: "Stone", phone: "858-555-1205", firstVisitDate: "2026-06-18", locationCode: "RB", primary: "Abbott", status: "CLOSED_NO_SALE", closureReason: "CLIENT_DECLINED" });
  await createOpportunity({ firstName: "Noor", lastName: "Ali", phone: "858-555-1206", firstVisitDate: "2026-07-10", locationCode: "DT", primary: "Betsy", saleDate: "2026-07-10" });

  await prisma.auditLog.create({
    data: {
      actingUser: users[0].username,
      action: "SEED_DATA_CREATED",
      recordType: "System",
      recordId: "seed",
      newValue: "Initial local demo data",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
