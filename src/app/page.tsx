import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-2xl font-semibold tracking-tight">Barebook</span>
      <p className="max-w-sm text-sm text-muted">
        The bare-necessities freelancer CRM. Clients, work, and money in one
        book.
      </p>
      <Badge variant="outline">pre-alpha</Badge>
    </main>
  );
}
