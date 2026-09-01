const express = require('express');
const pool = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Standard minimum gap between whole-blood donations (NACO/WHO guidance commonly cited: ~90 days)
const ELIGIBILITY_DAYS = 90;

// ---------- Eligibility helpers ----------
async function getLastDonationDate(userId, email) {
  let query, params;
  if (userId) {
    query = 'SELECT MAX(donation_date) AS last_date FROM donation_history WHERE user_id = $1';
    params = [userId];
  } else {
    query = 'SELECT MAX(donation_date) AS last_date FROM donation_history WHERE email = $1';
    params = [email];
  }
  const result = await pool.query(query, params);
  return result.rows[0].last_date; // null if no prior donations
}

function computeEligibility(lastDate) {
  if (!lastDate) {
    return { eligible: true, last_donation_date: null, next_eligible_date: null, days_remaining: 0 };
  }
  const last = new Date(lastDate);
  const next = new Date(last);
  next.setDate(next.getDate() + ELIGIBILITY_DAYS);
  const now = new Date();
  const eligible = now >= next;
  const daysRemaining = eligible ? 0 : Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  return {
    eligible,
    last_donation_date: last.toISOString().split('T')[0],
    next_eligible_date: next.toISOString().split('T')[0],
    days_remaining: daysRemaining,
  };
}

function getUserIdFromAuthHeader(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.id;
  } catch (e) {
    return null;
  }
}

// ---------- GET /api/donations/eligibility (logged-in user checks their own status) ----------
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const lastDate = await getLastDonationDate(req.user.id, null);
    res.json(computeEligibility(lastDate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

// ---------- POST /api/donations (public - donate.html form) ----------
router.post('/', async (req, res) => {
  const { full_name, blood_type, email, phone, age, preferred_date, address, is_emergency } = req.body;

  if (!full_name || !blood_type || !email || !phone || !age || !preferred_date || !address) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (age < 18 || age > 65) {
    return res.status(400).json({ error: 'Age must be between 18 and 65' });
  }

  const userId = getUserIdFromAuthHeader(req);

  try {
    const lastDate = await getLastDonationDate(userId, email);
    const eligibility = computeEligibility(lastDate);

    if (!eligibility.eligible && !is_emergency) {
      return res.status(403).json({
        error: `You're not eligible to donate again until ${eligibility.next_eligible_date} (${eligibility.days_remaining} day(s) left, standard ${ELIGIBILITY_DAYS}-day gap between donations). If this is urgent, check "This is an emergency" to submit for admin review.`,
        next_eligible_date: eligibility.next_eligible_date,
      });
    }

    const flaggedEmergency = !eligibility.eligible && !!is_emergency;

    const result = await pool.query(
      `INSERT INTO donation_requests (user_id, full_name, blood_type, email, phone, age, preferred_date, address, is_emergency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, full_name, blood_type, email, phone, age, preferred_date, address, flaggedEmergency]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit donation request' });
  }
});

// ---------- GET /api/donations (admin - all requests) ----------
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donation_requests ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch donation requests' });
  }
});

// ---------- GET /api/donations/mine (logged-in user - own history) ----------
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const requests = await pool.query(
      'SELECT * FROM donation_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const history = await pool.query(
      'SELECT * FROM donation_history WHERE user_id = $1 ORDER BY donation_date DESC',
      [req.user.id]
    );
    res.json({ requests: requests.rows, history: history.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your donation history' });
  }
});

// ---------- PUT /api/donations/:id/emergency-approve (admin - override the cooldown) ----------
router.put('/:id/emergency-approve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE donation_requests SET emergency_approved = true WHERE id = $1 AND is_emergency = true RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Emergency request not found (or this request was not flagged as an emergency)' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve emergency request' });
  }
});

// ---------- PUT /api/donations/:id (admin - update status / units) ----------
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { status, units } = req.body;
  const allowed = ['Pending', 'Approved', 'Rejected', 'Completed'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  }
  if (units != null && (!Number.isInteger(units) || units <= 0)) {
    return res.status(400).json({ error: 'units must be a positive whole number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM donation_requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Donation request not found' });
    }
    const current = existing.rows[0];

    // Emergency requests must be explicitly approved by an admin before they can move to
    // Approved or Completed -- this is the whole point of the emergency override.
    if ((status === 'Approved' || status === 'Completed') && current.is_emergency && !current.emergency_approved) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'This is an emergency request bypassing the standard donation gap. Approve the emergency first (PUT /api/donations/:id/emergency-approve) before changing its status.',
      });
    }

    const finalUnits = units != null ? units : current.units;
    const finalStatus = status || current.status;

    const updated = await client.query(
      'UPDATE donation_requests SET status = $1, units = $2 WHERE id = $3 RETURNING *',
      [finalStatus, finalUnits, req.params.id]
    );
    const donation = updated.rows[0];

    // When marked Completed, log to donation_history and bump blood stock -- both driven by
    // the actual units collected, not always assumed to be 1.
    if (finalStatus === 'Completed' && current.status !== 'Completed') {
      await client.query(
        `INSERT INTO donation_history (user_id, email, donation_date, blood_type, units, location, status)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, 'Blood Bank Center', 'Completed')`,
        [donation.user_id, donation.email, donation.blood_type, donation.units]
      );
      await client.query(
        `INSERT INTO blood_stock (blood_type, units_available) VALUES ($1, $2)
         ON CONFLICT (blood_type) DO UPDATE SET units_available = blood_stock.units_available + $2, updated_at = NOW()`,
        [donation.blood_type, donation.units]
      );
    }

    await client.query('COMMIT');
    res.json(donation);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update donation request' });
  } finally {
    client.release();
  }
});

// ---------- DELETE /api/donations/:id (admin) ----------
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM donation_requests WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Donation request not found' });
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete donation request' });
  }
});

module.exports = router;
