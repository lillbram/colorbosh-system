import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  isMoney?: boolean;
  trend?: { direction: "up" | "down" | "none"; percent: number };
  footer?: string;
  info?: React.ReactNode;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  isMoney = false,
  trend,
  footer,
  info,
}: StatCardProps) {
  const displayValue = isMoney && typeof value === "number" ? formatIDR(value) : value;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-sm text-muted">
        <Icon className="size-4" />
        <span>{label}</span>
        {info && <InfoTooltip>{info}</InfoTooltip>}
      </div>
      <div className="font-mono-num mt-2 text-[28px] font-bold text-ink">
        {displayValue}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
              trend.direction === "up" && "bg-success/10 text-success",
              trend.direction === "down" && "bg-danger/10 text-danger",
              trend.direction === "none" && "bg-black/5 text-muted"
            )}
          >
            {trend.direction === "up" && <TrendingUp className="size-3" />}
            {trend.direction === "down" && <TrendingDown className="size-3" />}
            {trend.percent}%
          </span>
          {footer && <span className="text-xs text-muted">{footer}</span>}
        </div>
      )}
    </Card>
  );
}
