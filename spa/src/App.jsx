import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';
import Login from './components/Login';
import TempChart from './components/TempChart';

const ALL_CITIES = [
  { id:'shanghai', name:'Shanghai' },
  { id:'berlin',   name:'Berlin'   },
  { id:'rio',      name:'Río de Janeiro' }
];

export default function App() {
  const { token, setToken } = useAuth();
  const [cities, setCities] = useState(ALL_CITIES.map(c=>c.id));
  const [from, setFrom] = useState(new Date(Date.now()-7*24*3600e3).toISOString());
  const [to, setTo] = useState(new Date().toISOString());
  const [rows, setRows] = useState([]);
  const [kpi, setKpi] = useState({}); // por ciudad

  useEffect(()=>{
    if (!token) return;
    let ignore = false;
    (async ()=>{
      try {
        const data = await api.timeseries({ cities, from, to });
        if (!ignore) setRows(data);
        // KPIs por ciudad (min/max/avg) en paralelo
        const stats = {};
        for (const c of cities) {
          stats[c] = await api.stats({ city: c, from, to });
        }
        if (!ignore) setKpi(stats);
      } catch (e) {
        console.error(e);
      }
    })();
    return ()=>{ ignore = true; }
  }, [token, cities, from, to]);

  const selected = useMemo(
    ()=>new Set(cities),
    [cities]
  );

  if (!token) return <Login />;

  return (
    <div style={{fontFamily:'system-ui', padding:16}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>天气在你手中 — Dashboard</h2>
        <button onClick={()=>setToken('')}>Salir</button>
      </header>

      <section style={{display:'grid', gap:12, gridTemplateColumns:'1fr 1fr'}}>
        <div>
          <label>Desde (UTC)</label>
          <input style={{width:'100%'}} value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <label>Hasta (UTC)</label>
          <input style={{width:'100%'}} value={to} onChange={e=>setTo(e.target.value)} />
        </div>
      </section>

      <section style={{marginTop:10}}>
        {ALL_CITIES.map(c => (
          <label key={c.id} style={{marginRight:12}}>
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={e=>{
                setCities(prev => e.target.checked ? [...prev, c.id] : prev.filter(x=>x!==c.id));
              }}
            /> {c.name}
          </label>
        ))}
      </section>

      <section style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:12}}>
        {ALL_CITIES.map(c => (
          <div key={c.id} style={{border:'1px solid #ddd', borderRadius:8, padding:10}}>
            <div style={{fontWeight:600}}>{c.name}</div>
            <div style={{fontSize:12, opacity:.7}}>{c.id}</div>
            <div style={{display:'flex', gap:12, marginTop:8}}>
              <div>Min: <b>{kpi[c.id]?.min ?? '-'}</b></div>
              <div>Max: <b>{kpi[c.id]?.max ?? '-'}</b></div>
              <div>Avg: <b>{kpi[c.id]?.avg?.toFixed?.(2) ?? '-'}</b></div>
            </div>
          </div>
        ))}
      </section>

      <section style={{marginTop:16}}>
        <TempChart data={rows} />
      </section>
    </div>
  );
}
