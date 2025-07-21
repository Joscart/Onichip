const Usuario = require('../models/usuario');
const Admin = require('../models/admin');
const bcrypt = require('bcryptjs');

const authController = {};
// POST /api/admin/create
// Solo el superadmin puede crear nuevos administradores
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

// POST /api/login
// Login de usuario o admin según dominio del email
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
