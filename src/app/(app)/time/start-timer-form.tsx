"use client";

import { startTimerAction } from "@/app/actions/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function StartTimerForm({
  projects,
}: {
  projects: { id: string; label: string }[];
}) {
  return (
    <form
      action={startTimerAction}
      className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-lg border border-border-subtle bg-surface px-5 py-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timerProject" className="text-sm font-medium">
          Project
        </label>
        <Select id="timerProject" name="projectId" required>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timerDescription" className="text-sm font-medium">
          What are you working on?
        </label>
        <Input
          id="timerDescription"
          name="description"
          placeholder="Optional note"
        />
      </div>
      <Button type="submit">Start timer</Button>
    </form>
  );
}
