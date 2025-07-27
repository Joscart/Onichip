
/**
 * ================================================
 * 🔐 AUTH ROUTES - AUTENTICACIÓN UNIFICADA
 * ================================================
 * 
 * Rutas para autenticación unificada del sistema
 * Maneja login de usuarios y administradores, registro y creación de admins
 * 
 * @author Onichip Team
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controllers');

// ================================================
// 👨‍💼 GESTIÓN DE ADMINISTRADORES
// ================================================

// POST /api/admin/create - Crear nuevo administrador (solo superadmin)
router.post('/admin/create', authController.createAdmin);

// ================================================
// 🔐 AUTENTICACIÓN GENERAL
// ================================================

// POST /api/login - Login unificado (usuarios y admins)
router.post('/login', authController.login);

// POST /api/register - Registro de nuevo usuario
router.post('/register', authController.register);

module.exports = router;
