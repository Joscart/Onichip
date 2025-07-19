// PUT /api/user/:userId
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      req.body,
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
const User = require('../models/user');

exports.register = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: 'User registered', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { apodo, password } = req.body;
    const user = await User.findOne({ apodo });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserDevices = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addDevice = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.devices.push({ deviceId: req.body.deviceId, nickname: req.body.nickname || '' });
    await user.save();
    res.json(user.devices);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateDeviceNickname = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const device = user.devices.id(req.params.deviceMongoId);
    if (!device) return res.status(404).json({ error: 'Device not found for user' });
    device.nickname = req.body.nickname;
    await user.save();
    res.json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
