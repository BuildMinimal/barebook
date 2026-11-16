import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { deleteTimeEntryAction } from "@/app/actions/time";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";
import { formatDate, formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile } from "@/settings/store";
import { projectUninvoiced } from "@/lib/queries";
import { ManualEntryForm } from "./manual-entry-form";
import { RunningTimer } from "./timer-widget";
import { StartTimerForm } from "./start-timer-form";

export default async function TimePage() {
  const db = getDb();
  const business = getBusinessProfile();

  const projectRows = db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.name,
      clientId: clients.id,
      status: projects.status,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .all();

  const activeProjects = projectRows
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, label: `${p.clientName} — ${p.name}` }));

  const running = db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.billable, true))
    .all()
    .filter((e) => e.endedAt === null)
    .at(0);

  const runningInfo = running
    ? projectRows.find((p) => p.id === running.projectId)
    : undefined;

  const recent = db
    .select({
      id: timeEntries.id,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      description: timeEntries.description,
      billable: timeEntries.billable,
      invoiceId: timeEntries.invoiceId,
      projectName: projects.name,
      projectId: projects.id,
      clientName: clients.name,
      clientId: clients.id,
      rateMinor: projects.hourlyRateMinor,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .orderBy(desc(timeEntries.startedAt))
    .limit(50)
    .all();

  // uninvoiced rollup across all projects
  const rollup = projectRows.reduce(
    (acc, p) => {
      const project = db
        .select({ rate: projects.hourlyRateMinor })
        .from(projects)
        .where(eq(projects.id, p.id))
        .get();
      const { minutes, valueMinor } = projectUninvoiced(p.id, project?.rate ?? null);
      return {
        minutes: acc.minutes + minutes,
        valueMinor: acc.valueMinor + valueMinor,
      };
    },
    { minutes: 0, valueMinor: 0 },
  );

  const today = new Intl.DateTimeFormat("en-CA").format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Time</h1>
        <p className="mt-1 text-sm text-muted">
          {rollup.minutes > 0 ? (
            <>
              {Math.floor(rollup.minutes / 60)}h {rollup.minutes % 60}m of
              uninvoiced work, worth{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(rollup.valueMinor, business.currency)}
              </span>
            </>
          ) : (
            "Nothing uninvoiced — all caught up."
          )}
        </p>
      </header>

      {running && runningInfo ? (
        <RunningTimer
          startedAtMs={running.startedAt.getTime()}
          projectName={runningInfo.name}
          clientName={runningInfo.clientName}
        />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Start the timer</h2>
        {activeProjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-faint">
            No active projects yet.{" "}
            <Link href="/clients" className="underline hover:text-foreground">
              Add one on a client page
            </Link>{" "}
            first.
          </p>
        ) : running ? (
          <p className="text-2xs text-faint">
            The timer is already running — stop it before starting another.
          </p>
        ) : (
          <StartTimerForm projects={activeProjects} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Add time manually</h2>
        {activeProjects.length === 0 ? (
          <p className="text-2xs text-faint">Needs an active project.</p>
        ) : (
          <details className="rounded-lg border border-border-subtle bg-surface px-5 py-4">
            <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
              <span className="font-medium">Add a past entry</span>
              <span className="ml-2 text-faint">date, start, duration</span>
            </summary>
            <div className="mt-4">
              <ManualEntryForm projects={activeProjects} today={today} />
            </div>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Recent entries</h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-5 py-10 text-center text-sm text-faint">
            No time tracked yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted">
                    {formatDate(e.startedAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${e.clientId}`}
                      className="hover:underline"
                    >
                      {e.projectName}
                    </Link>
                    <span className="text-faint"> · {e.clientName}</span>
                  </TableCell>
                  <TableCell className="text-muted">
                    {e.description ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.endedAt
                      ? formatDuration(
                          Math.round(
                            (e.endedAt.getTime() - e.startedAt.getTime()) / 60000,
                          ),
                        )
                      : (
                        <Badge variant="success">running</Badge>
                      )}
                    <span className="ml-2 inline-flex gap-1">
                      {!e.billable ? <Badge variant="outline">non-billable</Badge> : null}
                      {e.invoiceId ? <Badge>invoiced</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted tabular-nums">
                    {e.endedAt && e.billable && !e.invoiceId && e.rateMinor
                      ? formatMoney(
                          Math.round(
                            (((e.endedAt.getTime() - e.startedAt.getTime()) / 60000) *
                              e.rateMinor) /
                              60,
                          ),
                          business.currency,
                        )
                      : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    {!e.invoiceId ? (
                      <form action={deleteTimeEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmSubmit
                          message="Delete this time entry?"
                          title="Delete entry"
                          iconOnly
                        >
                          Delete
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
