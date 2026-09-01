// ===== API 基址 =====
const API_BASE = '';

// ===== 数据存储管理（后端API版） =====
const Storage = {
  KEY_CURRENT_USER: 'lab_current_user',

  async getUsers() {
    const res = await fetch(API_BASE + '/api/users');
    return (await res.json()).data || [];
  },

  getCurrentUser() {
    const data = localStorage.getItem(this.KEY_CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser(user) {
    localStorage.setItem(this.KEY_CURRENT_USER, JSON.stringify(user));
  },

  clearCurrentUser() {
    localStorage.removeItem(this.KEY_CURRENT_USER);
  },

  async getRooms() {
    const res = await fetch(API_BASE + '/api/rooms');
    return (await res.json()).data || [];
  },

  async getReservations() {
    const res = await fetch(API_BASE + '/api/reservations');
    return (await res.json()).data || [];
  },

  async getUserReservations(username) {
    const res = await fetch(API_BASE + '/api/reservations/user/' + encodeURIComponent(username));
    return (await res.json()).data || [];
  },

  async addReservation(reservation) {
    const res = await fetch(API_BASE + '/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation)
    });
    return (await res.json()).data;
  },

  async cancelReservation(id) {
    const res = await fetch(API_BASE + '/api/reservations/' + id + '/cancel', { method: 'PUT' });
    return (await res.json()).success;
  },

  async reviewReservation(id, status) {
    const res = await fetch(API_BASE + '/api/reservations/' + id + '/review', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status })
    });
    return (await res.json()).success;
  }
};

// ===== AI 推荐引擎 =====
const AIRecommender = {
  dateMap: { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' },
  intervalMap: { 1: '上午', 2: '下午' },

  async getLoad(date, interval, roomId, rooms, reservations) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return 0;
    const active = reservations.filter(r =>
      r.date == date && r.interval == interval && r.roomId == roomId &&
      (r.status === 'pending' || r.status === 'approved')
    );
    return active.length / room.capacity;
  },

  getHeatLevel(load) {
    if (load < 0.3) return { level: '空闲', class: 'free', icon: '🌿' };
    if (load < 0.7) return { level: '一般', class: 'normal', icon: '🌤️' };
    return { level: '拥挤', class: 'busy', icon: '🔥' };
  },

  async recommend(username) {
    const res = await fetch(API_BASE + '/api/ai/recommend/' + encodeURIComponent(username));
    return (await res.json()).data || [];
  },

  async getReport() {
    const res = await fetch(API_BASE + '/api/ai/report');
    return (await res.json()).data || {};
  }
};

// ===== 工具函数 =====
const Utils = {
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = '<span>' + (icons[type] || 'ℹ') + '</span><span>' + message + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  formatDate(dateNum) {
    const map = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };
    return map[dateNum] || '未知';
  },

  formatInterval(intervalNum) {
    return intervalNum == 1 ? '上午 (08:00-12:00)' : '下午 (14:00-18:00)';
  },

  formatStatus(status) {
    const map = {
      pending: { text: '审核中', class: 'pending', icon: '⏳' },
      approved: { text: '已通过', class: 'approved', icon: '✅' },
      rejected: { text: '已拒绝', class: 'rejected', icon: '❌' },
      cancelled: { text: '已取消', class: 'rejected', icon: '🚫' }
    };
    return map[status] || map.pending;
  },

  checkAuth() {
    const user = Storage.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  logout() {
    Storage.clearCurrentUser();
    window.location.href = 'login.html?logout=1';
  }
};

// ===== 认证相关 =====
const Auth = {
  async register(name, password, role) {
    const res = await fetch(API_BASE + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password: password, role: role })
    });
    return await res.json();
  },

  async login(username, password) {
    const res = await fetch(API_BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    const result = await res.json();
    if (result.success) {
      Storage.setCurrentUser(result.user);
    }
    return result;
  }
};
