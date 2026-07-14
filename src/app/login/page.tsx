import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const error = scalar(params.error);
  const message = scalar(params.message);
  const showForgot = scalar(params.showForgot) === "1";
  const userName = scalar(params.userName) ?? "";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
      <section className="card w-full p-6">
        <div className="mb-5">
          <h1 className="page-title">Thai Sport Commissions</h1>
          <p className="text-[var(--text-muted)]">Sign in to continue.</p>
        </div>
        {message ? <p className="message mb-4 border-[var(--teal)]">{message}</p> : null}
        {error ? <p className="message mb-4 border-[var(--orange)]">{error}</p> : null}
        <form action={loginAction} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">User Name</span>
            <input className="field" name="userName" defaultValue={userName} autoComplete="username" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Password</span>
            <input className="field" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button-primary" type="submit">Login</button>
        </form>
        {showForgot ? (
          <Link className="mt-4 inline-flex text-sm font-semibold text-[var(--teal)]" href={`/forgot-password?userName=${encodeURIComponent(userName)}`}>
            forgot password
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
