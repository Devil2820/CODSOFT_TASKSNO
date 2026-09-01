const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const router = express.Router();

// ---------- POST /api/auth/register ----------
router.post('/register', async (req, res) => {
  const { username, password, full_name, email, phone, blood_type, city } = req.body;

  if (!username || !password || !full_name || !email) {
    return res.status(400).json({ error: 'username, password, full_name and email are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, blood_type, role, city)
       VALUES ($1, $2, $3, $4, $5, $6, 'user', $7)
       RETURNING id, username, full_name, email, phone, blood_type, role, city`,
      [username, hash, full_name, email, phone || null, blood_type || null, city || null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const account = result.rows[0];
    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (role && account.role !== role) {
      return res.status(401).json({ error: 'Role mismatch. Please select the correct login type.' });
    }

    const token = jwt.sign(
      { id: account.id, username: account.username, role: account.role, full_name: account.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: account.id,
        username: account.username,
        full_name: account.full_name,
        email: account.email,
        phone: account.phone,
        blood_type: account.blood_type,
        role: account.role,
        city: account.city,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
