import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function TempChart({ data }) {
  // data: [{city, ts_utc, temp_c}]
  // Transformamos a estructura por timestamp con cada ciudad como serie
  const byTs = new Map();
  for (const r of data) {
    const t = new Date(r.ts_utc).toISOString();
    if (!byTs.has(t)) byTs.set(t, { ts: t });
    byTs.get(t)[r.city] = r.temp_c;
  }
  const rows = Array.from(byTs.values()).sort((a,b)=>a.ts.localeCompare(b.ts));

  return (
    <div style={{height:380}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <XAxis dataKey="ts" tickFormatter={(v)=>format(new Date(v), 'MM-dd HH:mm')} />
          <YAxis unit="°C" />
          <Tooltip labelFormatter={(v)=>format(new Date(v), "yyyy-MM-dd HH:mm 'UTC'")} />
          <Legend />
          <Line type="monotone" dataKey="shanghai" dot={false} />
          <Line type="monotone" dataKey="berlin"   dot={false} />
          <Line type="monotone" dataKey="rio"      dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
