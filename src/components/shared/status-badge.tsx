import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "neutral" }> = {
  draft: { label: "Draft", variant: "neutral" },
  ordered: { label: "Dipesan", variant: "warning" },
  partially_received: { label: "Sebagian Diterima", variant: "warning" },
  received: { label: "Diterima", variant: "success" },
  cancelled: { label: "Dibatalkan", variant: "danger" },
  planned: { label: "Direncanakan", variant: "neutral" },
  in_progress: { label: "Diproses", variant: "warning" },
  finished: { label: "Selesai", variant: "success" },
  delivered: { label: "Terkirim", variant: "success" },
  pending: { label: "Menunggu", variant: "neutral" },
  due: { label: "Jatuh Tempo", variant: "warning" },
  paid: { label: "Lunas", variant: "success" },
  overdue: { label: "Terlambat", variant: "danger" },
  projected: { label: "Proyeksi", variant: "neutral" },
  eligible: { label: "Siap Dicairkan", variant: "warning" },
  requested: { label: "Dalam Proses", variant: "warning" },
  discrepancy: { label: "Selisih", variant: "danger" },
  not_created: { label: "Belum Dibuat", variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
