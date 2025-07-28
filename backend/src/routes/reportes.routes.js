/**
 * ================================================
 * 📊 RUTAS DE REPORTES - SISTEMA DE AUDITORÍA
 * ================================================
 * 
 * Rutas para generación de reportes basados en auditoría
 * Incluye reportes tradicionales y nuevas funciones de dashboard
 * 
 * @author Onichip Team
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controllers');
const authMiddleware = require('../middlewares/auth');

// ================================
// 📊 REPORTES BÁSICOS
// ================================

/**
 * @route GET /api/admin/reportes
 * @desc Obtener reportes básicos del sistema basados en auditoría
 * @access Admin
 */
router.get('/', authMiddleware.verifyAdmin, reportesController.getReportes);

/**
 * @route POST /api/admin/generate-report
 * @desc Generar reporte personalizado basado en auditoría
 * @access Admin
 * @body {tipoReporte, fechaInicio?, fechaFin?, actor?, entidad?, accion?}
 */
router.post('/generate-report', authMiddleware.verifyAdmin, reportesController.generateReport);

/**
 * @route POST /api/admin/generate-excel
 * @desc Generar reporte Excel con datos reales
 * @access Admin
 * @body {tipoReporte, fechaInicio, fechaFin, mascotaId?}
 */
router.post('/generate-excel', authMiddleware.verifyAdmin, reportesController.generateExcelReport);

/**
 * @route POST /api/admin/export-pdf
 * @desc Exportar reporte a formato PDF
 * @access Admin
 * @body {filters: {tipoReporte, fechaInicio?, fechaFin?}}
 */
router.post('/export-pdf', authMiddleware.verifyAdmin, reportesController.exportPDF);

// ================================
// 📈 NUEVAS FUNCIONES DE DASHBOARD
// ================================

/**
 * @route GET /api/admin/dashboard-metrics
 * @desc Obtener métricas en tiempo real para dashboard
 * @access Admin
 * @returns {resumen, graficos, timestamp}
 */
router.get('/dashboard-metrics', authMiddleware.verifyAdmin, reportesController.getDashboardMetrics);

/**
 * @route POST /api/admin/chart-data
 * @desc Obtener datos específicos para gráficos
 * @access Admin
 * @body {tipoGrafico, metrica, periodo?}
 * @returns {tipo, metrica, data, timestamp}
 */
router.post('/chart-data', authMiddleware.verifyAdmin, reportesController.getChartData);

/**
 * @route GET /api/admin/critical-events
 * @desc Obtener eventos críticos y alertas del sistema
 * @access Admin
 * @returns {errores_criticos, actividad_anomala, dispositivos_sin_gps}
 */
router.get('/critical-events', authMiddleware.verifyAdmin, reportesController.getCriticalEvents);

/**
 * @route GET /api/admin/performance-stats
 * @desc Obtener estadísticas de rendimiento del sistema
 * @access Admin
 * @returns {endpoints_mas_lentos, carga_por_hora, tendencia_semanal}
 */
router.get('/performance-stats', authMiddleware.verifyAdmin, reportesController.getPerformanceStats);

module.exports = router;