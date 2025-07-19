const express = require('express');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);
const { initSocket } = require('./socket');
const deviceRoutes = require('./routes/device');
const userRoutes = require('./routes/user');


app.use(express.json());
app.use('/api/device', deviceRoutes);
app.use('/api/user', userRoutes);

mongoose.connect('mongodb+srv://joscart:Jose1234@cluster0.cvc2htm.mongodb.net/onichip', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  const PORT = process.env.PORT || 3000;
  const io = initSocket(http);
  app.set('io', io); // Para acceder desde los controladores
  http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
