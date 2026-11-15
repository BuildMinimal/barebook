"use client";

import { useActionState } from "react";
import { timeIdle } from "@/app/actions/time-state";
import { createTimeEntryAction } from "@/app/actions/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ManualEntryForm({
  projects,
  today,
}: {
  projects: { id: string; label: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    createTimeEntryAction,
    timeIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryProject">Project</Label>
          <Select id="entryProject" name="projectId" required>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryDate">Date</Label>
          <Input id="entryDate" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryStart">Started at</Label>
          <Input id="entryStart" name="startTime" type="time" defaultValue="09:00" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entryMinutes">Duration (minutes)</Label>
          <Input
            id="entryMinutes"
            name="minutes"
            type="number"
            min={1}
            max={1440}
            required
            placeholder="90"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="entryDescription">What did you work on?</Label>
          <Input
            id="entryDescription"
            name="description"
            placeholder="Homepage wireframes"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          name="billable"
          defaultChecked
          className="h-4 w-4 rounded-xs border-border-subtle accent-[var(--accent)]"
        />
        Billable
      </label>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-success" role="status">
          Entry added.
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
