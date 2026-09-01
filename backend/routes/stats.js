const express = require('express');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ---------- GET /api/stats (admin overview) ----------
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const totalDonors = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'user'`);
    const unitsAvailable = await pool.query('SELECT COALESCE(SUM(units_available),0) AS total FROM blood_stock');
    const newRequests = await pool.query(`SELECT COUNT(*) FROM donation_requests WHERE status = 'Pending'`);
    const activeDrives = await pool.query(`SELECT COUNT(*) FROM donation_requests WHERE status = 'Approved'`);
    const unitsDonated = await pool.query('SELECT COALESCE(SUM(units),0) AS total FROM donation_history');
    const pendingEmergencies = await pool.query(
      `SELECT COUNT(*) FROM donation_requests WHERE is_emergency = true AND emergency_approved = false AND status != 'Rejected'`
    );

    res.json({
      total_donors: Number(totalDonors.rows[0].count),
      units_available: Number(unitsAvailable.rows[0].total),
      new_requests: Number(newRequests.rows[0].count),
      active_drives: Number(activeDrives.rows[0].count),
      units_donated_total: Number(unitsDonated.rows[0].total),
      pending_emergencies: Number(pendingEmergencies.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
