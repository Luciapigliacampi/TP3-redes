const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

const ORIGIN = process.env.ALLOWE_ORIGIN || '*';
app.use(cors({ origin: ORIGIN, credentials: true }));

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const JWT_SECRET = process.env.JWT_SECRET;
const INGEST_KEY = process.env.INGEST_KEY;



// ---------- AUTH ----------
app.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email/password requeridos' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'insert into app_users(email,password_hash) values($1,$2) on conflict(email) do nothing',
    [email, hash]
  );
  res.status(201).json({ ok: true });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const r = await pool.query('select id,password_hash from app_users where email=$1', [email]);
  if (!r.rowCount) return res.status(401).json({ error: 'credenciales' });
  const ok = await bcrypt.compare(password, r.rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'credenciales' });
  const token = jwt.sign({ sub: r.rows[0].id, email }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'token' }); }
}

// ---------- INGESTA DESDE WEBHOOK ----------
app.post('/readings', async (req, res) => {
  if (req.headers['x-ingest-key'] !== INGEST_KEY) {
    return res.status(401).json({ error: 'ingest key' });
  }

  const { city, timestamp, temp_c, env_mode } = req.body || {};
  if (!city || typeof timestamp !== 'number' || typeof temp_c !== 'number') {
    return res.status(400).json({ error: 'payload inválido' });
  }

  // normalizá a TEST o PROD (default PROD)
  const mode = (env_mode === 'TEST' ? 'TEST' : 'PROD');
  const iso = new Date(timestamp * 1000).toISOString(); // UTC

  await pool.query(
    `insert into readings(city, ts_utc, temp_c, env_mode)
     values ($1,$2,$3,$4)
     on conflict (city, ts_utc)
     do update set temp_c = excluded.temp_c,
                   env_mode = excluded.env_mode`,
    [city, iso, temp_c, mode]
  );

  res.json({ ok: true });
});


// ---------- LECTURAS PARA SPA ----------
app.get('/timeseries', auth, async (req, res) => {
  const { cities='shanghai,berlin,rio', from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from/to' });
  const arr = cities.split(',').map(s=>s.trim());
  const r = await pool.query(
  `select city, ts_utc, temp_c::float as temp_c
   from readings
   where city = any($1) and ts_utc between $2 and $3
   order by ts_utc asc`, [arr, from, to]
);
  res.json(r.rows);
});

app.get('/stats', auth, async (req, res) => {
  const { city, from, to } = req.query;
  const r = await pool.query(
    `select min(temp_c)::float as min,
            max(temp_c)::float as max,
            avg(temp_c)::float as avg
     from readings
     where city=$1 and ts_utc between $2 and $3`, [city, from, to]
  );
  res.json(r.rows[0] || {});
});


app.get('/export.csv', auth, async (req, res) => {
  const { from, to } = req.query;
  const r = await pool.query(
    `select city, ts_utc, temp_c from readings
     where ts_utc between $1 and $2 order by city, ts_utc`, [from, to]
  );
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.write('city,ts_utc,temp_c\n');
  for (const row of r.rows) res.write(`${row.city},${row.ts_utc.toISOString()},${row.temp_c}\n`);
  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`api :: http://localhost:${PORT}`));
