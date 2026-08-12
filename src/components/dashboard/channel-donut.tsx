"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatIDR } from "@/lib/format";

type ChannelDatum = { name: string; value: number; color: string };

export function ChannelDonut({ data }: { data: ChannelDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0 || total === 0) {
    return <p className="py-8 text-center text-sm text-muted">Belum ada penjualan bulan ini.</p>;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={52}
              outerRadius={76}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-muted">Total</p>
          <p className="font-mono-num text-sm font-semibold text-ink">
            {formatIDR(total)}
          </p>
        </div>
      </div>

      <ul className="flex-1 space-y-3">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.name}
            </span>
            <span className="font-mono-num text-muted">
              {formatIDR(d.value)}
              <span className="ml-1.5 text-xs text-muted/70">
                ({Math.round((d.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
