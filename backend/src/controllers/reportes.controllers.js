/**
 * ================================================
 * 📊 REPORTES CONTROLLER - GENERACIÓN DE REPORTES
 * ================================================
 * 
 * Controlador dedicado para generación de reportes del sistema
 * Incluye reportes Excel, PDF y estadísticas avanzadas
 * 
 * @author Onichip Team
 * @version 2.0
 */

const Usuario = require('../models/usuario');
const Mascota = require('../models/mascota');
const { Ubicacion } = require('../models/ubicacion');
const Auditoria = require('../models/auditoria');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const reportesController = {};

/**
 * 📊 Obtener reportes básicos
 * 
 * @description Obtiene estadísticas basadas en datos de auditoría del sistema
 * @route GET /api/admin/reportes
 * @access Admin
 * 
 * @input None - No requiere parámetros
 * 
 * @output {Object} 200 - Reportes básicos del sistema basados en auditoría
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.getReportes = async (req, res) => {
    try {
        console.log('📊 Generando reportes básicos desde auditoría...');
        const startTime = Date.now();

        const reportes = await Promise.all([
            // Actividad de usuarios por mes desde auditoría
            Auditoria.aggregate([
                {
                    $match: {
                        'actor.tipo': 'usuario',
                        accion: { $in: ['CREATE', 'UPDATE', 'LOGIN'] },
                        'actor.nombre': { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: { 
                            year: { $year: '$timestamp' },
                            month: { $month: '$timestamp' }
                        },
                        count: { $sum: 1 },
                        usuarios_unicos: { $addToSet: '$actor.id' }
                    }
                },
                {
                    $addFields: {
                        usuarios_activos: { $size: '$usuarios_unicos' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ]),

            // Operaciones por tipo de entidad (filtrar entidades válidas)
            Auditoria.aggregate([
                {
                    $match: {
                        entidad: { $exists: true, $ne: null, $ne: '' }
                    }
                },
                {
                    $group: {
                        _id: '$entidad',
                        total_operaciones: { $sum: 1 },
                        creates: {
                            $sum: { $cond: [{ $eq: ['$accion', 'CREATE'] }, 1, 0] }
                        },
                        updates: {
                            $sum: { $cond: [{ $eq: ['$accion', 'UPDATE'] }, 1, 0] }
                        },
                        deletes: {
                            $sum: { $cond: [{ $eq: ['$accion', 'DELETE'] }, 1, 0] }
                        }
                    }
                },
                { $sort: { total_operaciones: -1 } }
            ]),

            // Top usuarios más activos (con campos válidos)
            Auditoria.aggregate([
                {
                    $match: {
                        'actor.tipo': 'usuario',
                        'actor.nombre': { $exists: true, $ne: null, $ne: '' },
                        'actor.email': { $exists: true, $ne: null, $ne: '' },
                        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: '$actor.id',
                        nombre: { $first: '$actor.nombre' },
                        email: { $first: '$actor.email' },
                        actividad: { $sum: 1 },
                        ultima_actividad: { $max: '$timestamp' }
                    }
                },
                { $sort: { actividad: -1 } },
                { $limit: 10 }
            ]),

            // Actividad GPS y ubicaciones (filtrar objetivos válidos)
            Auditoria.aggregate([
                {
                    $match: {
                        $or: [
                            { entidad: 'ubicacion' },
                            { accion: 'GPS_UPDATE' },
                            { categoria: 'gps' }
                        ],
                        timestamp: { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                        },
                        ubicaciones: { $sum: 1 },
                        dispositivos_activos: { 
                            $addToSet: { 
                                $cond: [
                                    { $and: [
                                        { $ne: ['$objetivo.id', null] },
                                        { $ne: ['$objetivo.id', ''] }
                                    ]},
                                    '$objetivo.id',
                                    '$$REMOVE'
                                ]
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        dispositivos_count: { $size: '$dispositivos_activos' }
                    }
                },
                { $sort: { '_id.date': -1 } },
                { $limit: 7 }
            ])
        ]);

        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Reportes básicos generados desde auditoría en ${processingTime}ms`);
        res.json({
            actividadUsuarios: reportes[0],
            operacionesPorEntidad: reportes[1],
            usuariosActivos: reportes[2],
            actividadGPS: reportes[3],
            metadata: {
                generado: new Date().toISOString(),
                processingTime,
                fuente: 'auditoria'
            }
        });
    } catch (error) {
        console.error('❌ Error al generar reportes desde auditoría:', error);
        res.status(500).json({ 
            message: 'Error al generar reportes',
            error: error.message 
        });
    }
};

/**
 * 📄 Generar y exportar Excel genérico
 *
 * @description Función principal para exportar datos a Excel.
 * @route POST /api/admin/generate-excel
 * @access Admin
 *
 * @input {Array<Object>} data - Array de registros con claves dinámicas
 * @input {string} tipo - Tipo de reporte a generar (dispositivos, ubicaciones, estadisticas, etc.) y nombre de la hoja
 * @input {string} [fechaInicio] - Filtro fecha inicio (opcional)
 * @input {string} [fechaFin] - Filtro fecha fin (opcional)
 * @input {string} [usuario] - Filtro por usuario (opcional)
 * @input {string} [mascota] - Filtro por mascota (opcional)
 *
 * @output {File} 200 - Archivo Excel generado
 * @output {Object} 400 - Parámetros inválidos
 */
reportesController.generateExcelReport = async (req, res) => {
    try {
        const { data, tipo, fechaInicio, fechaFin, mascota } = req.body;
        
        // Validar parámetros básicos
        if (!Array.isArray(data) || data.length === 0 || !tipo) {
            return res.status(400).json({
                message: 'Parámetros requeridos: data (Array) y tipo (string)'
            });
        }
        
        // Filtrar datos por fecha si se proveen
        let filtered = data;
        if (fechaInicio && fechaFin) {
            console.log('🔍 Debug fechas recibidas:', { fechaInicio, fechaFin });
            
            // Validar y parsear fechas correctamente
            const start = new Date(fechaInicio);
            const end = new Date(fechaFin);
            
            console.log('📅 Fechas parseadas:', { start, end });
            
            // Verificar que las fechas sean válidas
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                console.error('❌ Fechas inválidas recibidas:', { fechaInicio, fechaFin });
                return res.status(400).json({
                    message: 'Formato de fecha inválido. Use formato ISO: YYYY-MM-DD'
                });
            }
            
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.timestamp || item.fecha || item.date || item.createdAt);
                if (isNaN(itemDate.getTime())) {
                    console.warn('⚠️ Fecha inválida en item:', item);
                    return true; // Incluir items sin fecha válida
                }
                return itemDate >= start && itemDate <= end;
            });
            
            console.log(`📊 Filtro aplicado: ${data.length} -> ${filtered.length} registros`);
        }
        
        // Filtrar por mascota
        if (mascota) {
            filtered = filtered.filter(item => item.mascota === mascota || item.pet === mascota);
        }
        
        // Crear workbook y worksheet
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Onichip Admin';
        const sheetName = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const worksheet = workbook.addWorksheet(sheetName);
        
        // Columnas dinámicas
        const headers = Object.keys(filtered[0]);
        worksheet.columns = headers.map(key => ({
            header: key.charAt(0).toUpperCase() + key.slice(1),
            key,
            width: 20
        }));
        
        // Añadir filas
        filtered.forEach(row => worksheet.addRow(row));
        
        // Estilar encabezados
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true };
        });
        
        // Configurar respuesta
        const fileName = `reporte-${tipo}-${Date.now()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Enviar archivo
        await workbook.xlsx.write(res);
        console.log(`✅ Archivo Excel generado: ${fileName} con ${filtered.length} registros`);
        
    } catch (error) {
        console.error('❌ Error generando Excel genérico:', error);
        res.status(500).json({
            message: 'Error al generar Excel',
            error: error.message
        });
    }
};
reportesController.generateReport = async (req, res) => {
    try {
        const startTime = Date.now();
        const { 
            tipoReporte, 
            fechaInicio, 
            fechaFin, 
            actor, 
            entidad, 
            accion,
            mascotaId 
        } = req.body;
        
        console.log('📊 Generando reporte desde auditoría:', { 
            tipoReporte, fechaInicio, fechaFin, actor, entidad, accion 
        });

        console.log('🔍 Debug tipos de datos recibidos:', {
            tipoReporte_type: typeof tipoReporte,
            fechaInicio_type: typeof fechaInicio,
            fechaFin_type: typeof fechaFin,
            fechaInicio_value: fechaInicio,
            fechaFin_value: fechaFin
        });

        // Validar parámetros requeridos
        if (!tipoReporte) {
            return res.status(400).json({ 
                message: 'Tipo de reporte es requerido',
                total: 0 
            });
        }

        // Construir filtros de auditoría con validación de fechas
        let filtrosAuditoria = {};
        
        if (fechaInicio && fechaFin) {
            // Validar y parsear fechas
            const startDate = new Date(fechaInicio);
            const endDate = new Date(fechaFin);
            
            console.log('📅 Fechas parseadas para filtros:', { startDate, endDate });
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.error('❌ Fechas inválidas para filtros:', { fechaInicio, fechaFin });
                return res.status(400).json({ 
                    message: 'Formato de fecha inválido para filtros',
                    total: 0 
                });
            }
            
            // Asegurar que las fechas incluyan todo el día
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            filtrosAuditoria.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
            
            console.log('✅ Filtros de fecha aplicados:', filtrosAuditoria.timestamp);
        }
        
        if (actor) filtrosAuditoria['actor.tipo'] = actor;
        if (entidad) filtrosAuditoria.entidad = entidad;
        if (accion) filtrosAuditoria.accion = accion;

        // Respuesta optimizada con datos de auditoría
        let reportData = {
            tipo: tipoReporte,
            periodo: { inicio: fechaInicio, fin: fechaFin },
            filtros: { actor, entidad, accion },
            generado: new Date().toISOString(),
            processingTime: 0,
            fuente: 'auditoria'
        };

        switch (tipoReporte) {
            case 'auditoria':
                console.log('🕵️ Generando reporte de auditoría completa...');
                
                const registrosAuditoria = await Auditoria.find(filtrosAuditoria)
                    .sort({ timestamp: -1 })
                    .limit(100)
                    .lean();

                reportData.total = registrosAuditoria.length;
                reportData.registros = registrosAuditoria.map(reg => ({
                    timestamp: reg.timestamp,
                    accion: reg.accion,
                    entidad: reg.entidad,
                    actor: {
                        nombre: reg.actor?.nombre || 'N/A',
                        tipo: reg.actor?.tipo || 'N/A',
                        email: reg.actor?.email || 'N/A'
                    },
                    objetivo: reg.objetivo?.nombre || reg.objetivo?.tipo || 'N/A',
                    resumen: reg.resumen || 'N/A',
                    exitoso: reg.metadata?.exitoso !== false,
                    tiempoEjecucion: reg.metadata?.tiempoEjecucion || 0
                }));
                break;

            case 'actividad':
                console.log('📈 Generando reporte de actividad...');
                
                const actividadPorHora = await Auditoria.aggregate([
                    { $match: filtrosAuditoria },
                    {
                        $group: {
                            _id: {
                                fecha: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                                hora: { $hour: '$timestamp' }
                            },
                            operaciones: { $sum: 1 },
                            usuarios_activos: { $addToSet: '$actor.id' },
                            tipos_accion: { $addToSet: '$accion' }
                        }
                    },
                    {
                        $addFields: {
                            usuarios_count: { $size: '$usuarios_activos' },
                            diversidad_acciones: { $size: '$tipos_accion' }
                        }
                    },
                    { $sort: { '_id.fecha': -1, '_id.hora': 1 } },
                    { $limit: 168 } // 7 días * 24 horas
                ]);

                reportData.total = actividadPorHora.length;
                reportData.actividad = actividadPorHora;
                break;

            case 'dispositivos':
                console.log('📱 Generando reporte de dispositivos desde auditoría...');
                
                // Obtener actividad de dispositivos desde auditoría
                const actividadDispositivos = await Auditoria.aggregate([
                    {
                        $match: {
                            ...filtrosAuditoria,
                            $or: [
                                { entidad: 'mascota' },
                                { entidad: 'ubicacion' },
                                { accion: 'GPS_UPDATE' },
                                { categoria: 'gps' }
                            ]
                        }
                    },
                    {
                        $group: {
                            _id: '$objetivo.id',
                            nombre: { $first: '$objetivo.nombre' },
                            ultima_actividad: { $max: '$timestamp' },
                            operaciones: { $sum: 1 },
                            tipos_operacion: { $addToSet: '$accion' },
                            ubicaciones_registradas: {
                                $sum: { $cond: [{ $eq: ['$entidad', 'ubicacion'] }, 1, 0] }
                            }
                        }
                    },
                    { $sort: { ultima_actividad: -1 } },
                    { $limit: 50 }
                ]);

                // Complementar con datos de mascotas
                const mascotas = await Mascota.find({})
                    .populate('propietario', 'nombre email')
                    .limit(50);

                reportData.total = Math.max(actividadDispositivos.length, mascotas.length);
                reportData.dispositivos = mascotas.map((mascota, index) => {
                    const actividad = actividadDispositivos.find(
                        act => act._id?.toString() === mascota._id.toString()
                    );
                    
                    return {
                        id: `CHIP-${(index + 1).toString().padStart(3, '0')}`,
                        serial: `ONI${mascota._id.toString().slice(-6).toUpperCase()}`,
                        mascota: mascota.nombre,
                        especie: mascota.especie,
                        propietario: mascota.propietario?.nombre || 'N/A',
                        email: mascota.propietario?.email || 'N/A',
                        ultima_actividad: actividad?.ultima_actividad || mascota.createdAt,
                        operaciones_total: actividad?.operaciones || 0,
                        ubicaciones_enviadas: actividad?.ubicaciones_registradas || 0,
                        estado: actividad && 
                               new Date() - new Date(actividad.ultima_actividad) < 24 * 60 * 60 * 1000 
                               ? 'Activo' : 'Inactivo'
                    };
                });
                break;

            case 'ubicaciones':
                console.log('📍 Generando reporte de ubicaciones desde auditoría...');
                
                const ubicacionesAuditoria = await Auditoria.find({
                    ...filtrosAuditoria,
                    $or: [
                        { entidad: 'ubicacion' },
                        { accion: 'GPS_UPDATE' },
                        { categoria: 'gps' }
                    ]
                })
                .sort({ timestamp: -1 })
                .limit(100)
                .lean();

                reportData.total = ubicacionesAuditoria.length;
                reportData.ubicaciones = ubicacionesAuditoria.map(reg => ({
                    timestamp: reg.timestamp,
                    mascota: reg.objetivo?.nombre || 'Dispositivo',
                    latitud: reg.objetivo?.detalles?.latitud || 
                             reg.cambios?.nuevo?.latitude || 
                             reg.cambios?.nuevo?.latitud || 'N/A',
                    longitud: reg.objetivo?.detalles?.longitud || 
                              reg.cambios?.nuevo?.longitude || 
                              reg.cambios?.nuevo?.longitud || 'N/A',
                    precision: reg.objetivo?.detalles?.precision || 
                               reg.cambios?.nuevo?.accuracy || 
                               reg.cambios?.nuevo?.precision || 'N/A',
                    metodo: reg.metadata?.metodo || 'GPS',
                    tiempo_procesamiento: reg.metadata?.tiempoEjecucion || 0,
                    exitoso: reg.metadata?.exitoso !== false
                }));
                break;

            case 'estadisticas':
                console.log('📊 Generando estadísticas avanzadas desde auditoría...');
                
                const estadisticasAuditoria = await Auditoria.aggregate([
                    { $match: filtrosAuditoria },
                    {
                        $group: {
                            _id: null,
                            total_operaciones: { $sum: 1 },
                            operaciones_exitosas: {
                                $sum: { $cond: [{ $ne: ['$metadata.exitoso', false] }, 1, 0] }
                            },
                            usuarios_activos: { $addToSet: '$actor.id' },
                            entidades_afectadas: { $addToSet: '$entidad' },
                            tiempo_promedio: { $avg: '$metadata.tiempoEjecucion' },
                            operaciones_por_tipo: {
                                $push: '$accion'
                            }
                        }
                    }
                ]);

                const [totalUsuarios, totalMascotas] = await Promise.all([
                    Usuario.countDocuments(),
                    Mascota.countDocuments()
                ]);

                const stats = estadisticasAuditoria[0] || {};
                
                reportData.total = 6;
                reportData.estadisticas = [
                    { 
                        categoria: 'Total Operaciones', 
                        valor: stats.total_operaciones || 0,
                        descripcion: 'Operaciones registradas en auditoría'
                    },
                    { 
                        categoria: 'Tasa de Éxito', 
                        valor: stats.total_operaciones > 0 
                            ? ((stats.operaciones_exitosas / stats.total_operaciones) * 100).toFixed(1) + '%'
                            : '100%',
                        descripcion: 'Porcentaje de operaciones exitosas'
                    },
                    { 
                        categoria: 'Usuarios Activos', 
                        valor: stats.usuarios_activos?.length || 0,
                        descripcion: 'Usuarios con actividad registrada'
                    },
                    { 
                        categoria: 'Tiempo Promedio', 
                        valor: stats.tiempo_promedio ? stats.tiempo_promedio.toFixed(2) + 'ms' : 'N/A',
                        descripcion: 'Tiempo promedio de procesamiento'
                    },
                    { 
                        categoria: 'Usuarios Totales', 
                        valor: totalUsuarios,
                        descripcion: 'Total de usuarios registrados'
                    },
                    { 
                        categoria: 'Mascotas Totales', 
                        valor: totalMascotas,
                        descripción: 'Total de mascotas registradas'
                    }
                ];
                break;

            case 'mascotas':
                console.log('🐕 Generando reporte de mascotas con actividad...');
                
                const mascotasConActividad = await Auditoria.aggregate([
                    {
                        $match: {
                            ...filtrosAuditoria,
                            entidad: 'mascota'
                        }
                    },
                    {
                        $group: {
                            _id: '$objetivo.id',
                            nombre: { $first: '$objetivo.nombre' },
                            operaciones: { $sum: 1 },
                            ultima_actividad: { $max: '$timestamp' },
                            tipos_operacion: { $addToSet: '$accion' }
                        }
                    }
                ]);

                const mascotasReporte = await Mascota.find({})
                    .populate('propietario', 'nombre email')
                    .sort({ createdAt: -1 })
                    .limit(50);

                reportData.total = mascotasReporte.length;
                reportData.mascotas = mascotasReporte.map(mascota => {
                    const actividad = mascotasConActividad.find(
                        act => act._id?.toString() === mascota._id.toString()
                    );
                    
                    return {
                        _id: mascota._id,
                        nombre: mascota.nombre,
                        especie: mascota.especie,
                        raza: mascota.raza,
                        edad: mascota.edad,
                        propietario: mascota.propietario?.nombre || 'N/A',
                        email: mascota.propietario?.email || 'N/A',
                        createdAt: mascota.createdAt,
                        actividad_total: actividad?.operaciones || 0,
                        ultima_actividad: actividad?.ultima_actividad || mascota.createdAt
                    };
                });
                break;

            default:
                return res.status(400).json({
                    error: 'Tipo de reporte no válido',
                    message: 'Use: auditoria, actividad, dispositivos, ubicaciones, estadisticas, mascotas',
                    total: 0
                });
        }

        const processingTime = Date.now() - startTime;
        reportData.processingTime = processingTime;
        
        console.log(`✅ Reporte generado desde auditoría: ${tipoReporte}, Total: ${reportData.total} registros, Tiempo: ${processingTime}ms`);
        res.json(reportData);

    } catch (error) {
        console.error('❌ Error generando reporte desde auditoría:', error);
        res.status(500).json({ 
            error: 'Error al generar reporte', 
            message: error.message,
            total: 0
        });
    }
};

/**
 * 📄 Exportar reporte a PDF
 * 
 * @description Genera reporte en formato PDF real usando PDFKit con los mismos datos que Excel
 * @route POST /api/admin/export-pdf
 * @access Admin
 * 
 * @input {Array<Object>} data - Array de registros con claves dinámicas (igual que Excel)
 * @input {string} tipo - Tipo de reporte a generar (igual que Excel)
 * @input {string} [fechaInicio] - Filtro fecha inicio (opcional)
 * @input {string} [fechaFin] - Filtro fecha fin (opcional)
 * @input {string} [usuario] - Filtro por usuario (opcional)
 * @input {string} [mascota] - Filtro por mascota (opcional)
 * 
 * @output {File} 200 - Archivo PDF generado
 * @output {Object} 400 - Parámetros inválidos
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.exportPDF = async (req, res) => {
    try {
        const { data, tipo, fechaInicio, fechaFin, mascota } = req.body;
        
        console.log('📄 Generando PDF real usando PDFKit con la misma lógica que Excel...');
        console.log('📋 Datos recibidos:', {
            dataLength: data?.length,
            tipo,
            fechaInicio,
            fechaFin,
            mascota
        });
        
        // Validar parámetros básicos (igual que Excel)
        if (!Array.isArray(data) || data.length === 0 || !tipo) {
            return res.status(400).json({
                message: 'Parámetros requeridos: data (Array) y tipo (string)'
            });
        }
        
        // Filtrar datos por fecha si se proveen (MISMA LÓGICA QUE EXCEL)
        let filtered = data;
        if (fechaInicio && fechaFin) {
            console.log('🔍 Debug fechas recibidas para PDF:', { fechaInicio, fechaFin });
            
            const start = new Date(fechaInicio);
            const end = new Date(fechaFin);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                console.error('❌ Fechas inválidas recibidas para PDF:', { fechaInicio, fechaFin });
                return res.status(400).json({
                    message: 'Formato de fecha inválido. Use formato ISO: YYYY-MM-DD'
                });
            }
            
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.timestamp || item.fecha || item.date || item.createdAt);
                if (isNaN(itemDate.getTime())) {
                    return true; // Incluir items sin fecha válida
                }
                return itemDate >= start && itemDate <= end;
            });
            
            console.log(`📊 Filtro de fecha aplicado en PDF: ${data.length} -> ${filtered.length} registros`);
        }
        
        // Filtrar por mascota (MISMA LÓGICA QUE EXCEL)
        if (mascota) {
            filtered = filtered.filter(item => item.mascota === mascota || item.pet === mascota);
        }
        
        // Crear documento PDF
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4',
            layout: 'landscape' // Usar orientación horizontal para tablas
        });
        
        // Configurar headers de respuesta
        const fileName = `reporte-${tipo}-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Pipe el PDF directamente a la respuesta
        doc.pipe(res);
        
        // Título del documento
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(`REPORTE ONICHIP IoT - ${tipo.toUpperCase()}`, { align: 'center' });
        
        doc.moveDown();
        
        // Información del reporte
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`)
           .text(`Total de registros: ${filtered.length}`)
           .text(`Tipo: ${tipo}`)
           .text(fechaInicio && fechaFin ? `Período: ${fechaInicio} al ${fechaFin}` : 'Sin filtro de fechas');
        
        doc.moveDown();
        
        if (filtered.length === 0) {
            doc.fontSize(12)
               .text('No hay datos disponibles para mostrar en el reporte.', { align: 'center' });
        } else {
            // Obtener headers dinámicamente (igual que Excel)
            const headers = Object.keys(filtered[0]);
            const maxRows = Math.min(filtered.length, 50); // Limitar a 50 filas para PDF
            
            // Configurar tabla
            const tableTop = doc.y + 20;
            const tableLeft = 50;
            const columnWidth = (doc.page.width - 100) / headers.length; // Distribuir columnas uniformemente
            
            // Dibujar encabezados
            doc.fontSize(8)
               .font('Helvetica-Bold');
            
            headers.forEach((header, i) => {
                const x = tableLeft + (i * columnWidth);
                doc.text(header.charAt(0).toUpperCase() + header.slice(1), x, tableTop, {
                    width: columnWidth - 5,
                    align: 'left'
                });
            });
            
            // Línea separadora después de encabezados
            const headerBottom = tableTop + 15;
            doc.moveTo(tableLeft, headerBottom)
               .lineTo(tableLeft + (headers.length * columnWidth), headerBottom)
               .stroke();
            
            // Dibujar filas de datos
            doc.font('Helvetica')
               .fontSize(7);
            
            for (let i = 0; i < maxRows; i++) {
                const item = filtered[i];
                const rowY = headerBottom + 5 + (i * 12);
                
                // Verificar si necesitamos una nueva página
                if (rowY > doc.page.height - 100) {
                    doc.addPage({ layout: 'landscape' });
                    break;
                }
                
                headers.forEach((header, j) => {
                    const x = tableLeft + (j * columnWidth);
                    let value = item[header];
                    
                    // Formatear valores
                    if (value === null || value === undefined) {
                        value = 'N/A';
                    } else if (typeof value === 'object') {
                        if (value instanceof Date) {
                            value = value.toLocaleDateString('es-ES');
                        } else {
                            value = JSON.stringify(value);
                        }
                    } else if (typeof value === 'boolean') {
                        value = value ? 'Sí' : 'No';
                    } else {
                        value = value.toString();
                    }
                    
                    // Truncar valores muy largos
                    if (value.length > 20) {
                        value = value.substring(0, 17) + '...';
                    }
                    
                    doc.text(value, x, rowY, {
                        width: columnWidth - 5,
                        align: 'left'
                    });
                });
            }
            
            // Resumen al final
            doc.moveDown(3)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('RESUMEN DEL REPORTE:', { align: 'left' })
               .font('Helvetica')
               .text(`• Total de registros: ${filtered.length}`)
               .text(`• Registros mostrados: ${maxRows}`)
               .text(`• Tipo: ${tipo}`)
               .text(`• Generado: ${new Date().toLocaleString('es-ES')}`);
            
            if (filtered.length > 50) {
                doc.text('• Nota: Mostrando solo los primeros 50 registros para optimizar el PDF');
            }
        }
        
        // Finalizar el documento
        doc.end();
        
        console.log(`✅ PDF real generado: ${fileName} con ${filtered.length} registros`);

    } catch (error) {
        console.error('❌ Error generando PDF real:', error);
        res.status(500).json({ 
            message: 'Error al generar PDF real', 
            error: error.message 
        });
    }
};

// ================================
// 📊 NUEVAS FUNCIONES PARA DASHBOARD
// ================================

/**
 * 📈 Obtener métricas en tiempo real para dashboard
 * 
 * @description Obtiene métricas clave basadas en auditoría para dashboard
 * @route GET /api/admin/dashboard-metrics
 * @access Admin
 * 
 * @output {Object} 200 - Métricas de dashboard en tiempo real
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.getDashboardMetrics = async (req, res) => {
    try {
        console.log('📈 Generando métricas de dashboard...');
        const startTime = Date.now();

        // Período para métricas (últimas 24 horas y última semana)
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const metricas = await Promise.all([
            // Métricas básicas últimas 24h
            Auditoria.aggregate([
                {
                    $match: { 
                        timestamp: { $gte: hace24h },
                        'actor.id': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_operaciones: { $sum: 1 },
                        usuarios_activos: { 
                            $addToSet: {
                                $cond: [
                                    { $ne: ['$actor.id', null] },
                                    '$actor.id',
                                    '$$REMOVE'
                                ]
                            }
                        },
                        operaciones_exitosas: {
                            $sum: { $cond: [{ $ne: ['$metadata.exitoso', false] }, 1, 0] }
                        },
                        ubicaciones_gps: {
                            $sum: { $cond: [{ $eq: ['$entidad', 'ubicacion'] }, 1, 0] }
                        }
                    }
                }
            ]),

            // Actividad por hora (últimas 24h)
            Auditoria.aggregate([
                {
                    $match: { 
                        timestamp: { $gte: hace24h },
                        'actor.id': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: { $hour: '$timestamp' },
                        operaciones: { $sum: 1 },
                        usuarios_unicos: { 
                            $addToSet: {
                                $cond: [
                                    { $ne: ['$actor.id', null] },
                                    '$actor.id',
                                    '$$REMOVE'
                                ]
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        usuarios_count: { $size: '$usuarios_unicos' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]),

            // Top entidades más activas
            Auditoria.aggregate([
                {
                    $match: { 
                        timestamp: { $gte: hace7d },
                        entidad: { $exists: true, $ne: null, $ne: '' }
                    }
                },
                {
                    $group: {
                        _id: '$entidad',
                        operaciones: { $sum: 1 },
                        ultima_actividad: { $max: '$timestamp' }
                    }
                },
                { $sort: { operaciones: -1 } },
                { $limit: 5 }
            ]),

            // Estados de sistema (errores, warnings)
            Auditoria.aggregate([
                {
                    $match: { 
                        timestamp: { $gte: hace24h },
                        severidad: { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: '$severidad',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const metricas24h = metricas[0][0] || {};
        const actividadPorHora = metricas[1];
        const topEntidades = metricas[2];
        const estadosSistema = metricas[3];

        const processingTime = Date.now() - startTime;

        console.log(`✅ Métricas de dashboard generadas en ${processingTime}ms`);
        res.json({
            resumen: {
                operaciones_24h: metricas24h.total_operaciones || 0,
                usuarios_activos_24h: metricas24h.usuarios_activos?.length || 0,
                tasa_exito: metricas24h.total_operaciones > 0 
                    ? ((metricas24h.operaciones_exitosas / metricas24h.total_operaciones) * 100).toFixed(1)
                    : '100',
                ubicaciones_gps_24h: metricas24h.ubicaciones_gps || 0
            },
            graficos: {
                actividad_por_hora: actividadPorHora,
                top_entidades: topEntidades,
                estados_sistema: estadosSistema
            },
            timestamp: new Date().toISOString(),
            processingTime
        });

    } catch (error) {
        console.error('❌ Error generando métricas de dashboard:', error);
        res.status(500).json({ 
            message: 'Error al obtener métricas de dashboard',
            error: error.message 
        });
    }
};

/**
 * 📊 Obtener datos para gráficos específicos
 * 
 * @description Genera datos optimizados para gráficos específicos del dashboard
 * @route POST /api/admin/chart-data
 * @access Admin
 * 
 * @input {Object} req.body - Parámetros del gráfico
 * @input {string} req.body.tipoGrafico - Tipo de gráfico (timeline/pie/bar/heatmap)
 * @input {string} req.body.metrica - Métrica a graficar
 * @input {number} req.body.periodo - Período en días (opcional, default: 7)
 * 
 * @output {Object} 200 - Datos formateados para gráficos
 * @output {Object} 400 - Parámetros inválidos
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.getChartData = async (req, res) => {
    try {
        const { tipoGrafico, metrica, periodo = 7 } = req.body;
        console.log('📊 Generando datos para gráfico:', { tipoGrafico, metrica, periodo });

        if (!tipoGrafico || !metrica) {
            return res.status(400).json({ 
                message: 'tipoGrafico y metrica son requeridos' 
            });
        }

        const fechaInicio = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000);
        let chartData = {};

        switch (tipoGrafico) {
            case 'timeline':
                if (metrica === 'actividad_diaria') {
                    chartData = await Auditoria.aggregate([
                        {
                            $match: { 
                                timestamp: { $gte: fechaInicio },
                                'actor.id': { $exists: true }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    fecha: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                                },
                                operaciones: { $sum: 1 },
                                usuarios: { 
                                    $addToSet: {
                                        $cond: [
                                            { $ne: ['$actor.id', null] },
                                            '$actor.id',
                                            '$$REMOVE'
                                        ]
                                    }
                                },
                                errores: {
                                    $sum: { $cond: [{ $eq: ['$metadata.exitoso', false] }, 1, 0] }
                                }
                            }
                        },
                        {
                            $addFields: {
                                usuarios_count: { $size: '$usuarios' }
                            }
                        },
                        { $sort: { '_id.fecha': 1 } }
                    ]);
                }
                break;

            case 'pie':
                if (metrica === 'operaciones_por_entidad') {
                    chartData = await Auditoria.aggregate([
                        {
                            $match: { 
                                timestamp: { $gte: fechaInicio },
                                entidad: { $exists: true, $ne: null, $ne: '' }
                            }
                        },
                        {
                            $group: {
                                _id: '$entidad',
                                value: { $sum: 1 }
                            }
                        },
                        { $sort: { value: -1 } }
                    ]);
                } else if (metrica === 'usuarios_por_tipo') {
                    chartData = await Auditoria.aggregate([
                        {
                            $match: { 
                                timestamp: { $gte: fechaInicio },
                                'actor.tipo': { $exists: true, $ne: null }
                            }
                        },
                        {
                            $group: {
                                _id: '$actor.tipo',
                                value: { $sum: 1 }
                            }
                        }
                    ]);
                }
                break;

            case 'bar':
                if (metrica === 'top_usuarios_activos') {
                    chartData = await Auditoria.aggregate([
                        {
                            $match: { 
                                timestamp: { $gte: fechaInicio },
                                'actor.tipo': 'usuario',
                                'actor.id': { $exists: true, $ne: null },
                                'actor.nombre': { $exists: true, $ne: null, $ne: '' }
                            }
                        },
                        {
                            $group: {
                                _id: '$actor.id',
                                nombre: { $first: '$actor.nombre' },
                                operaciones: { $sum: 1 },
                                ultima_actividad: { $max: '$timestamp' }
                            }
                        },
                        { $sort: { operaciones: -1 } },
                        { $limit: 10 }
                    ]);
                }
                break;

            case 'heatmap':
                if (metrica === 'actividad_por_hora_dia') {
                    chartData = await Auditoria.aggregate([
                        {
                            $match: { 
                                timestamp: { $gte: fechaInicio }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    dia: { $dayOfWeek: '$timestamp' },
                                    hora: { $hour: '$timestamp' }
                                },
                                intensidad: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id.dia': 1, '_id.hora': 1 } }
                    ]);
                }
                break;

            default:
                return res.status(400).json({
                    message: 'Tipo de gráfico no válido',
                    tipos_validos: ['timeline', 'pie', 'bar', 'heatmap']
                });
        }

        console.log(`✅ Datos de gráfico generados: ${tipoGrafico} - ${metrica}`);
        res.json({
            tipo: tipoGrafico,
            metrica,
            periodo,
            data: chartData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error generando datos de gráfico:', error);
        res.status(500).json({ 
            message: 'Error al generar datos de gráfico',
            error: error.message 
        });
    }
};

/**
 * 🔥 Obtener alertas y eventos críticos
 * 
 * @description Obtiene eventos críticos y alertas basados en auditoría
 * @route GET /api/admin/critical-events
 * @access Admin
 * 
 * @output {Object} 200 - Eventos críticos del sistema
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.getCriticalEvents = async (req, res) => {
    try {
        console.log('🔥 Obteniendo eventos críticos...');
        const startTime = Date.now();

        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const eventos = await Promise.all([
            // Errores críticos recientes
            Auditoria.find({
                timestamp: { $gte: hace24h },
                $or: [
                    { severidad: 'critical' },
                    { severidad: 'error' },
                    { 'metadata.exitoso': false }
                ]
            })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean(),

            // Patrones anómalos de actividad
            Auditoria.aggregate([
                {
                    $match: { timestamp: { $gte: hace24h } }
                },
                {
                    $group: {
                        _id: '$actor.id',
                        operaciones: { $sum: 1 },
                        nombre: { $first: '$actor.nombre' },
                        tipo: { $first: '$actor.tipo' }
                    }
                },
                {
                    $match: { operaciones: { $gt: 100 } } // Actividad sospechosa
                },
                { $sort: { operaciones: -1 } },
                { $limit: 10 }
            ]),

            // Dispositivos sin actividad reciente
            Auditoria.aggregate([
                {
                    $match: {
                        entidad: 'ubicacion',
                        timestamp: { $lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } // Sin GPS por 6h
                    }
                },
                {
                    $group: {
                        _id: '$objetivo.id',
                        nombre: { $first: '$objetivo.nombre' },
                        ultima_ubicacion: { $max: '$timestamp' }
                    }
                },
                { $sort: { ultima_ubicacion: 1 } },
                { $limit: 5 }
            ])
        ]);

        const processingTime = Date.now() - startTime;

        console.log(`✅ Eventos críticos obtenidos en ${processingTime}ms`);
        res.json({
            errores_criticos: eventos[0],
            actividad_anomala: eventos[1],
            dispositivos_sin_gps: eventos[2],
            resumen: {
                total_errores: eventos[0].length,
                usuarios_actividad_alta: eventos[1].length,
                dispositivos_inactivos: eventos[2].length
            },
            timestamp: new Date().toISOString(),
            processingTime
        });

    } catch (error) {
        console.error('❌ Error obteniendo eventos críticos:', error);
        res.status(500).json({ 
            message: 'Error al obtener eventos críticos',
            error: error.message 
        });
    }
};

/**
 * 📋 Obtener estadísticas de rendimiento del sistema
 * 
 * @description Genera métricas de rendimiento basadas en auditoría
 * @route GET /api/admin/performance-stats
 * @access Admin
 * 
 * @output {Object} 200 - Estadísticas de rendimiento
 * @output {Object} 500 - Error interno del servidor
 */
reportesController.getPerformanceStats = async (req, res) => {
    try {
        console.log('📋 Generando estadísticas de rendimiento...');
        const startTime = Date.now();

        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const stats = await Promise.all([
            // Tiempos de respuesta promedio por endpoint
            Auditoria.aggregate([
                {
                    $match: { 
                        timestamp: { $gte: hace24h },
                        'metadata.tiempoEjecucion': { $exists: true, $gt: 0 },
                        'metadata.endpoint': { $exists: true, $ne: null, $ne: '' }
                    }
                },
                {
                    $group: {
                        _id: '$metadata.endpoint',
                        tiempo_promedio: { $avg: '$metadata.tiempoEjecucion' },
                        tiempo_maximo: { $max: '$metadata.tiempoEjecucion' },
                        tiempo_minimo: { $min: '$metadata.tiempoEjecucion' },
                        total_requests: { $sum: 1 }
                    }
                },
                { $sort: { tiempo_promedio: -1 } },
                { $limit: 10 }
            ]),

            // Carga del sistema por hora
            Auditoria.aggregate([
                {
                    $match: { timestamp: { $gte: hace24h } }
                },
                {
                    $group: {
                        _id: { $hour: '$timestamp' },
                        operaciones_por_hora: { $sum: 1 },
                        tiempo_promedio: { 
                            $avg: {
                                $cond: [
                                    { $and: [
                                        { $ne: ['$metadata.tiempoEjecucion', null] },
                                        { $gt: ['$metadata.tiempoEjecucion', 0] }
                                    ]},
                                    '$metadata.tiempoEjecucion',
                                    null
                                ]
                            }
                        }
                    }
                },
                { $sort: { '_id': 1 } }
            ]),

            // Comparación semanal
            Auditoria.aggregate([
                {
                    $match: { timestamp: { $gte: hace7d } }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                        },
                        operaciones: { $sum: 1 },
                        tiempo_promedio: { 
                            $avg: {
                                $cond: [
                                    { $and: [
                                        { $ne: ['$metadata.tiempoEjecucion', null] },
                                        { $gt: ['$metadata.tiempoEjecucion', 0] }
                                    ]},
                                    '$metadata.tiempoEjecucion',
                                    null
                                ]
                            }
                        },
                        errores: {
                            $sum: { $cond: [{ $eq: ['$metadata.exitoso', false] }, 1, 0] }
                        }
                    }
                },
                { $sort: { '_id': -1 } },
                { $limit: 7 }
            ])
        ]);

        const processingTime = Date.now() - startTime;

        console.log(`✅ Estadísticas de rendimiento generadas en ${processingTime}ms`);
        res.json({
            endpoints_mas_lentos: stats[0],
            carga_por_hora: stats[1],
            tendencia_semanal: stats[2],
            metadata: {
                periodo_analizado: '24 horas',
                timestamp: new Date().toISOString(),
                processingTime
            }
        });

    } catch (error) {
        console.error('❌ Error generando estadísticas de rendimiento:', error);
        res.status(500).json({ 
            message: 'Error al generar estadísticas de rendimiento',
            error: error.message 
        });
    }
};

module.exports = reportesController;
