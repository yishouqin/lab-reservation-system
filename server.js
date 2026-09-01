const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RES_FILE = path.join(DATA_DIR, 'reservations.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ROOMS_FILE)) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify([
      { id: 1, name: '计算机机房一', capacity: 60, location: '教学楼A栋301', equipment: '高性能PCx60', description: '配备最新一代处理器' },
      { id: 2, name: '计算机机房二', capacity: 50, location: '教学楼A栋302', equipment: '图形工作站x50', description: '专业图形显卡' },
      { id: 3, name: '计算机机房三', capacity: 40, location: '教学楼B栋201', equipment: '服务器集群', description: '云计算实验环境' }
    ], null, 2));
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { username: '易守琴', password: '20041102', role: 'student', createdAt: Date.now() },
      { username: 'admin', password: '123456', role: 'admin', createdAt: Date.now() },
      { username: '张三', password: '123456', role: 'student', createdAt: Date.now() }
    ], null, 2));
  }
  if (!fs.existsSync(RES_FILE)) fs.writeFileSync(RES_FILE, '[]');
}
initData();

function rj(f) { return JSON.parse(fs.readFileSync(f, 'utf-8')); }
function wj(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)); }

// 注册
app.post('/api/register', (req, res) => {
  const { username, password, role } = req.body;
  const users = rj(USERS_FILE);
  if (users.find(u => u.username === username)) return res.json({ success: false, message: '该用户名已被注册' });
  const validRoles = ['student', 'teacher', 'admin'];
  const finalRole = validRoles.includes(role) ? role : 'student';
  users.push({ username, password, role: finalRole, createdAt: Date.now() });
  wj(USERS_FILE, users);
  res.json({ success: true, message: '注册成功' });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const users = rj(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ success: false, message: '用户不存在' });
  if (user.password !== password) return res.json({ success: false, message: '密码错误' });
  if (role && user.role !== role) return res.json({ success: false, message: '该账号不是' + (role === 'student' ? '学生' : role === 'teacher' ? '教师' : '管理员') + '身份' });
  res.json({ success: true, message: '登录成功', user: { username: user.username, role: user.role } });
});

// 机房列表
app.get('/api/rooms', (req, res) => {
  res.json({ success: true, data: rj(ROOMS_FILE) });
});

// 所有预约
app.get('/api/reservations', (req, res) => {
  res.json({ success: true, data: rj(RES_FILE) });
});

// 某人的预约
app.get('/api/reservations/user/:name', (req, res) => {
  const list = rj(RES_FILE).filter(r => r.stuName === req.params.name);
  res.json({ success: true, data: list });
});

// 添加预约
app.post('/api/reservations', (req, res) => {
  const list = rj(RES_FILE);
  const item = { id: Date.now(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
  list.push(item);
  wj(RES_FILE, list);
  res.json({ success: true, data: item });
});

// 取消预约
app.put('/api/reservations/:id/cancel', (req, res) => {
  const list = rj(RES_FILE);
  const i = list.findIndex(r => r.id == req.params.id);
  if (i === -1) return res.json({ success: false, message: '预约不存在' });
  list[i].status = 'cancelled';
  wj(RES_FILE, list);
  res.json({ success: true, message: '取消成功' });
});

// 审核预约
app.put('/api/reservations/:id/review', (req, res) => {
  const list = rj(RES_FILE);
  const i = list.findIndex(r => r.id == req.params.id);
  if (i === -1) return res.json({ success: false, message: '预约不存在' });
  list[i].status = req.body.status;
  wj(RES_FILE, list);
  res.json({ success: true, message: '审核完成' });
});

// AI推荐
app.get('/api/ai/recommend/:name', (req, res) => {
  const rooms = rj(ROOMS_FILE);
  const all = rj(RES_FILE);
  const mine = all.filter(r => r.stuName === req.params.name);
  const items = [];
  function load(d, t, rid) {
    const room = rooms.find(r => r.id === rid);
    if (!room) return 0;
    return all.filter(r => r.date == d && r.interval == t && r.roomId == rid && (r.status === 'pending' || r.status === 'approved')).length / room.capacity;
  }
  function sr(d, t, rid) {
    const rel = all.filter(r => r.date == d && r.interval == t && r.roomId == rid);
    if (rel.length === 0) return 0.75;
    return rel.filter(r => r.status === 'approved').length / rel.length;
  }
  for (let d = 1; d <= 5; d++) for (let t = 1; t <= 2; t++) for (const room of rooms) {
    const l = load(d, t, room.id);
    const s = sr(d, t, room.id);
    const conflict = mine.some(r => r.date == d && r.interval == t && (r.status === 'pending' || r.status === 'approved'));
    const score = 0.5 * s + 0.3 * (1 - l) + 0.2 * (1 - (conflict ? 1 : 0));
    items.push({ date: d, interval: t, roomId: room.id, roomName: room.name, score, successRate: s, currentLoad: l, hasConflict: conflict });
  }
  items.sort((a, b) => b.score - a.score);
  res.json({ success: true, data: items.slice(0, 3) });
});

// AI分析报告
app.get('/api/ai/report', (req, res) => {
  const all = rj(RES_FILE);
  const rooms = rj(ROOMS_FILE);
  const total = all.length;
  const pending = all.filter(r => r.status === 'pending').length;
  const approved = all.filter(r => r.status === 'approved').length;
  const rejected = all.filter(r => r.status === 'rejected').length;
  const cancelled = all.filter(r => r.status === 'cancelled').length;
  const roomHeat = rooms.map(room => {
    const count = all.filter(r => r.roomId == room.id).length;
    let tl = 0, cnt = 0;
    for (let d = 1; d <= 5; d++) for (let t = 1; t <= 2; t++) {
      tl += all.filter(r => r.date == d && r.interval == t && r.roomId == room.id && (r.status === 'pending' || r.status === 'approved')).length / room.capacity;
      cnt++;
    }
    return { roomId: room.id, count, avgLoad: tl / cnt };
  }).sort((a, b) => b.count - a.count);
  const dayCount = {};
  for (let d = 1; d <= 5; d++) dayCount[d] = all.filter(r => r.date == d).length;
  const slots = [];
  for (let d = 1; d <= 5; d++) for (let t = 1; t <= 2; t++) for (const room of rooms) {
    const active = all.filter(r => r.date == d && r.interval == t && r.roomId == room.id && (r.status === 'pending' || r.status === 'approved')).length;
    slots.push({ date: d, interval: t, roomId: room.id, load: active / room.capacity });
  }
  slots.sort((a, b) => a.load - b.load);
  const ss = {};
  for (const r of all) {
    if (!ss[r.stuName]) ss[r.stuName] = { cancel: 0, total: 0 };
    ss[r.stuName].total++;
    if (r.status === 'cancelled') ss[r.stuName].cancel++;
  }
  const anomalies = [];
  for (const n in ss) {
    const s = ss[n];
    if (s.total >= 3 && s.cancel / s.total > 0.3) anomalies.push({ type: '高取消率', name: n, rate: Math.round(s.cancel / s.total * 100), detail: s.cancel + '/' + s.total });
  }
  res.json({ success: true, data: { total, pending, approved, rejected, cancelled, passRate: total > 0 ? Math.round(approved / total * 100) : 0, roomHeat, dayCount, topFree: slots.slice(0, 5), topBusy: slots.slice(-3).reverse().filter(s => s.load > 0.05), anomalies } });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('  AI 机房预约系统 - 多人共享版');
  console.log('========================================');
  console.log('  本地: http://localhost:' + PORT);
  console.log('  登录: http://localhost:' + PORT + '/login.html');
  console.log('========================================');
});
