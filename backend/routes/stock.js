const express = require('express');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function statusFor(units) {
  if (units <= 10) return 'Critical';
  if (units <= 20) return 'Low';
  return 'Available';
}

// ---------- GET /api/stock (public) ----------
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blood_stock ORDER BY blood_type');
    const rows = result.rows.map((r) => ({ ...r, status: statusFor(r.units_available) }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch blood stock' });
  }
});

// ---------- POST /api/stock (admin) - create new blood type entry ----------
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const { blood_type, units_available } = req.body;
  if (!blood_type || units_available == null) {
    return res.status(400).json({ error: 'blood_type and units_available are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO blood_stock (blood_type, units_available) VALUES ($1, $2)
       ON CONFLICT (blood_type) DO UPDATE SET units_available = $2, updated_at = NOW()
       RETURNING *`,
      [blood_type, units_available]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create/update stock entry' });
  }
});

// ---------- PUT /api/stock/:bloodType (admin) ----------
router.put('/:bloodType', authenticateToken, requireRole('admin'), async (req, res) => {
  const { bloodType } = req.params;
  const { units_available } = req.body;
  if (units_available == null || units_available < 0) {
    return res.status(400).json({ error: 'Valid units_available is required' });
  }
  try {
    const result = await pool.query(
      'UPDATE blood_stock SET units_available = $1, updated_at = NOW() WHERE blood_type = $2 RETURNING *',
      [units_available, bloodType]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Blood type not found' });
    res.json({ ...result.rows[0], status: statusFor(result.rows[0].units_available) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// ---------- DELETE /api/stock/:bloodType (admin) ----------
router.delete('/:bloodType', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM blood_stock WHERE blood_type = $1 RETURNING *', [req.params.bloodType]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Blood type not found' });
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete stock entry' });
  }
});

module.exports = router;
