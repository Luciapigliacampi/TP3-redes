// ws-client/index.js
import 'dotenv/config';
import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = process.env.WS_URL || 'ws://localhost:8080';
const MODE = (process.env.MODE || 'TEST').toUpperCase();

const RAW_TEST = process.env.INTERVAL_MS_TEST ?? '5000';
const RAW_PROD = process.env.INTERVAL_MS_PROD ?? '1800000';

// calculamos el intervalo según el modo
let INTERVAL_MS = MODE === 'PROD' ? Number(RAW_PROD) : Number(RAW_TEST);
// fallback por si vino NaN o <= 0
if (!Number.isFinite(INTERVAL_MS) || INTERVAL_MS <= 0) {
  INTERVAL_MS = MODE === 'PROD' ? 1800000 : 5000;
}

// Debug explícito (esto es lo que te pedí “justo después de leer las envs”)
console.log('[env]', {
  MODE,
  INTERVAL_MS_TEST: RAW_TEST,
  INTERVAL_MS_PROD: RAW_PROD,
  INTERVAL_MS,
  WS_URL
});

let CITIES;
try {
  CITIES = JSON.parse(process.env.CITIES);
} catch {
  CITIES = [
    { id: 'shanghai', lat: 31.2304, lon: 121.4737 },
    { id: 'berlin',   lat: 52.52,   lon: 13.405    },
    { id: 'rio',      lat: -22.9068,lon: -43.1729  }
  ];
}

// base térmica aproximada por ciudad (°C)
const cityBase = { shanghai: 20, berlin: 12, rio: 24 };

// --- Generador TEST (random realista) ---
function syntheticTemp(cityId, dateUtc = new Date()) {
  const base = cityBase[cityId] ?? 20;
  const hour = dateUtc.getUTCHours();
  // sinusoide diaria con pico ~14:00 UTC + ruido leve
  const sinus = 6 * Math.sin((2 * Math.PI * (hour - 14)) / 24);
  const noise = (Math.random() * 2 - 1); // -1..+1
  return Number((base + sinus + noise).toFixed(2));
}

// --- Lectura PROD desde Open-Meteo (última hora disponible) ---
async function fetchProdTemp({ id, lat, lon }) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m&timezone=UTC&past_days=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${id}: ${r.status}`);
  const j = await r.json();
  const i = j.hourly.time.length - 1;
  return {
    tsISO: j.hourly.time[i],
    temp: Number(Number(j.hourly.temperature_2m[i]).toFixed(2)),
  };
}

// --- Cliente WS con autoreconexión ---
let ws;
let timer;

function connect() {
  console.log(`🔌 Conectando a ${WS_URL} ...`);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ WS conectado');
    // envío periódico
    clearInterval(timer);
    timer = setInterval(async () => {
      for (const c of CITIES) {
        try {
          let tsISO, temp;
          if (MODE === 'TEST') {
            const now = new Date();
            tsISO = now.toISOString();
            temp = syntheticTemp(c.id, now);
          } else {
            const res = await fetchProdTemp(c);
            tsISO = res.tsISO;
            temp = res.temp;
          }
          const payload = {
  city: c.id,
  timestamp: Math.floor(new Date(tsISO).getTime() / 1000),
  temp_c: temp,
  env_mode: MODE // 'TEST' o 'PROD' según tu .env
};

          ws.send(JSON.stringify(payload));
          console.log('→ enviado', payload);
        } catch (e) {
          console.error('x error al generar/enviar:', e.message);
        }
      }
    }, INTERVAL_MS);
  });

  ws.on('close', () => {
    console.log('⚠️  WS desconectado. Reintentando en 2s...');
    clearInterval(timer);
    setTimeout(connect, 2000);
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });

  ws.on('message', (msg) => {
    // opcional: respuestas del servidor
    // console.log('← recibido', msg.toString());
  });
}

connect();
