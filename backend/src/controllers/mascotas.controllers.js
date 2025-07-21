const Device = require('../models/mascota');
const deviceController = {};

// GET todos los dispositivos
deviceController.getMascotas = async (req, res) => {
    const devices = await Device.find();
    res.json(devices);
};

// GET dispositivo por ID
deviceController.getMascota = async (req, res) => {
    const device = await Device.findById(req.params.id);
    res.json(device);
};

// GET dispositivos por owner
deviceController.getMascotasByOwner = async (req, res) => {
    const ownerId = req.params.ownerId;
    const devices = await Device.find({ propietario: ownerId });
    res.json(devices);
};

// POST nuevo dispositivo (acepta JSON del firmware)
deviceController.addMascota = async (req, res) => {
    try {
        const device = new Device(req.body);
        await device.save();
        res.json({ message: 'Device agregado exitosamente', device });
    } catch (err) {
        res.status(400).json({ message: 'Error al agregar device', error: err.message });
    }
};

// PUT actualizar dispositivo por deviceId (acepta JSON del firmware)
deviceController.editMascota = async (req, res) => {
    const { deviceId } = req.params;
    try {
        const updated = await Device.findOneAndUpdate(
            { deviceId },
            { $set: req.body },
            { new: true, upsert: false }
        );
        if (!updated) return res.status(404).json({ message: 'Device no encontrado' });
        res.json({ message: 'Device actualizado exitosamente', device: updated });
    } catch (err) {
        res.status(400).json({ message: 'Error al actualizar device', error: err.message });
    }
};

// DELETE eliminar dispositivo por ID
deviceController.deleteMascota = async (req, res) => {
    await Device.findByIdAndDelete(req.params.id);
    res.json('Device eliminado exitosamente');
};

module.exports = deviceController;
