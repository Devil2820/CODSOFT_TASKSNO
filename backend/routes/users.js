const express = require('express');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ---------- GET /api/users (admin - list all donors/users) ----------
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, email, phone, blood_type, role, city, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ---------- GET /api/users/me (any logged-in user - own profile) ----------
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, email, phone, blood_type, role, city, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ---------- PUT /api/users/:id (admin - edit a donor) ----------
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { full_name, email, phone, blood_type, city } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email),
       phone = COALESCE($3, phone), blood_type = COALESCE($4, blood_type), city = COALESCE($5, city)
       WHERE id = $6
       RETURNING id, username, full_name, email, phone, blood_type, role, city`,
      [full_name, email, phone, blood_type, city, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ---------- DELETE /api/users/:id (admin - remove a donor) ----------
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 AND role != 'admin' RETURNING id, username, full_name`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found or cannot delete admin' });
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
