import {
  createStaffAction,
  createUserAction,
  deactivateUserAction,
  updateCommissionSettingAction,
  updateStaffAction,
  updateUserAction,
} from "@/app/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminData, getClientLookupData, getFormOptions } from "@/lib/data";
import { basisPointsToPercentInput, centsToDollarInput, dateInputValue, displayStatus, formatDateTime } from "@/lib/format";
import { canAdmin, roleLabel, roles, staffJobs } from "@/lib/roles";
import { getCurrentRole } from "@/lib/session";
import { AdminPanel } from "./admin-panel";
import { CrmStepsEditor } from "./crm-steps-editor";
import { ClientRecordEditor } from "./client-record-editor";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const [role, params] = await Promise.all([getCurrentRole(), searchParams]);
  const isAdmin = canAdmin(role);
  if (!isAdmin) {
    redirect("/");
  }
  const [data, clientLookup, formOptions] = await Promise.all([
    getAdminData(),
    getClientLookupData(params),
    getFormOptions(),
  ]);
  const error = scalar(params.error);
  const clientUpdated = scalar(params.clientUpdated) === "1";
  const clientDeleted = scalar(params.clientDeleted) === "1";

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-title">Administration</h1>
        <p className="text-[var(--text-muted)]">Manage local users, staff jobs, and commission settings.</p>
      </div>
      {error ? <p className="message border-[var(--orange)]">{error}</p> : null}
      {clientUpdated ? <p className="message border-[var(--teal)]">Client record updated.</p> : null}
      {clientDeleted ? <p className="message border-[var(--teal)]">Client record deleted.</p> : null}
      <AdminPanel title="Create User Access">
        <form action={createUserAction} className="grid gap-3 md:grid-cols-6">
          <input className="field md:col-span-2" name="displayName" placeholder="Name" required disabled={!isAdmin} />
          <select className="field" name="role" required disabled={!isAdmin}>
            {roles.map((userRole) => (
              <option key={userRole} value={userRole}>{roleLabel(userRole)}</option>
            ))}
          </select>
          <input className="field" name="phone" placeholder="Phone" required disabled={!isAdmin} />
          <input className="field" name="email" type="email" placeholder="Email / user name" required disabled={!isAdmin} />
          <input className="field" name="password" type="password" placeholder="Password" required disabled={!isAdmin} />
          <button className="button-primary md:col-span-6" type="submit" disabled={!isAdmin}>Create user access</button>
        </form>
      </AdminPanel>

      <AdminPanel title="Users">
        <div className="space-y-3">
          {data.users.map((user) => (
            <div key={user.id} className="rounded-[8px] border border-[var(--border)] p-3">
              <form action={updateUserAction} className="grid gap-3 md:grid-cols-7">
                <input type="hidden" name="userId" value={user.id} />
                <input className="field md:col-span-2" name="displayName" defaultValue={user.displayName} required disabled={!isAdmin} />
                <select className="field" name="role" defaultValue={user.role} disabled={!isAdmin}>
                  {roles.map((userRole) => (
                    <option key={userRole} value={userRole}>{roleLabel(userRole)}</option>
                  ))}
                </select>
                <input className="field" name="phone" defaultValue={user.phoneDisplay ?? ""} placeholder="Phone" required disabled={!isAdmin} />
                <input className="field" name="email" type="email" defaultValue={user.email ?? ""} placeholder="Email" required disabled={!isAdmin} />
                <input className="field" name="password" type="password" placeholder="New password" disabled={!isAdmin} />
                <select className="field" name="active" defaultValue={user.active ? "true" : "false"} disabled={!isAdmin}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
                <div className="flex flex-wrap gap-2 md:col-span-7">
                  <button className="button-primary" type="submit" disabled={!isAdmin}>Save user</button>
                  <button form={`deactivate-${user.id}`} className="button-danger" type="submit" disabled={!isAdmin || !user.active}>Delete access</button>
                  <span className={user.active ? "badge badge-teal" : "badge badge-gray"}>{user.active ? "Can login" : "Login disabled"}</span>
                </div>
              </form>
              <form id={`deactivate-${user.id}`} action={deactivateUserAction}>
                <input type="hidden" name="userId" value={user.id} />
              </form>
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Add Commissionable Staff">
        <form action={createStaffAction} className="grid gap-3 md:grid-cols-5">
          <input className="field" name="firstName" placeholder="First name" required disabled={!isAdmin} />
          <input className="field" name="lastName" placeholder="Last name" disabled={!isAdmin} />
          <input className="field" name="displayName" placeholder="Display name" required disabled={!isAdmin} />
          <select className="field" name="role" required disabled={!isAdmin}>
            {staffJobs.map((job) => (
              <option key={job} value={job}>{roleLabel(job)}</option>
            ))}
          </select>
          <button className="button-primary" type="submit" disabled={!isAdmin}>Add commissionable staff</button>
        </form>
      </AdminPanel>

      <AdminPanel title="Commissionable Staff">
        <div className="space-y-3">
          {data.staff.map((person) => (
            <form key={person.id} action={updateStaffAction} className="grid gap-3 rounded-[8px] border border-[var(--border)] p-3 md:grid-cols-6">
              <input type="hidden" name="staffId" value={person.id} />
              <input className="field" name="firstName" defaultValue={person.firstName} required disabled={!isAdmin} />
              <input className="field" name="lastName" defaultValue={person.lastName ?? ""} disabled={!isAdmin} />
              <input className="field" name="displayName" defaultValue={person.displayName} required disabled={!isAdmin} />
              <select className="field" name="role" defaultValue={person.role} disabled={!isAdmin}>
                {staffJobs.map((job) => (
                  <option key={job} value={job}>{roleLabel(job)}</option>
                ))}
              </select>
              <select className="field" name="active" defaultValue={person.active ? "true" : "false"} disabled={!isAdmin}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button className="button-primary" type="submit" disabled={!isAdmin}>Save staff</button>
            </form>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="Commission Settings">
        <div className="space-y-3">
          {data.settings.map((setting) => (
            <form key={setting.id} action={updateCommissionSettingAction} className="grid gap-3 rounded-[8px] border border-[var(--border)] p-3 md:grid-cols-[1.5fr_1fr_auto]">
              <input type="hidden" name="settingId" value={setting.id} />
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-[var(--text-muted)]">{setting.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{settingHelp(setting.key)}</span>
              </label>
              <input className="field" name="value" defaultValue={settingInputValue(setting.key, setting.value)} inputMode="decimal" disabled={!isAdmin} />
              <button className="button-primary" type="submit" disabled={!isAdmin}>Save setting</button>
            </form>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel title="CRM Steps">
        <CrmStepsEditor steps={data.crmSteps} />
      </AdminPanel>

      <section className="grid gap-4 lg:grid-cols-2">
        <AdminPanel title="Locations">
          <ListRows rows={data.locations.map((location) => [location.code, location.name, location.active ? "Active" : "Inactive"])} />
        </AdminPanel>
        <AdminPanel title="Membership Types">
          <ListRows rows={data.membershipTypes.map((type) => [type.name, type.active ? "Active" : "Inactive", ""])} />
        </AdminPanel>
      </section>

      <div id="client-editor">
        <AdminPanel title="Client Lookup" initialOpen={Boolean(clientLookup.selected)}>
          <div className="space-y-4">
            <form className="card card-soft grid gap-3 p-4 md:grid-cols-4">
              <input className="field" name="clientSearch" placeholder="Search name or phone" defaultValue={clientLookup.search ?? ""} />
              <select className="field" name="clientLocationId" defaultValue={clientLookup.locationId ?? ""}>
                <option value="">All locations</option>
                {formOptions.locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
              </select>
              <select className="field" name="clientCloserId" defaultValue={clientLookup.closerId ?? ""}>
                <option value="">All closers</option>
                {formOptions.staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
              </select>
              <button className="button-primary" type="submit">Find clients</button>
            </form>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>First Visit</th>
                    <th>Location</th>
                    <th>Primary</th>
                    <th>Status</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {clientLookup.rows.map((client) => (
                    <tr key={client.id}>
                      <td>{client.firstName} {client.lastName}</td>
                      <td>{dateInputValue(client.firstVisitDate)}</td>
                      <td>{client.opportunity?.location.code ?? "-"}</td>
                      <td>{client.opportunity?.proposedPrimaryCloser.displayName ?? "-"}</td>
                      <td>{client.opportunity ? displayStatus(client.opportunity.status) : "-"}</td>
                      <td>
                        <Link className="font-semibold text-[var(--teal)]" href={clientLookupHref(clientLookup, client.id)}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {clientLookup.rows.length === 0 ? <p className="empty-state">No clients match these filters.</p> : null}

            {clientLookup.selected ? (
              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="section-title mb-3">Edit Client Record</h3>
                <ClientRecordEditor client={clientLookup.selected} options={formOptions} />
              </div>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Audit History">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Record</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{displayStatus(log.actingUser)}</td>
                  <td>{displayStatus(log.action)}</td>
                  <td>{log.recordType}</td>
                  <td>{log.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

function clientLookupHref(
  lookup: Awaited<ReturnType<typeof getClientLookupData>>,
  clientId: string,
) {
  const query = new URLSearchParams();
  if (lookup.search) query.set("clientSearch", lookup.search);
  if (lookup.locationId) query.set("clientLocationId", lookup.locationId);
  if (lookup.closerId) query.set("clientCloserId", lookup.closerId);
  query.set("clientId", clientId);
  return `/admin?${query.toString()}#client-editor`;
}

function settingInputValue(key: string, value: string) {
  if (["tier1.rateCents", "tier2.rateCents", "tier3.rateCents", "firstVisitBonusCents"].includes(key)) {
    return centsToDollarInput(value);
  }
  if (["primarySplitBasisPoints", "supportSplitBasisPoints"].includes(key)) {
    return basisPointsToPercentInput(value);
  }
  return value;
}

function settingHelp(key: string) {
  if (["tier1.rateCents", "tier2.rateCents", "tier3.rateCents", "firstVisitBonusCents"].includes(key)) {
    return "Dollar amount, for example 25.00";
  }
  if (["primarySplitBasisPoints", "supportSplitBasisPoints"].includes(key)) {
    return "Percent, for example 70.00";
  }
  return "Credit count";
}

function ListRows({ rows }: { rows: string[][] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.join("-")} className="border-b border-[var(--border)] pb-2">
          <p className="font-semibold">{row[0]}</p>
          <p className="text-sm text-[var(--text-muted)]">{row.filter(Boolean).slice(1).join(" - ")}</p>
        </div>
      ))}
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
