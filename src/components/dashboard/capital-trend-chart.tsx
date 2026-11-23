"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatIDR } from "@/lib/format";

export function CapitalTrendChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatDate(d).slice(0, 5)}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 12 }}
        />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          labelFormatter={(d) => formatDate(String(d))}
          formatter={(value) => [formatIDR(Number(value)), "Modal sebelum gaji"]}
          contentStyle={{ borderRadius: 10, border: "1px solid #D5D3CE", fontSize: 12 }}
        />
        <Line type="monotone" dataKey="value" stroke="#3B4EA0" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
