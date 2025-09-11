const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${msg}`);
  }
  // csv endpoint devuelve texto; los demás JSON
  const isCsv = path.endsWith('.csv');
  return isCsv ? res.text() : res.json();
}

export const api = {
  login: (email, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) =>
    request('/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  timeseries: ({ cities, from, to }) =>
    request(`/timeseries?cities=${cities.join(',')}&from=${from}&to=${to}`),
  stats: ({ city, from, to }) =>
    request(`/stats?city=${city}&from=${from}&to=${to}`),
  exportCsv: ({ from, to }) =>
    request(`/export.csv?from=${from}&to=${to}`),
};
