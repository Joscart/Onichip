const express = require('express');
const router = express.Router();
const { testConexion, validarEmail, actualizarContrasena } = require('../controllers/recuperacion.controllers');

console.log('🔧 Rutas de recuperación cargadas');

// Ruta de prueba simple
router.get('/test', testConexion);

// Ruta para validar si existe un email en la base de datos
router.post('/validar-email', validarEmail);

// Ruta para actualizar la contraseña
router.post('/actualizar-contrasena', actualizarContrasena);

module.exports = router;