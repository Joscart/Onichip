const Mascota = require('../models/mascota');
const mascotaController = {};

// GET todas las mascotas
mascotaController.getMascotas = async (req, res) => {
    const mascotas = await Mascota.find().populate('propietario', 'nombre email');
    res.json(mascotas);
};

// GET mascota por ID
mascotaController.getMascota = async (req, res) => {
    const mascota = await Mascota.findById(req.params.id).populate('propietario', 'nombre email');
    res.json(mascota);
};

// GET mascotas por owner
mascotaController.getMascotasByOwner = async (req, res) => {
    const ownerId = req.params.ownerId;
    const mascotas = await Mascota.find({ propietario: ownerId }).populate('propietario', 'nombre email');
    res.json(mascotas);
};

// POST nueva mascota (acepta JSON del firmware o formulario)
mascotaController.addMascota = async (req, res) => {
    try {
        const mascota = new Mascota(req.body);
        await mascota.save();
        res.json({ message: 'Mascota agregada exitosamente', mascota });
    } catch (err) {
        res.status(400).json({ message: 'Error al agregar mascota', error: err.message });
    }
};

// PUT actualizar mascota por deviceId (acepta JSON del firmware)
mascotaController.editMascota = async (req, res) => {
    const { deviceId } = req.params;
    try {
        const updated = await Mascota.findOneAndUpdate(
            { deviceId },
            { $set: req.body },
            { new: true, upsert: false }
        );
        if (!updated) return res.status(404).json({ message: 'Mascota no encontrada' });
        res.json({ message: 'Mascota actualizada exitosamente', mascota: updated });
    } catch (err) {
        res.status(400).json({ message: 'Error al actualizar mascota', error: err.message });
    }
};

// DELETE eliminar mascota por ID
mascotaController.deleteMascota = async (req, res) => {
    await Mascota.findByIdAndDelete(req.params.id);
    res.json('Mascota eliminada exitosamente');
};

module.exports = mascotaController;
