"use client";

import { useEffect, useState } from "react";
import { stopTimerAction } from "@/app/actions/time";
import { Button } from "@/components/ui/button";
import { formatElapsed } from "@/lib/datetime";

/**
 * Live elapsed clock for the running timer. The tick is display-only —
 * the authoritative duration is computed from timestamps on stop.
 */
export function RunningTimer({
  startedAtMs,
  projectName,
  clientName,
}: {
  startedAtMs: number;
  projectName: string;
  clientName: string;
}) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-5 py-4">
      <div>
        <p className="text-sm font-medium">{projectName}</p>
        <p className="text-2xs text-faint">{clientName} · running since</p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className="font-mono text-2xl font-semibold tabular-nums"
          suppressHydrationWarning
        >
          {formatElapsed(elapsedSec)}
        </span>
        <form action={stopTimerAction}>
          <Button type="submit">Stop timer</Button>
        </form>
      </div>
    </div>
  );
}
