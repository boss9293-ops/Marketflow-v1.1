// SC-1 13섹터 RS 90일 멀티라인 차트 — 클릭 하이라이트 + opacity 디밍
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import SectorTooltip from "./SectorTooltip";
import { getStroke } from "../../constants/sectorColors";
import { DARK } from "../../constants/theme";
import { generateDates, generateSeries } from "../../utils/generateMockSeries";

function buildChartData(sectors) {
  const dates = generateDates();
  return dates.map((date, i) => {
    const row = { date };
    sectors.forEach(s => {
      const series = s.data ?? generateSeries({ start: 0, end: s.trend90 });
      row[s.id] = parseFloat((series[i] ?? 0).toFixed(1));
    });
    return row;
  });
}

export default function SectorMultiLine({ sectors, selectedSector, onSectorClick }) {
  const chartData = buildChartData(sectors);
  const hasSelect = !!selectedSector;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>

        <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />

        <XAxis
          dataKey="date"
          tickFormatter={d => d.slice(5)}
          interval={14}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `${v}pp`}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
          width={36}
        />

        <Tooltip content={<SectorTooltip sectors={sectors} />} />
        <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />

        {sectors.map(s => {
          const dimmed   = hasSelect && selectedSector !== s.id;
          const selected = selectedSector === s.id;
          return (
            <Line
              key={s.id}
              dataKey={s.id}
              stroke={getStroke(s.colorClass, dimmed)}
              strokeWidth={selected ? 2.5 : 1.5}
              opacity={dimmed ? 0.12 : 1}
              dot={false}
              activeDot={dimmed ? false : { r: 3, fill: getStroke(s.colorClass) }}
              style={{ cursor: "pointer" }}
              onClick={() => onSectorClick(s.id)}
            />
          );
        })}

      </LineChart>
    </ResponsiveContainer>
  );
}
