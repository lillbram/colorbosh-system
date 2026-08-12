"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatDate, formatIDR } from "@/lib/format";

const LINE_COLORS = ["#3B4EA0", "#D97757", "#1F7A3A", "#B45309", "#6B7280"];

type TrendDatum = { date: string } & Record<string, number | string>;

export function ChannelTrendChart({
  channelNames,
  data,
}: {
  channelNames: string[];
  data: TrendDatum[];
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Belum ada penjualan pada periode ini.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 11 }}
          tickFormatter={(value: string) => formatDate(value).slice(0, 5)}
        />
        <YAxis hide />
        <Tooltip
          labelFormatter={(value) => formatDate(String(value))}
          formatter={(value) => formatIDR(Number(value))}
          contentStyle={{ borderRadius: 10, border: "1px solid #D5D3CE", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {channelNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
