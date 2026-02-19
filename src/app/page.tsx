import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">Talkpush CRM Configuration</h1>
        <p className="mt-2 text-muted-foreground">Client configuration checklist management</p>
        <div className="mt-8">
          <Link href="/admin">
            <Button size="lg">Go to Admin Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
