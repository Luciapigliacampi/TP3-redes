const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const API_URL = process.env.API_URL;        // ej: http://localhost:4000/readings
const INGEST_KEY = process.env.INGEST_KEY;  // igual a la del API

const ALLOWED = new Set(['shanghai','berlin','rio']);

app.post('/hook', async (req, res) => {
  try {
    let { city, timestamp, temp_c, env_mode } = req.body || {};
    if (!city) return res.status(400).json({ error: 'city faltante' });
    city = city.toLowerCase();
    if (!ALLOWED.has(city)) return res.status(400).json({ error: `city inválida: ${city}` });
    if (typeof timestamp !== 'number' || typeof temp_c !== 'number') {
      return res.status(400).json({ error: 'timestamp/temp_c inválidos' });
    }
    const mode = (env_mode === 'TEST' ? 'TEST' : 'PROD');

    await axios.post(
      API_URL,
      { city, timestamp, temp_c, env_mode: mode },       // 👈 reenviar env_mode
      { headers: { 'x-ingest-key': INGEST_KEY }, timeout: 5000 }
    );

    console.log('↪ Webhook → API OK', { city, timestamp, temp_c, env_mode: mode });
    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e?.message, e?.response?.status, e?.response?.data);
    res.status(500).json({ error: 'Error reenviando al API' });
  }
});

app.listen(process.env.PORT || 3002, () =>
  console.log(`webhook :: http://localhost:${process.env.PORT || 3002}/hook`)
);
