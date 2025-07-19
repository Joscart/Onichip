const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserDeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  nickname: { type: String, default: '' }
});

const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  apodo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  devices: [UserDeviceSchema]
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema, 'user');
