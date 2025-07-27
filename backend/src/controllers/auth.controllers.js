/**
 * ================================================
 * 🔐 AUTH CONTROLLER - AUTENTICACIÓN UNIFICADA
 * ================================================
 * 
 * Controlador para autenticación unificada del sistema
 * Maneja login de usuarios y administradores según dominio
 * 
 * @author Onichip Team
 * @version 2.0
 */

const Usuario = require('../models/usuario');
const Admin = require('../models/admin');
const bcrypt = require('bcryptjs');

const authController = {};

/**
 * 👨‍💼 Crear nuevo administrador
 * 
 * @description Solo el superadministrador puede crear nuevos administradores
 * @route POST /api/admin/create
 * @access Super Admin Only
 * 
 * @input {Object} req.body - Datos del superadmin y nuevo admin
 * @input {string} req.body.superAdminEmail - Email del superadministrador
 * @input {string} req.body.superAdminPassword - Contraseña del superadministrador
 * @input {string} req.body.nombre - Nombre del nuevo administrador
 * @input {string} req.body.email - Email del nuevo administrador
 * @input {string} req.body.password - Contraseña del nuevo administrador
 * 
 * @output {Object} 200 - Administrador creado exitosamente
 * @output {Object} 400 - Faltan datos o administrador ya existe
 * @output {Object} 401 - Contraseña de superadmin incorrecta
 * @output {Object} 403 - No autorizado (no es superadmin)
 * @output {Object} 500 - Error interno del servidor
 */
authController.createAdmin = async (req, res) => {
  const { superAdminEmail, superAdminPassword, nombre, email, password } = req.body;
  if (!superAdminEmail || !superAdminPassword || !nombre || !email || !password) {
    return res.status(400).json({ message: 'Faltan datos' });
  }
  try {
    // Verificar superadmin
    const superAdmin = await Admin.findOne({ email: superAdminEmail, rol: 'super_admin' });
    if (!superAdmin) return res.status(403).json({ message: 'No autorizado. Solo el superadmin puede crear admins.' });
    const match = await bcrypt.compare(superAdminPassword, superAdmin.password);
    if (!match) return res.status(401).json({ message: 'Contraseña de superadmin incorrecta.' });
    // Verificar que el nuevo admin no exista
    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Admin ya existe' });
    const hash = await bcrypt.hash(password, 10);
    const admin = new Admin({ nombre, email, password: hash, rol: 'admin' });
    await admin.save();
    return res.json({ message: 'Admin creado exitosamente', admin: { id: admin._id, email: admin.email, nombre: admin.nombre, rol: admin.rol } });
  } catch (err) {
    res.status(500).json({ message: 'Error al crear admin', error: err.message });
  }
};

/**
 * 🔐 Login unificado
 * 
 * @description Login de usuario o admin según dominio del email
 * @route POST /api/login
 * @access Public
 * 
 * @input {Object} req.body - Credenciales de login
 * @input {string} req.body.email - Email (determina si es admin o usuario)
 * @input {string} req.body.password - Contraseña
 * 
 * @output {Object} 200 - Login exitoso con tipo de usuario
 * @output {Object} 400 - Email y contraseña requeridos
 * @output {Object} 401 - Usuario/Admin no encontrado o contraseña incorrecta
 * @output {Object} 500 - Error interno del servidor
 */
authController.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });
  try {
    if (email.endsWith('@onichip.com')) {
      // Admin login
      const admin = await Admin.findOne({ email });
      if (!admin) return res.status(401).json({ message: 'Admin no encontrado' });
      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.status(401).json({ message: 'Contraseña incorrecta' });
      return res.json({ tipo: 'admin', admin: { id: admin._id, email: admin.email, nombre: admin.nombre, rol: admin.rol } });
    } else {
      // Usuario login
      const user = await Usuario.findOne({ email });
      if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: 'Contraseña incorrecta' });
      return res.json({ tipo: 'usuario', usuario: { id: user._id, email: user.email, nombre: user.nombre } });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error en login', error: err.message });
  }
};

// POST /api/register
// Registro de usuario o admin según dominio del email
authController.register = async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ message: 'Faltan datos' });
  try {
    const hash = await bcrypt.hash(password, 10);
    if (email.endsWith('@onichip.com')) {
      // Registrar admin solo si ya existe al menos un admin (superadmin)
      const exists = await Admin.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Admin ya existe' });
      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        // Permitir el primer admin (superadmin)
        const admin = new Admin({ nombre, email, password: hash, rol: 'super_admin' });
        await admin.save();
        return res.json({ tipo: 'admin', admin: { id: admin._id, email: admin.email, nombre: admin.nombre, rol: admin.rol } });
      } else {
        // Solo un superadmin puede crear más admins
        return res.status(403).json({ message: 'Solo un superadmin puede registrar nuevos administradores.' });
      }
    } else {
      // Registrar usuario
      const exists = await Usuario.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Usuario ya existe' });
      const user = new Usuario({ nombre, email, password: hash });
      await user.save();
      return res.json({ tipo: 'usuario', usuario: { id: user._id, email: user.email, nombre: user.nombre } });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error en registro', error: err.message });
  }
};

module.exports = authController;
