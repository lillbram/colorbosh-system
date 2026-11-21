import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/" } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex-col items-start gap-1 pt-6">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
          C
        </div>
        <h1 className="text-h2 text-ink">Masukkan PIN</h1>
        <p className="text-sm text-muted">Aplikasi terkunci karena tidak dipakai beberapa menit.</p>
      </CardHeader>
      <CardContent>
        <UnlockForm next={next} />
      </CardContent>
    </Card>
  );
}
