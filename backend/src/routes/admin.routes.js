/**
 * ================================================
 * 🛡️ ADMIN ROUTES - PANEL DE ADMINISTRACIÓN
 * ================================================
 * 
 * Rutas para el panel de administración de Onichip
 * Todas las rutas requieren autenticación de admin (@onichip.com)
 * 
 * @author Onichip Team
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controllers');

// ================================================
// 🔐 AUTENTICACIÓN
// ================================================

// POST /api/admin/login - Autenticación de administrador
router.post('/login', adminController.loginAdmin);

// ================================================
// 📊 DASHBOARD Y ESTADÍSTICAS
// ================================================

// GET /api/admin/dashboard - Estadísticas básicas del dashboard
router.get('/dashboard', adminController.getDashboardStats);

// GET /api/admin/dashboard-charts - Datos para gráficos del dashboard
router.get('/dashboard-charts', adminController.getDashboardCharts);

// GET /api/admin/dashboard-stats - Estadísticas avanzadas para dashboard
router.get('/dashboard-stats', adminController.dashboardStats);

// GET /api/admin/estadisticas-generales - Estadísticas generales del sistema
router.get('/estadisticas-generales', adminController.getEstadisticasGenerales);

// GET /api/admin/estadisticas-gps - Estadísticas específicas de GPS
router.get('/estadisticas-gps', adminController.estadisticasGPS);

// GET /api/admin/alertas - Obtener alertas del sistema
router.get('/alertas', adminController.getAlertas);

// ================================================
// 👥 GESTIÓN DE USUARIOS (CRUD)
// ================================================

// GET /api/admin/usuarios - Obtener todos los usuarios con paginación
router.get('/usuarios', adminController.getAllUsuarios);

// POST /api/admin/usuarios - Crear nuevo usuario
router.post('/usuarios', adminController.createUsuario);

// PUT /api/admin/usuarios/:id - Actualizar usuario existente
router.put('/usuarios/:id', adminController.updateUsuario);

// DELETE /api/admin/usuarios/:id - Eliminar usuario
router.delete('/usuarios/:id', adminController.deleteUsuario);

// ================================================
// 🐕 GESTIÓN DE MASCOTAS (CRUD)
// ================================================

// GET /api/admin/mascotas - Obtener todas las mascotas con paginación
router.get('/mascotas', adminController.getAllMascotas);

// POST /api/admin/mascotas - Crear nueva mascota
router.post('/mascotas', adminController.createMascota);

// PUT /api/admin/mascotas/:id - Actualizar mascota existente
router.put('/mascotas/:id', adminController.updateMascota);

// DELETE /api/admin/mascotas/:id - Eliminar mascota
router.delete('/mascotas/:id', adminController.deleteMascota);

// ================================================
// 📱 DATOS IOT Y DISPOSITIVOS
// ================================================

// GET /api/admin/datos-iot - Obtener datos IoT del sistema
router.get('/datos-iot', adminController.getDatosIoT);

// POST /api/admin/datos-iot/generar-ejemplo - Generar datos de ejemplo
router.post('/datos-iot/generar-ejemplo', adminController.generateSampleIoTData);

// ================================================
// 📊 REPORTES Y EXPORTACIÓN
// ================================================

// GET /api/admin/reportes - Obtener reportes disponibles
router.get('/reportes', adminController.getReportes);

// POST /api/admin/generate-report - Generar reporte personalizado
router.post('/generate-report', adminController.generateReport);

// POST /api/admin/export-pdf - Exportar reporte a PDF
router.post('/export-pdf', adminController.exportPDF);

// POST /api/admin/generate-excel - Generar reporte Excel
router.post('/generate-excel', adminController.generateExcelReport);

module.exports = router;