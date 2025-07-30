// ================================================
// 🛰️ WEBSOCKET SERVER PARA ONICHIP (Mascotas en tiempo real)
// ================================================
const WebSocket = require('ws');
let wss;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });
  wss.on('connection', (ws) => {
    console.log('🔌 Cliente WebSocket conectado');
    ws.on('message', (msg) => {
      // Aquí puedes manejar mensajes entrantes si lo necesitas
      console.log('📩 Mensaje recibido:', msg);
    });
    ws.on('close', () => {
      console.log('❌ Cliente WebSocket desconectado');
    });
  });
}

function broadcastMascotaUpdate(data) {
  if (!wss) return;
  const payload = JSON.stringify({ type: 'mascota_update', data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

module.exports = { initWebSocket, broadcastMascotaUpdate };
