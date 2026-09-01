// ===== Blood Bank Shared JavaScript (connected to PostgreSQL backend via REST API) =====

// Same-origin API base (server.js serves both the API and these static files)
const API_BASE = '/api';

// ---------- Generic API helper ----------
async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('bloodBankToken');
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    token ? { Authorization: `Bearer ${token}` } : {},
    options.headers || {}
  );

  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

// ---------- Login handling ----------
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const role = document.querySelector('input[name="role"]:checked').value;

  const errorBox = document.getElementById('loginError');
  errorBox.classList.add('d-none');

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });

    sessionStorage.setItem('bloodBankToken', data.token);
    sessionStorage.setItem('bloodBankUser', data.user.username);
    sessionStorage.setItem('bloodBankRole', data.user.role);
    sessionStorage.setItem('bloodBankName', data.user.full_name);
    sessionStorage.setItem('bloodBankId', data.user.id);

    window.location.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('d-none');
  }
}

// ---------- Registration handling ----------
async function handleRegister(event) {
  event.preventDefault();

  const errorBox = document.getElementById('registerError');
  const successBox = document.getElementById('registerSuccess');
  errorBox.classList.add('d-none');

  const payload = {
    full_name: document.getElementById('regFullName').value.trim(),
    username: document.getElementById('regUsername').value.trim(),
    password: document.getElementById('regPassword').value,
    email: document.getElementById('regEmail').value.trim(),
    phone: document.getElementById('regPhone').value.trim(),
    blood_type: document.getElementById('regBloodType').value || null,
    city: document.getElementById('regCity').value.trim(),
  };

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    successBox.classList.remove('d-none');
    setTimeout(() => (window.location.href = 'login.html'), 1500);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('d-none');
  }
}

// ---------- Auth guard for protected pages ----------
function requireAuth(allowedRoles) {
  const role = sessionStorage.getItem('bloodBankRole');
  const token = sessionStorage.getItem('bloodBankToken');
  if (!role || !token) {
    window.location.href = 'login.html';
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
    return false;
  }
  return true;
}

// ---------- Display logged-in user ----------
function displayUser() {
  const name = sessionStorage.getItem('bloodBankName');
  const role = sessionStorage.getItem('bloodBankRole');
  const display = document.getElementById('userDisplay');
  if (display && name) {
    display.textContent = name + (role === 'admin' ? ' (Admin)' : '');
  }
}

// ---------- Logout ----------
function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ---------- Contact form ----------
async function handleContact(event) {
  event.preventDefault();
  const form = event.target;
  const inputs = form.querySelectorAll('input, textarea');
  const [fullName, email, subject, message] = inputs;

  const alertBox = document.getElementById('contactSuccess');
  const errorBox = document.getElementById('contactError');

  try {
    await apiFetch('/contact', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName.value.trim(),
        email: email.value.trim(),
        subject: subject.value.trim(),
        message: message.value.trim(),
      }),
    });
    if (errorBox) errorBox.classList.add('d-none');
    alertBox.classList.remove('d-none');
    form.reset();
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('d-none');
    } else {
      alert(err.message);
    }
  }
}

// ---------- Donate form ----------
async function handleDonate(event) {
  event.preventDefault();
  const form = event.target;

  const alertBox = document.getElementById('donateSuccess');
  const errorBox = document.getElementById('donateError');

  const payload = {
    full_name: document.getElementById('donorName').value.trim(),
    blood_type: document.getElementById('donorBloodType').value,
    email: document.getElementById('donorEmail').value.trim(),
    phone: document.getElementById('donorPhone').value.trim(),
    age: Number(document.getElementById('donorAge').value),
    preferred_date: document.getElementById('donorDate').value,
    address: document.getElementById('donorAddress').value.trim(),
    is_emergency: document.getElementById('donorEmergency') ? document.getElementById('donorEmergency').checked : false,
  };

  try {
    await apiFetch('/donations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (errorBox) errorBox.classList.add('d-none');
    alertBox.classList.remove('d-none');
    form.reset();
    setTimeout(() => alertBox.classList.add('d-none'), 4000);
    loadBloodStock(); // refresh stock table if present
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('d-none');
    } else {
      alert(err.message);
    }
  }
}

// ---------- Load live blood stock table (donate.html & index.html) ----------
async function loadBloodStock() {
  const tbody = document.getElementById('stockTableBody');
  if (!tbody) return;
  try {
    const stock = await apiFetch('/stock');
    const badge = (status) => {
      if (status === 'Critical') return '<span class="badge bg-danger">Critical</span>';
      if (status === 'Low') return '<span class="badge bg-warning text-dark">Low</span>';
      return '<span class="badge bg-success">Available</span>';
    };
    tbody.innerHTML = stock
      .map(
        (row) =>
          `<tr><td><strong>${row.blood_type}</strong></td><td>${row.units_available}</td><td>${badge(row.status)}</td></tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Failed to load stock: ${err.message}</td></tr>`;
  }
}

// Update footer year automatically + load stock table where present
document.addEventListener('DOMContentLoaded', function () {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
  loadBloodStock();
});
