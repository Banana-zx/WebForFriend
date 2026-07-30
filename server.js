const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const storage = multer.memoryStorage();
const upload = multer({ storage });

const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'forum.sqlite');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    footWash TEXT,
    shoeCare TEXT,
    sockCare TEXT,
    spray TEXT,
    imageData TEXT,
    comments TEXT DEFAULT '[]'
  )`);
});

// ---------- posts ----------
app.get('/api/posts', (req, res) => {
  db.all('SELECT * FROM posts ORDER BY rowid DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const posts = rows.map(r => ({ ...r, comments: JSON.parse(r.comments || '[]') }));
    res.json(posts);
  });
});

app.post('/api/posts', (req, res) => {
  const { id, author, footWash, shoeCare, sockCare, spray, imageData, comments } = req.body;
  if (!id || !author) return res.status(400).json({ error: 'missing required fields' });
  db.run(
    `INSERT INTO posts (id, author, footWash, shoeCare, sockCare, spray, imageData, comments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, author, footWash || '', shoeCare || '', sockCare || '', spray || '', imageData || '', JSON.stringify(comments || [])],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, author, footWash, shoeCare, sockCare, spray, imageData, comments: comments || [] });
    }
  );
});

app.put('/api/posts/:id', (req, res) => {
  const { author, footWash, shoeCare, sockCare, spray, imageData } = req.body;
  db.run(
    `UPDATE posts SET author=?, footWash=?, shoeCare=?, sockCare=?, spray=?, imageData=? WHERE id=?`,
    [author, footWash || '', shoeCare || '', sockCare || '', spray || '', imageData || '', req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'not found' });
      db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ...row, comments: JSON.parse(row.comments || '[]') });
      });
    }
  );
});

app.delete('/api/posts/:id', (req, res) => {
  db.run('DELETE FROM posts WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ success: true });
  });
});

// ---------- comments ----------
app.post('/api/posts/:id/comments', (req, res) => {
  const { name, text, rating } = req.body;
  db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'post not found' });
    const comments = JSON.parse(row.comments || '[]');
    comments.push({ name: name || '', text: text || '', rating: Number(rating || 0) });
    db.run('UPDATE posts SET comments = ? WHERE id = ?', [JSON.stringify(comments), req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, comments });
    });
  });
});

// ---------- expose local IP + QR ----------
app.get('/qr', (req, res) => {
  const nets = require('os').networkInterfaces();
  let localIP = '127.0.0.1';
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  const url = `http://${localIP}:${PORT}`;
  qrcode.toDataURL(url, { width: 400, margin: 2 }, (err, dataUrl) => {
    if (err) return res.status(500).send('QR error');
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CMU Forum</title>
      <style>
        body{font-family:system-ui;background:#f6f7fa;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#fff;border-radius:16px;padding:24px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08)}
        img{width:280px;height:280px;border-radius:12px;margin:12px 0}
        h1{margin:0 0 6px;color:#1f2229} p{color:#6b7280;margin:4px 0} a{color:#2563eb;text-decoration:none;font-weight:600}
      </style></head><body>
      <div class="card">
        <h1>ติดตามผล CMU Forum</h1>
        <p>สแกน QR หรือเปิดลิงก์นี้บนมือถือ/อื่นเครื่อง</p>
        <img src="${dataUrl}" alt="QR" />
        <p><a href="${url}" target="_blank">${url}</a></p>
        <p style="font-size:13px;color:#6b7280">รหัส Editor: cmu</p>
      </div></body></html>`);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  let localIP = 'ไม่พบ IP';
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log(`Server running:`);
  console.log(`  Local : http://localhost:${PORT}`);
  console.log(`  LAN   : http://${localIP}:${PORT}`);
  console.log(`  QR    : http://localhost:${PORT}/qr`);
});
