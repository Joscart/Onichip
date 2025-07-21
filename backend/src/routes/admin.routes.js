const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controllers');

// 🔐 Autenticación
router.post('/login', adminController.loginAdmin);

// 📊 Dashboard
router.get('/dashboard', adminController.getDashboardStats);
router.get('/alertas', adminController.getAlertas);
router.get('/reportes', adminController.getReportes);

// 👥 Gestión de usuarios
router.get('/usuarios', adminController.getAllUsuarios);
router.post('/usuarios', adminController.createUsuario);
router.put('/usuarios/:id', adminController.updateUsuario);
router.delete('/usuarios/:id', adminController.deleteUsuario);

// 🐕 Gestión de mascotas
router.get('/mascotas', adminController.getAllMascotas);
router.put('/mascotas/:id', adminController.updateMascota);
router.delete('/mascotas/:id', adminController.deleteMascota);

module.exports = router;