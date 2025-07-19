const io = require('socket.io');
let socketInstance = null;

function initSocket(server) {
  if (!socketInstance) {
    socketInstance = io(server, { cors: { origin: '*' } });
  }
  return socketInstance;
}

function getSocket() {
  return socketInstance;
}

module.exports = { initSocket, getSocket };
