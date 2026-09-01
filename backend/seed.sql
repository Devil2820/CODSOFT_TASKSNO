-- ============================================
-- Trial / Demo Data (Indian context)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Users ----------
-- Demo login -> User: username 'user'  / password 'user123'
--               Admin: username 'admin' / password 'admin123'
INSERT INTO users (username, password_hash, full_name, email, phone, blood_type, role, city) VALUES
('admin',    crypt('admin123', gen_salt('bf')), 'Admin',             'admin@bloodbank.in',        '+91 8010566255', NULL,  'admin', 'Pune'),
('user',     crypt('user123',  gen_salt('bf')), 'Rohan Deshmukh',    'rohan.deshmukh@example.in', '+91 9822011223', 'O+',  'user',  'Pune'),
('priya123', crypt('priya123', gen_salt('bf')), 'Priya Sharma',      'priya.sharma@example.in',   '+91 9876543210', 'A+',  'user',  'Mumbai'),
('amit123',  crypt('amit123',  gen_salt('bf')), 'Amit Verma',        'amit.verma@example.in',     '+91 9765432109', 'B+',  'user',  'Delhi'),
('sneha123', crypt('sneha123', gen_salt('bf')), 'Sneha Iyer',        'sneha.iyer@example.in',     '+91 9654321098', 'AB+', 'user',  'Chennai'),
('rahul123', crypt('rahul123', gen_salt('bf')), 'Rahul Kulkarni',    'rahul.kulkarni@example.in', '+91 9543210987', 'O-',  'user',  'Nagpur'),
('anita123', crypt('anita123', gen_salt('bf')), 'Anita Reddy',       'anita.reddy@example.in',    '+91 9432109876', 'B-',  'user',  'Hyderabad'),
('vikram123',crypt('vikram123',gen_salt('bf')), 'Vikram Singh',      'vikram.singh@example.in',   '+91 9321098765', 'A-',  'user',  'Jaipur'),
('kavita123',crypt('kavita123',gen_salt('bf')), 'Kavita Nair',       'kavita.nair@example.in',    '+91 9210987654', 'AB-', 'user',  'Kochi');

-- ---------- Blood stock ----------
INSERT INTO blood_stock (blood_type, units_available) VALUES
('A+', 42), ('A-', 18), ('B+', 35), ('B-', 8),
('AB+', 12), ('AB-', 5), ('O+', 60), ('O-', 9);

-- ---------- Donation requests (mix of statuses) ----------
INSERT INTO donation_requests (user_id, full_name, blood_type, email, phone, age, preferred_date, address, status, created_at) VALUES
((SELECT id FROM users WHERE username='user'),      'Rohan Deshmukh', 'O+',  'rohan.deshmukh@example.in', '+91 9822011223', 27, '2026-08-20', 'FC Road, Shivajinagar, Pune, MH 411005',      'Pending',   NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE username='priya123'),  'Priya Sharma',   'A+',  'priya.sharma@example.in',   '+91 9876543210', 24, '2026-08-18', 'Andheri West, Mumbai, MH 400058',              'Approved',  NOW() - INTERVAL '2 day'),
((SELECT id FROM users WHERE username='amit123'),   'Amit Verma',     'B+',  'amit.verma@example.in',     '+91 9765432109', 31, '2026-08-17', 'Connaught Place, New Delhi, DL 110001',        'Approved',  NOW() - INTERVAL '3 day'),
((SELECT id FROM users WHERE username='sneha123'),  'Sneha Iyer',     'AB+', 'sneha.iyer@example.in',     '+91 9654321098', 29, '2026-08-16', 'T Nagar, Chennai, TN 600017',                  'Rejected',  NOW() - INTERVAL '4 day'),
((SELECT id FROM users WHERE username='rahul123'),  'Rahul Kulkarni', 'O-',  'rahul.kulkarni@example.in', '+91 9543210987', 26, '2026-08-14', 'Dharampeth, Nagpur, MH 440010',                'Completed', NOW() - INTERVAL '10 day'),
((SELECT id FROM users WHERE username='anita123'),  'Anita Reddy',    'B-',  'anita.reddy@example.in',    '+91 9432109876', 33, '2026-08-13', 'Banjara Hills, Hyderabad, TS 500034',          'Completed', NOW() - INTERVAL '15 day'),
((SELECT id FROM users WHERE username='vikram123'), 'Vikram Singh',   'A-',  'vikram.singh@example.in',   '+91 9321098765', 28, '2026-08-22', 'C-Scheme, Jaipur, RJ 302001',                  'Pending',   NOW() - INTERVAL '12 hour'),
(NULL,                                               'Meena Pillai',   'O+',  'meena.pillai@example.in',   '+91 9111122223', 35, '2026-08-25', 'MG Road, Bengaluru, KA 560001',                'Pending',   NOW() - INTERVAL '6 hour'),
(NULL,                                               'Suresh Yadav',  'AB-',  'suresh.yadav@example.in',   '+91 9222233334', 40, '2026-08-19', 'Hazratganj, Lucknow, UP 226001',               'Approved',  NOW() - INTERVAL '5 day');

-- ---------- Donation history (completed donations for user dashboard + eligibility checks) ----------
-- Rohan's ('user') most recent donation is within the last 90 days on purpose, so the demo
-- account shows as "not yet eligible" -- a good way to try out the emergency-approval flow.
INSERT INTO donation_history (user_id, email, donation_date, blood_type, units, location, status) VALUES
((SELECT id FROM users WHERE username='user'), 'rohan.deshmukh@example.in', '2026-01-12', 'O+', 1, 'Pune City Blood Bank',    'Completed'),
((SELECT id FROM users WHERE username='user'), 'rohan.deshmukh@example.in', '2026-03-05', 'O+', 1, 'Sassoon General Hospital','Completed'),
((SELECT id FROM users WHERE username='user'), 'rohan.deshmukh@example.in', (CURRENT_DATE - INTERVAL '30 day'), 'O+', 1, 'Pune City Blood Bank', 'Completed'),
((SELECT id FROM users WHERE username='rahul123'), 'rahul.kulkarni@example.in', '2026-06-02', 'O-', 1, 'Nagpur Blood Bank',   'Completed'),
((SELECT id FROM users WHERE username='anita123'), 'anita.reddy@example.in', '2026-06-15', 'B-', 1, 'Hyderabad Red Cross',  'Completed');

-- ---------- Contact messages ----------
INSERT INTO contact_messages (full_name, email, subject, message, created_at) VALUES
('Sanjay Gupta',  'sanjay.gupta@example.in',  'Blood Donation Camp Inquiry', 'Hi, we would like to organize a blood donation camp at our office in Baner, Pune. Please share the requirements.', NOW() - INTERVAL '2 day'),
('Neha Joshi',    'neha.joshi@example.in',    'Urgent O- requirement',       'My relative needs 2 units of O- blood urgently at Ruby Hall Clinic. Please advise on availability.', NOW() - INTERVAL '1 day'),
('Farhan Sheikh',  'farhan.sheikh@example.in', 'Volunteer Opportunity',      'I would like to volunteer at your blood donation drives on weekends. How can I sign up?', NOW() - INTERVAL '6 hour');
