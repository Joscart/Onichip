/**
 * ================================================
 * 👥 USUARIOS ROUTES - GESTIÓN DE USUARIOS
 * ================================================
 * 
 * Rutas para operaciones CRUD de usuarios del sistema
 * Incluye registro, autenticación y gestión de perfiles
 * 
 * @author Onichip Team
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controllers');

// ================================================
// 👥 OPERACIONES CRUD DE USUARIOS
// ================================================

// GET /api/usuarios - Obtener todos los usuarios
router.get('/usuarios', usuariosController.getUsuarios);

// GET /api/usuarios/:id - Obtener usuario específico por ID
router.get('/usuarios/:id', usuariosController.getUsuario);

// POST /api/usuarios - Crear nuevo usuario (registro)
router.post('/usuarios', usuariosController.addUsuario);

// PUT /api/usuarios/:id - Actualizar usuario existente
router.put('/usuarios/:id', usuariosController.editUsuario);

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/usuarios/:id', usuariosController.deleteUsuario);

// ================================================
// 🔐 AUTENTICACIÓN DE USUARIOS
// ================================================

// POST /api/usuarios/login - Autenticación de usuario
router.post('/usuarios/login', usuariosController.loginUsuario);

// ================================================
// 🏠 RUTA DE BIENVENIDA
// ================================================

// GET /api/ - Ruta de prueba y bienvenida
router.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido a la API de gestión de usuarios de Onichip',
        version: '2.0',
        endpoints: {
            usuarios: '/api/usuarios',
            login: '/api/usuarios/login'
        }
    });
});

module.exports = router;
