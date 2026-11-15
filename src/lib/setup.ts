import { getDb } from "@/db";
import { owners } from "@/db/schema";

/** True once at least one owner account exists. The setup wizard locks after that. */
export function hasOwner(): boolean {
  const row = getDb().select({ id: owners.id }).from(owners).limit(1).get();
  return !!row;
}
