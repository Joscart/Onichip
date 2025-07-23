const express = require('express')
const app = express()
const port = 3000
const morgan = require('morgan'); 
const cors = require('cors');
const mongoose = require('./src/database');

// Importar y registrar modelos explícitamente
const Usuario = require('./src/models/usuario');
const Mascota = require('./src/models/mascota');
const Admin = require('./src/models/admin');
const Recuperacion = require('./src/models/recuperacion');
const DatosIoT = require('./src/models/datosiot');
const { Ubicacion, Geofence, WifiLocationCache } = require('./src/models/ubicacion');

console.log('✅ Modelos registrados:', {
  Usuario: !!Usuario,
  Mascota: !!Mascota,
  Admin: !!Admin,
  Recuperacion: !!Recuperacion,
  DatosIoT: !!DatosIoT,
  Ubicacion: !!Ubicacion,
  Geofence: !!Geofence,
  WifiLocationCache: !!WifiLocationCache
});

// Habilitar CORS
app.use(cors());

// Middleware para manejar el cuerpo de las solicitudes

app.use(morgan('dev'));

app.use(express.static('public')); // Servir archivos estáticos desde la carpeta 'public' 
    
// Middleware para manejar el cuerpo de las solicitudes
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🗺️ RUTAS GPS Y GEOFENCING (NUEVAS)
app.use('/api/gps', require('./src/routes/gps.routes'));
app.use('/api/geofences', require('./src/routes/geofence.routes'));

// Rutas existentes
app.use('/api', require('./src/routes/mascotas.routes'));
// Rutas de dispositivos ESP32
app.use('/api', require('./src/routes/device.routes'));
// Ruta de geolocalización por WiFi
app.use('/api', require('./src/routes/geoloc.routes'));
// Rutas de usuarios
app.use('/api', require('./src/routes/usuarios.routes'));
// Rutas de recuperación de contraseña
app.use('/api', require('./src/routes/recuperacion.routes'));
// Rutas de administrador
app.use('/api/admin', require('./src/routes/admin.routes'));
// Rutas de autenticación
app.use('/api', require('./src/routes/auth.routes'));

function logger(req,res,next){
 console.log('Ruta Recibida '+ req.protocol+'://'+req.get('host')+ req.originalUrl);
 next();
}

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});