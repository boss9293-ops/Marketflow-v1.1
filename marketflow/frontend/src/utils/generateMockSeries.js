// SC-1 차트용 90일 mock 시계열 데이터 생성 유틸리티

export function generateDates(endDate = "2026-04-29", days = 90) {
  const end = new Date(endDate);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function generateSeries({ start, end, days = 90, noise = 1.5 }) {
  return Array.from({ length: days }, (_, i) => {
    const base = start + (end - start) * (i / (days - 1));
    const n = (Math.random() - 0.5) * noise;
    return parseFloat((base + n).toFixed(2));
  });
}

export function buildSectorData(sectors) {
  return sectors.map(s => ({
    ...s,
    data: generateSeries({
      start: 0,
      end: s.trend90,
      noise: Math.abs(s.trend90) * 0.08,
    }),
  }));
}

export function buildCard3Series() {
  const dates     = generateDates();
  const aiCompute = generateSeries({ start: 0, end: 18.4, noise: 1.2 });
  const legacy    = generateSeries({ start: 0, end: -3.8, noise: 0.8 });
  const spread    = aiCompute.map((v, i) =>
    parseFloat((v - legacy[i]).toFixed(2))
  );
  return { dates, aiCompute, legacy, spread };
}
