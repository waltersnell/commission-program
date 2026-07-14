import Link from "next/link";
import { resetPasswordAction } from "@/app/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = scalar(params.error);
  const userName = scalar(params.userName) ?? "";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
      <section className="card w-full p-6">
        <div className="mb-5">
          <h1 className="page-title">Reset Password</h1>
          <p className="text-[var(--text-muted)]">Enter the user name, then create and confirm a new password.</p>
        </div>
        {error ? <p className="message mb-4 border-[var(--orange)]">{error}</p> : null}
        <form action={resetPasswordAction} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">User Name</span>
            <input className="field" name="userName" defaultValue={userName} autoComplete="username" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">New password</span>
            <input className="field" name="password" type="password" autoComplete="new-password" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Confirm new password</span>
            <input className="field" name="confirmPassword" type="password" autoComplete="new-password" required />
          </label>
          <button className="button-primary" type="submit">Save new password</button>
        </form>
        <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--teal)]" href="/login">
          Back to login
        </Link>
      </section>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
