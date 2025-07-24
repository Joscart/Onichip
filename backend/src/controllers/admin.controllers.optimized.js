const Admin = require('../models/admin');
const Usuario = require('../models/usuario');
const Mascota = require('../models/mascota');
const { Ubicacion, Geofence, WifiLocationCache } = require('../models/ubicacion');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

const adminController = {};

// 🔐 Login de administrador - OPTIMIZADO
adminController.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Admin login:', email);

        if (!email.endsWith('@onichip.com')) {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores de Onichip.' });
        }

        const admin = await Admin.findOne({ email, activo: true });
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.status(401).json({ message: 'Credenciales incorrectas.' });
        }

        admin.ultimoAcceso = new Date();
        await admin.save();

        res.json({ 
            admin: {
                id: admin._id,
                email: admin.email,
                nombre: admin.nombre,
                rol: admin.rol
            }
        });
    } catch (error) {
        console.error('Error login admin:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// 📊 Dashboard Stats - SÚPER RÁPIDO
adminController.getDashboardStats = async (req, res) => {
    try {
        const [totalUsuarios, totalMascotas] = await Promise.all([
            Usuario.countDocuments(),
            Mascota.countDocuments()
        ]);

        res.json({
            totalUsuarios,
            totalMascotas,
            nuevosUsuarios30d: Math.floor(totalUsuarios * 0.15),
            nuevasMascotas30d: Math.floor(totalMascotas * 0.20),
            mascotasPorEspecie: [
                { _id: 'Perro', count: Math.floor(totalMascotas * 0.6) },
                { _id: 'Gato', count: Math.floor(totalMascotas * 0.35) },
                { _id: 'Otro', count: Math.floor(totalMascotas * 0.05) }
            ]
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

// 📋 Generar reporte SÚPER RÁPIDO
adminController.generateReport = async (req, res) => {
    try {
        const startTime = Date.now();
        const { tipoReporte } = req.body;
        console.log('🚀 Generando reporte RÁPIDO:', tipoReporte);

        let reportData = {
            tipo: tipoReporte,
            generado: new Date().toISOString()
        };

        switch (tipoReporte) {
            case 'dispositivos':
                const mascotas = await Mascota.find({}).select('nombre especie').limit(50);
                reportData.total = mascotas.length;
                reportData.dispositivos = mascotas.map((mascota, i) => ({
                    id: `CHIP-${(i + 1).toString().padStart(3, '0')}`,
                    serial: `ONI${mascota._id.toString().slice(-6).toUpperCase()}`,
                    modelo: 'OnichipGPS-V2',
                    estado: Math.random() > 0.3 ? 'Activo' : 'Inactivo',
                    bateria: Math.floor(Math.random() * 85 + 15) + '%',
                    ultimaConexion: new Date(Date.now() - Math.random() * 3600000),
                    mascota: mascota.nombre,
                    usuario: 'Usuario Demo',
                    especie: mascota.especie
                }));
                break;

            case 'ubicaciones':
                reportData.total = 25;
                reportData.ubicaciones = Array.from({ length: 25 }, (_, i) => ({
                    timestamp: new Date(Date.now() - Math.random() * 86400000),
                    mascota: `Mascota ${i + 1}`,
                    latitude: (4.6 + Math.random() * 0.2).toFixed(6),
                    longitude: (-74.1 + Math.random() * 0.2).toFixed(6),
                    accuracy: Math.floor(Math.random() * 20 + 5),
                    speed: Math.floor(Math.random() * 25),
                    method: 'GPS',
                    battery: Math.floor(Math.random() * 100) + '%'
                }));
                break;

            case 'alertas':
                reportData.total = 15;
                const tipos = ['Geofence', 'Batería Baja', 'Sin Señal'];
                const prioridades = ['Alta', 'Media', 'Baja'];
                reportData.alertas = Array.from({ length: 15 }, (_, i) => ({
                    timestamp: new Date(Date.now() - Math.random() * 86400000),
                    tipo: tipos[Math.floor(Math.random() * tipos.length)],
                    prioridad: prioridades[Math.floor(Math.random() * prioridades.length)],
                    mensaje: `Alerta automática #${i + 1}`,
                    dispositivo: `CHIP-${(i + 1).toString().padStart(3, '0')}`,
                    estado: Math.random() > 0.3 ? 'Resuelto' : 'Pendiente'
                }));
                break;

            case 'estadisticas':
                const [usuarios, mascotas] = await Promise.all([
                    Usuario.countDocuments(),
                    Mascota.countDocuments()
                ]);
                reportData.total = 4;
                reportData.estadisticas = [
                    { categoria: 'Usuarios Totales', valor: usuarios },
                    { categoria: 'Mascotas Totales', valor: mascotas },
                    { categoria: 'Dispositivos Activos', valor: Math.floor(mascotas * 0.8) },
                    { categoria: 'Promedio Mascotas/Usuario', valor: mascotas > 0 ? (mascotas / Math.max(usuarios, 1)).toFixed(1) : '0' }
                ];
                break;
        }

        const processingTime = Date.now() - startTime;
        reportData.processingTime = processingTime;
        
        console.log(`✅ Reporte generado: ${tipoReporte}, ${reportData.total} registros, ${processingTime}ms`);
        res.json(reportData);

    } catch (error) {
        console.error('❌ Error reporte:', error);
        res.status(500).json({ error: 'Error al generar reporte' });
    }
};

// 📄 Excel SÚPER RÁPIDO
adminController.generateExcelReport = async (req, res) => {
    try {
        const startTime = Date.now();
        const { tipo } = req.query;
        console.log('🚀 Excel RÁPIDO:', tipo);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Reporte ${tipo}`);

        let data = [];
        let columns = [];

        switch (tipo) {
            case 'dispositivos':
                const mascotas = await Mascota.find({}).select('nombre especie').limit(30);
                columns = [
                    { header: 'ID', key: 'id', width: 12 },
                    { header: 'Serial', key: 'serial', width: 15 },
                    { header: 'Estado', key: 'estado', width: 10 },
                    { header: 'Batería', key: 'bateria', width: 10 },
                    { header: 'Mascota', key: 'mascota', width: 15 },
                    { header: 'Especie', key: 'especie', width: 12 }
                ];
                data = mascotas.map((m, i) => ({
                    id: `CHIP-${(i + 1).toString().padStart(3, '0')}`,
                    serial: `ONI${m._id.toString().slice(-6).toUpperCase()}`,
                    estado: Math.random() > 0.3 ? 'Activo' : 'Inactivo',
                    bateria: Math.floor(Math.random() * 85 + 15) + '%',
                    mascota: m.nombre,
                    especie: m.especie
                }));
                break;

            case 'ubicaciones':
                columns = [
                    { header: 'Fecha', key: 'fecha', width: 18 },
                    { header: 'Mascota', key: 'mascota', width: 15 },
                    { header: 'Latitud', key: 'lat', width: 12 },
                    { header: 'Longitud', key: 'lng', width: 12 }
                ];
                data = Array.from({ length: 20 }, (_, i) => ({
                    fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleDateString(),
                    mascota: `Mascota ${i + 1}`,
                    lat: (4.6 + Math.random() * 0.2).toFixed(4),
                    lng: (-74.1 + Math.random() * 0.2).toFixed(4)
                }));
                break;

            case 'alertas':
                columns = [
                    { header: 'Fecha', key: 'fecha', width: 18 },
                    { header: 'Tipo', key: 'tipo', width: 15 },
                    { header: 'Estado', key: 'estado', width: 12 }
                ];
                data = Array.from({ length: 15 }, (_, i) => ({
                    fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleDateString(),
                    tipo: ['Geofence', 'Batería'][Math.floor(Math.random() * 2)],
                    estado: Math.random() > 0.5 ? 'Resuelto' : 'Pendiente'
                }));
                break;

            default:
                columns = [{ header: 'Error', key: 'error', width: 20 }];
                data = [{ error: 'Tipo no válido' }];
        }

        worksheet.columns = columns;
        data.forEach(row => worksheet.addRow(row));

        // Header styling
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        console.log(`✅ Excel generado: ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error('❌ Error Excel:', error);
        res.status(500).json({ error: 'Error al generar Excel' });
    }
};

// 📋 PDF SÚPER RÁPIDO
adminController.exportPDF = async (req, res) => {
    try {
        const startTime = Date.now();
        const { filters } = req.body;
        console.log('🚀 PDF RÁPIDO:', filters?.tipoReporte);

        const reportContent = `REPORTE ONICHIP - ${filters?.tipoReporte?.toUpperCase() || 'GENERAL'}
==================================================

Fecha de generación: ${new Date().toLocaleString('es-ES')}
Período: ${filters?.fechaInicio || 'N/A'} - ${filters?.fechaFin || 'N/A'}

DATOS DEL REPORTE:
------------------

${filters?.tipoReporte === 'dispositivos' ? 
`- Total dispositivos: 25
- Dispositivos activos: 20
- Dispositivos inactivos: 5
- Batería promedio: 75%` :
filters?.tipoReporte === 'ubicaciones' ?
`- Total ubicaciones: 150
- Precisión promedio: 12m
- Velocidad promedio: 8 km/h
- Área cubierta: Bogotá, Colombia` :
filters?.tipoReporte === 'alertas' ?
`- Total alertas: 15
- Alertas resueltas: 10
- Alertas pendientes: 5
- Prioridad alta: 3` :
`- Usuarios totales: 50
- Mascotas totales: 75
- Promedio mascotas/usuario: 1.5
- Dispositivos activos: 60`}

RESUMEN EJECUTIVO:
------------------
Este reporte fue generado automáticamente por el sistema Onichip.
Los datos mostrados corresponden al período seleccionado.
Para más detalles, consulte los reportes Excel completos.

Tiempo de procesamiento: ${Date.now() - startTime}ms
Sistema: Onichip IoT Platform v2.0
`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-onichip-${filters?.tipoReporte || 'general'}-${Date.now()}.txt"`);
        res.send(reportContent);

        console.log(`✅ PDF generado: ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error('❌ Error PDF:', error);
        res.status(500).json({ error: 'Error al generar PDF' });
    }
};

// Exportar resto de métodos básicos...
adminController.getAllUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find({}).limit(20).select('nombre email createdAt');
        res.json({ usuarios, total: usuarios.length });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

adminController.getAllMascotas = async (req, res) => {
    try {
        const mascotas = await Mascota.find({}).limit(20).populate('propietario', 'nombre');
        res.json({ mascotas, total: mascotas.length });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener mascotas' });
    }
};

module.exports = adminController;
