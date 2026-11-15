import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Outstanding, revenue, and nudges land here in a later milestone.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Your book is open</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Add a client, track some time, and send your first invoice. The
          seeded demo data is available if you ran <code>npm run db:seed</code>.
        </CardContent>
      </Card>
    </div>
  );
}
