"use client";

import { deleteClientRecordAction } from "@/app/actions";

export function DeleteClientRecordButton({ clientId }: { clientId: string }) {
  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm("Delete this client record and all related opportunity and sale history?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteClientRecordAction} onSubmit={confirmDelete}>
      <input type="hidden" name="clientId" value={clientId} />
      <button className="button-danger" type="submit">Delete client record</button>
    </form>
  );
}
