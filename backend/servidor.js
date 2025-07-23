const express = require('express')
const app = express()
const port = 3000
const morgan = require('morgan'); 
const cors = require('cors');
const mongoose = require('./src/database');

// Habilitar CORS
app.use(cors());

// Middleware para manejar el cuerpo de las solicitudes

app.use(morgan('dev'));

app.use(express.static('public')); // Servir archivos estáticos desde la carpeta 'public' 
    
// Middleware para manejar el cuerpo de las solicitudes
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));



// Rutas de mascotas
app.use('/api', require('./src/routes/mascotas.routes'));
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