const express = require('express');
const router = express.Router();
// 👈 controller-dən getDashboardStats funksiyasını da bura əlavə etdik
const {
    getAllPackages,
    createPackage,
    deletePackage,
    updatePackageStatus,
    getDashboardStats
} = require('../controllers/packageController');

router.get('/', getAllPackages);
router.post('/', createPackage);
router.delete('/:id', deletePackage);
router.put('/:id/status', updatePackageStatus);

// Dashboard statistika marşrutu
router.get('/stats', getDashboardStats);

module.exports = router;