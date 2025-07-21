
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controllers');

// Crear admin (solo superadmin)
router.post('/admin/create', authController.createAdmin);

// Login y registro
router.post('/login', authController.login);
router.post('/register', authController.register);

module.exports = router;
