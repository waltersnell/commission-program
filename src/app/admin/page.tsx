import {
  createStaffAction,
  createUserAction,
  deactivateUserAction,
  updateCommissionSettingAction,
  updateStaffAction,
  updateUserAction,
} from "@/app/actions";
import { getAdminData } from "@/lib/data";
import { basisPointsToPercentInput, centsToDollarInput, displayStatus } from "@/lib/format";
import { canAdmin, roleLabel, roles, staffJobs } from "@/lib/roles";
import { getCurrentRole } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const [data, role, params] = await Promise.all([getAdminData(), getCurrentRole(), searchParams]);
  const isAdmin = canAdmin(role);
  const error = scalar(params.error);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Administration</h1>
        <p className="text-[var(--text-muted)]">Manage local users, staff jobs, and commission settings.</p>
      </div>
      {error ? <p className="message border-[var(--orange)]">{error}</p> : null}
      {!isAdmin ? <p className="message">You are viewing administrator data in read-only mode.</p> : null}

      <section className="card p-4">
        <h2 className="section-title mb-3">Create User Access</h2>
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
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Users</h2>
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
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Add Commissionable Staff</h2>
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
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Commissionable Staff</h2>
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
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Commission Settings</h2>
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
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Locations" rows={data.locations.map((location) => [location.code, location.name, location.active ? "Active" : "Inactive"])} />
        <ListCard title="Membership Types" rows={data.membershipTypes.map((type) => [type.name, type.active ? "Active" : "Inactive", ""])} />
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Audit History</h2>
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
                  <td>{log.createdAt.toLocaleString()}</td>
                  <td>{displayStatus(log.actingUser)}</td>
                  <td>{displayStatus(log.action)}</td>
                  <td>{log.recordType}</td>
                  <td>{log.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
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

function ListCard({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">{title}</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.join("-")} className="border-b border-[var(--border)] pb-2">
            <p className="font-semibold">{row[0]}</p>
            <p className="text-sm text-[var(--text-muted)]">{row.filter(Boolean).slice(1).join(" - ")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
