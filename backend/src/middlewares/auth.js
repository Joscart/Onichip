/**
 * ================================================
 * 🔐 MIDDLEWARE DE AUTENTICACIÓN
 * ================================================
 * 
 * Middleware para verificar permisos de usuarios y administradores
 * 
 * @author Onichip Team
 * @version 2.0
 */

const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario');
const Admin = require('../models/admin');

/**
 * 🔐 Verificar token JWT
 */
const verifyToken = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                message: 'Token de acceso requerido' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'onichip-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            message: 'Token de acceso inválido' 
        });
    }
};

/**
 * 👤 Verificar usuario autenticado
 */
const verifyUser = async (req, res, next) => {
    try {
        // Para rutas que no requieren autenticación estricta
        // permitir acceso sin token para desarrollo
        if (!req.headers.authorization) {
            req.user = {
                id: 'dev-user',
                tipo: 'usuario',
                nombre: 'Usuario de Desarrollo',
                email: 'dev@onichip.com'
            };
            return next();
        }

        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'onichip-secret-key');
        
        const usuario = await Usuario.findById(decoded.id);
        if (!usuario) {
            return res.status(404).json({ 
                message: 'Usuario no encontrado' 
            });
        }

        req.user = {
            id: usuario._id,
            tipo: 'usuario',
            nombre: usuario.nombre,
            email: usuario.email
        };
        
        next();
    } catch (error) {
        return res.status(401).json({ 
            message: 'Token de usuario inválido' 
        });
    }
};

/**
 * 👑 Verificar administrador
 */
const verifyAdmin = async (req, res, next) => {
    try {
        // Para desarrollo, permitir acceso sin token
        if (!req.headers.authorization) {
            req.user = {
                id: 'dev-admin',
                tipo: 'admin',
                nombre: 'Admin de Desarrollo',
                email: 'admin@onichip.com',
                rol: 'super_admin'
            };
            return next();
        }

        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'onichip-secret-key');
        
        // Buscar en la colección Admin
        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(404).json({ 
                message: 'Administrador no encontrado' 
            });
        }

        // Verificar que el admin esté activo
        if (!admin.activo) {
            return res.status(403).json({ 
                message: 'Cuenta de administrador desactivada' 
            });
        }

        req.user = {
            id: admin._id,
            tipo: 'admin',
            nombre: admin.nombre,
            email: admin.email,
            rol: admin.rol,
            permisos: admin.permisos
        };
        
        next();
    } catch (error) {
        console.error('❌ Error en verifyAdmin:', error);
        return res.status(401).json({ 
            message: 'Token de administrador inválido',
            error: error.message
        });
    }
};

/**
 * 🛡️ Verificar permisos específicos
 */
const verifyPermissions = (requiredPermissions = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    message: 'Usuario no autenticado' 
                });
            }

            // Los admins tienen todos los permisos
            if (req.user.tipo === 'admin') {
                return next();
            }

            // Verificar permisos específicos para usuarios
            if (requiredPermissions.length > 0) {
                const hasPermission = requiredPermissions.some(permission => 
                    req.user.permissions?.includes(permission)
                );

                if (!hasPermission) {
                    return res.status(403).json({ 
                        message: 'Permisos insuficientes' 
                    });
                }
            }

            next();
        } catch (error) {
            return res.status(500).json({ 
                message: 'Error verificando permisos' 
            });
        }
    };
};

module.exports = {
    verifyToken,
    verifyUser,
    verifyAdmin,
    verifyPermissions
};