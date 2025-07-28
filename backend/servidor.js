/**
 * ================================================
 * 🚀 SERVIDOR PRINCIPAL - ONICHIP BACKEND
 * ================================================
 * 
 * Servidor Express.js para el sistema de localización de mascotas
 * Incluye GPS, WiFi location, geofencing y panel de administración
 * 
 * @author Onichip Team
 * @version 2.0
 * @port 3000
 */

const express = require('express');
const app = express();
const port = 3000;
const morgan = require('morgan'); 
const cors = require('cors');
const mongoose = require('./src/database');

// ================================================
//  IMPORTAR Y REGISTRAR MODELOS
// ================================================
const Usuario = require('./src/models/usuario');
const Mascota = require('./src/models/mascota');
const Admin = require('./src/models/admin');
const Recuperacion = require('./src/models/recuperacion');
const DatosIoT = require('./src/models/datosiot');
const Auditoria = require('./src/models/auditoria');
const { Ubicacion, Geofence, WifiLocationCache } = require('./src/models/ubicacion');

console.log('✅ Modelos registrados:', {
  Usuario: !!Usuario,
  Mascota: !!Mascota,
  Admin: !!Admin,
  Recuperacion: !!Recuperacion,
  DatosIoT: !!DatosIoT,
  Auditoria: !!Auditoria,
  Ubicacion: !!Ubicacion,
  Geofence: !!Geofence,
  WifiLocationCache: !!WifiLocationCache
});

// ================================================
// 🔧 MIDDLEWARES DE CONFIGURACIÓN
// ================================================

// Habilitar CORS para frontend
app.use(cors());

// Logging de peticiones HTTP
app.use(morgan('dev'));

// Servir archivos estáticos
app.use(express.static('public'));
    
// Middlewares para manejo del cuerpo de las solicitudes
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ================================================
// 🔍 MIDDLEWARE DE AUDITORÍA
// ================================================

// Importar middleware de auditoría
const auditoriaMiddleware = require('./src/middlewares/auditoria');

// Aplicar middleware de auditoría a todas las rutas
// (captura automáticamente todas las operaciones)
app.use(auditoriaMiddleware.capturarOperacion);

// ================================================
// 🗺️ RUTAS DE GPS Y GEOFENCING
// ================================================

// GPS y localización
app.use('/api/gps', require('./src/routes/gps.routes'));

// Geofencing y zonas seguras
app.use('/api/geofences', require('./src/routes/geofence.routes'));

// Geolocalización por WiFi
app.use('/api', require('./src/routes/geoloc.routes'));

// ================================================
// 🐕 RUTAS PRINCIPALES DEL SISTEMA
// ================================================

// Mascotas y dispositivos IoT
app.use('/api', require('./src/routes/mascotas.routes'));

// Dispositivos ESP32
app.use('/api', require('./src/routes/device.routes'));

// Usuarios del sistema
app.use('/api', require('./src/routes/usuarios.routes'));

// ================================================
// 🔐 RUTAS DE AUTENTICACIÓN Y SEGURIDAD
// ================================================

// Autenticación general
app.use('/api', require('./src/routes/auth.routes'));

// Recuperación de contraseñas
app.use('/api', require('./src/routes/recuperacion.routes'));

// Panel de administración
app.use('/api/admin', require('./src/routes/admin.routes'));

// ================================================
// 📊 RUTAS DE AUDITORÍA Y REPORTES
// ================================================

// Auditoría del sistema
app.use('/api/admin/auditoria', require('./src/routes/auditoria.routes'));

// Reportes y dashboard
app.use('/api/admin/reportes', require('./src/routes/reportes.routes'));

// ================================================
// 🔍 MIDDLEWARE DE LOGGING PERSONALIZADO
// ================================================

function logger(req, res, next) {
    console.log(`📡 Ruta recibida: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🔧 Método: ${req.method}`);
    next();
}

// ================================================
// 🏠 RUTA DE BIENVENIDA
// ================================================

app.get('/', (req, res) => {
    res.json({
        message: '🐕 Bienvenido a Onichip - Sistema de Localización de Mascotas',
        version: '2.0',
        status: 'Servidor funcionando correctamente',
        endpoints: {
            mascotas: '/api/mascotas',
            usuarios: '/api/usuarios',
            admin: '/api/admin',
            auditoria: '/api/admin/auditoria',
            reportes: '/api/admin/reportes',
            gps: '/api/gps',
            geofences: '/api/geofences'
        },
        nuevas_funciones: {
            dashboard_metrics: '/api/admin/reportes/dashboard-metrics',
            chart_data: '/api/admin/reportes/chart-data',
            critical_events: '/api/admin/reportes/critical-events',
            performance_stats: '/api/admin/reportes/performance-stats'
        },
        timestamp: new Date().toISOString()
    });
});

// ================================================
// 🚀 INICIO DEL SERVIDOR
// ================================================

app.listen(port, () => {
    console.log(`🚀 Servidor Onichip iniciado exitosamente`);
    console.log(`📡 Puerto: ${port}`);
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log(`📅 Fecha de inicio: ${new Date().toISOString()}`);
    console.log('==========================================');
});