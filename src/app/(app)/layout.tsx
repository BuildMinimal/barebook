import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const owner = await requireOwner();

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-56 flex-col justify-between border-r border-border-subtle bg-surface px-4 py-6">
        <div className="flex flex-col gap-8">
          <span className="px-3 text-base font-semibold tracking-tight">
            Barebook
          </span>
          <NavLinks />
        </div>
        <div className="flex flex-col gap-2 px-3">
          <p className="truncate text-2xs text-faint" title={owner.email}>
            {owner.email}
          </p>
          <form action={logoutAction}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="w-full justify-start"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-10 py-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
