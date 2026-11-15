"use client";

import { useActionState } from "react";
import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const idle: ProjectFormState = { error: null, saved: false };

export function NewProjectForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(createProjectAction, idle);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-[1fr_140px_auto] items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="projectName">Project name</Label>
          <Input id="projectName" name="name" required placeholder="Website redesign" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="projectRate">Hourly rate</Label>
          <Input
            id="projectRate"
            name="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            placeholder="75.00"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add project"}
        </Button>
      </div>
      <p className="text-2xs text-faint">
        Rate is per hour, in your business currency. Leave empty for
        fixed-price work.
      </p>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-success" role="status">
          Project added.
        </p>
      ) : null}
    </form>
  );
}

export function EditProjectForm({
  project,
}: {
  project: {
    id: string;
    clientId: string;
    name: string;
    hourlyRateMinor: number | null;
    status: string;
    notes: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProjectAction, idle);

  return (
    <form action={formAction} className="flex flex-col gap-3 py-2">
      <input type="hidden" name="id" value={project.id} />
      <input type="hidden" name="clientId" value={project.clientId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${project.id}`}>Name</Label>
          <Input id={`name-${project.id}`} name="name" defaultValue={project.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rate-${project.id}`}>Hourly rate</Label>
          <Input
            id={`rate-${project.id}`}
            name="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={
              project.hourlyRateMinor === null
                ? ""
                : project.hourlyRateMinor / 100
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`status-${project.id}`}>Status</Label>
          <select
            id={`status-${project.id}`}
            name="status"
            defaultValue={project.status}
            className="h-9 w-full rounded-md border border-border-subtle bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : state.saved ? "Saved" : "Save project"}
          </Button>
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
