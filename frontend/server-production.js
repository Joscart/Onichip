#!/usr/bin/env node

/**
 * ====================== ONICHIP FRONTEND PRODUCTION SERVER ======================
 * Servidor Express optimizado para producción en Ubuntu Server AWS
 * Puerto 80 - Interfaz Angular del sistema GPS
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 80;
const DIST_PATH = path.join(__dirname, 'dist', 'frontend');

// Middleware de compresión para optimizar transferencia
app.use(compression());

// Middleware de logging para producción
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Headers de seguridad para producción
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Powered-By', 'OnichipGPS');
  next();
});

// CORS configurado para comunicación con backend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Servir archivos estáticos con cache optimizado
app.use(express.static(DIST_PATH, {
  maxAge: '1d', // Cache por 1 día
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Cache más largo para assets con hash
    if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 año
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'OnichipGPS Frontend',
    port: PORT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Endpoint de información del sistema
app.get('/api/info', (req, res) => {
  res.json({
    name: 'OnichipGPS Frontend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    port: PORT,
    backend: 'http://localhost:3000'
  });
});

// Ruta principal para SPA (Single Page Application)
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_PATH, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OnichipGPS - Servicio no disponible</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #dc3545; }
          .code { background: #f8f9fa; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1 class="error">🚫 Frontend OnichipGPS No Disponible</h1>
        <p>El build de producción no está disponible.</p>
        <div class="code">
          <strong>Solución:</strong><br>
          cd /opt/onichip/frontend<br>
          npm run build --prod<br>
          sudo systemctl restart onichip-frontend
        </div>
        <p><strong>Ruta esperada:</strong> ${indexPath}</p>
        <p><strong>Servidor:</strong> ${process.env.HOSTNAME || 'Ubuntu Server'}</p>
      </body>
      </html>
    `);
  }
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('💥 Error en servidor frontend:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    service: 'OnichipGPS Frontend',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🌐 ================================');
  console.log('🎯 ONICHIP GPS FRONTEND INICIADO');
  console.log('🌐 ================================');
  console.log(`🚀 Servidor corriendo en puerto: ${PORT}`);
  console.log(`📁 Sirviendo desde: ${DIST_PATH}`);
  console.log(`🔗 Backend esperado en: http://localhost:3000`);
  console.log(`🌍 Acceso público: http://0.0.0.0:${PORT}`);
  console.log(`💻 Entorno: ${process.env.NODE_ENV || 'production'}`);
  console.log(`⚡ PID: ${process.pid}`);
  console.log('🌐 ================================');
});

// Manejo de cierre graceful para Ubuntu
process.on('SIGTERM', () => {
  console.log('🔴 SIGTERM recibido - Cerrando servidor frontend...');
  server.close(() => {
    console.log('✅ Servidor frontend cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔴 SIGINT recibido - Cerrando servidor frontend...');
  server.close(() => {
    console.log('✅ Servidor frontend cerrado correctamente');
    process.exit(0);
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('💥 Excepción no capturada en frontend:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada en frontend:', reason);
  process.exit(1);
});
