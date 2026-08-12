"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatIDR } from "@/lib/format";

export function RevenueChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barCategoryGap={24}>
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 12 }}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "rgba(59,78,160,0.06)" }}
          formatter={(value) => formatIDR(Number(value))}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #D5D3CE",
            fontSize: 12,
          }}
        />
        <Bar dataKey="amount" fill="#3B4EA0" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
