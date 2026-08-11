import { getFormOptions } from "@/lib/data";
import { getCurrentRole } from "@/lib/session";
import { NewClientForm } from "./new-client-form";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewClientPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { staff, primaryCloserStaff, therapists, locations } = await getFormOptions();
  const role = await getCurrentRole();
  const error = scalar(params.error);
  const duplicate = scalar(params.duplicate);

  return (
    <div className="page-shell mx-auto max-w-5xl">
      <div>
        <h1 className="page-title">Add First-Time Client</h1>
        <p className="text-[var(--text-muted)]">Fast intake for front desk after first service payment.</p>
      </div>
      {error ? <p className="message border-[var(--orange)]">{error}</p> : null}
      {duplicate && role !== "FRONT_DESK" ? (
        <p className="message">Manager duplicate override is available. Submit again with the override checked if this is a valid new opportunity.</p>
      ) : null}

      <NewClientForm
        primaryCloserStaff={primaryCloserStaff.map((person) => ({ id: person.id, displayName: person.displayName }))}
        staff={staff.map((person) => ({ id: person.id, displayName: person.displayName }))}
        therapists={therapists.map((person) => ({ id: person.id, displayName: person.displayName }))}
        locations={locations.map((location) => ({ id: location.id, code: location.code, name: location.name }))}
        role={role}
        duplicate={duplicate}
      />
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
