const express = require('express');
const cors = require('cors');
const packageRoutes = require('./src/routes/packageRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// API Yönləndirmələri
app.use('/api/packages', packageRoutes);

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Backend serveri işləyir: http://localhost:${PORT}`);
});