const Device = require('../models/device');

// GET /api/device/dev/:deviceId
exports.getByDeviceId = async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) return res.status(404).json({ error: 'Not found' });
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/device/dev/:deviceId
exports.deleteByDeviceId = async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({ deviceId: req.params.deviceId });
    if (!device) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/device/dev/:deviceId
exports.updateByDeviceId = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      req.body,
      { new: true }
    );
    if (!device) return res.status(404).json({ error: 'Not found' });
    res.json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Remove id from body if present, will be auto-generated
    const data = { ...req.body };
    delete data.id;
    const device = new Device(data);
    await device.save();
    // Emitir evento de actualización en tiempo real
    const io = req.app.get('io');
    if (io && req.body.userId) {
      io.emit('devicesUpdated', { userId: req.body.userId });
    }
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const device = await Device.findOne({ _id: req.params._id });
    if (!device) return res.status(404).json({ error: 'Not found' });
    // Emitir evento de actualización en tiempo real
    const io = req.app.get('io');
    if (io && req.body.userId) {
      io.emit('devicesUpdated', { userId: req.body.userId });
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const device = await Device.findByIdAndUpdate(
      req.params._id,
      req.body,
      { new: true }
    );
    if (!device) return res.status(404).json({ error: 'Not found' });
    res.json(device);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const device = await Device.findByIdAndDelete(req.params._id);
    if (!device) return res.status(404).json({ error: 'Not found' });
    // Emitir evento de actualización en tiempo real
    const io = req.app.get('io');
    if (io && req.body.userId) {
      io.emit('devicesUpdated', { userId: req.body.userId });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
