// ================================================
// 🛰️ WEBSOCKET SERVER PARA ONICHIP (Mascotas en tiempo real)
// ================================================
const WebSocket = require('ws');
const url = require('url');
let wss;

function initWebSocket(server) {
  wss = new WebSocket.Server({ 
    server,
    verifyClient: (info) => {
      // Verificar que la conexión WebSocket sea para la ruta de mascotas
      const pathname = url.parse(info.req.url).pathname;
      console.log('🔍 Verificando conexión WebSocket para ruta:', pathname);
      
      // Permitir conexiones a /api/mascotas o raíz
      return pathname === '/api/mascotas' || pathname === '/';
    }
  });
  
  wss.on('connection', (ws, req) => {
    const pathname = url.parse(req.url).pathname;
    console.log('🔌 Cliente WebSocket conectado en ruta:', pathname);
    
    ws.on('message', (msg) => {
      // Aquí puedes manejar mensajes entrantes si lo necesitas
      console.log('📩 Mensaje recibido:', msg.toString());
    });
    
    ws.on('close', () => {
      console.log('❌ Cliente WebSocket desconectado');
    });
    
    ws.on('error', (error) => {
      console.error('❌ Error WebSocket:', error);
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
