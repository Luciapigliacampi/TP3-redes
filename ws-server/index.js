// 1) Imports y variables
const { WebSocketServer } = require('ws'); // servidor WS
const express = require('express');        // endpoint /health
const axios = require('axios');            // POST hacia el webhook
require('dotenv').config();                // lee .env

const PORT_WS = process.env.PORT_WS || 8080;
const PORT_HTTP = process.env.PORT_HTTP || 8081;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// 2) Servidor HTTP muy simple para chequear que vive
const app = express();
app.get('/health', (_, res) => res.json({ ok: true, ws: PORT_WS }));
app.listen(PORT_HTTP, () => console.log(`HTTP :: http://localhost:${PORT_HTTP}/health`));

// 3) Servidor WebSocket
const wss = new WebSocketServer({ port: PORT_WS }, () =>
  console.log(`WS   :: ws://localhost:${PORT_WS}`)
);

// 4) Cuando un cliente WS se conecta...
wss.on('connection', (ws) => {
  console.log('🟢 Cliente WS conectado');

  // 5) ...y nos manda un mensaje:
  ws.on('message', async (buf) => {
    // Esperamos JSON con { city, timestamp, temp_c }
    let payload;
    try {
      payload = JSON.parse(buf.toString());
    } catch {
      return console.log('✖ Mensaje no-JSON:', buf.toString());
    }

    console.log('📥 WS →', payload);

    // 6) Opcional: reenviar a otros clientes conectados (debug/monitor)
    wss.clients.forEach((c) => {
      if (c !== ws && c.readyState === 1) {
        c.send(JSON.stringify({ type: 'echo', payload }));
      }
    });

    // 7) Reenvío al Webhook (servicio 3) por HTTP POST
    try {
      await axios.post(WEBHOOK_URL, payload, { timeout: 5000 });
      console.log('↪ POST → Webhook OK');
    } catch (e) {
      console.error('✖ Webhook error:', e.message);
    }
  });

  ws.on('close', () => console.log('🔴 Cliente WS desconectado'));
});
