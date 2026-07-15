/// <reference types="vite/client" />

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data.code && data.message) ? `[${data.code}] ${data.message}` : (data.error || '请求失败');
    throw new Error(msg);
  }
  return data;
}

export const auth = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  changePassword: (oldPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
};

export const plans = {
  list: () => request('/plans'),
  create: (data) => request('/plans', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/plans/${id}`, { method: 'DELETE' }),
  calendar: (id) => request(`/plans/${id}/calendar`),
  stats: (id) => request(`/plans/${id}/stats`),
};

export const tasks = {
  list: (planId, date) => request(`/tasks/${planId}/${date}`),
  create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggle: (id) => request(`/tasks/${id}/toggle`, { method: 'PATCH' }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  upload: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/tasks/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    return data;
  },
  batch: (data) => request('/tasks/batch', { method: 'POST', body: JSON.stringify(data) }),
  batchSimple: (data) => request('/tasks/batch-simple', { method: 'POST', body: JSON.stringify(data) }),
  copy: (data) => request('/tasks/copy', { method: 'POST', body: JSON.stringify(data) }),
};

export const backup = {
  exportData: async () => {
    const token = getToken();
    const res = await fetch(`${BASE}/backup/export`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zhixue-backup-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
  restore: (dataJson) => request('/backup/restore', { method: 'POST', body: JSON.stringify({ dataJson }) }),
};
