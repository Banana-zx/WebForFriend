const API_BASE = '';

async function apiGet(url) {
  const r = await fetch(API_BASE + url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function apiPost(url, body) {
  const r = await fetch(API_BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await r.json();
  if (!r.ok) throw new Error(data && data.error ? data.error : 'HTTP ' + r.status);
  return data;
}
async function apiPut(url, body) {
  const r = await fetch(API_BASE + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const data = await r.json();
  if (!r.ok) throw new Error(data && data.error ? data.error : 'HTTP ' + r.status);
  return data;
}
async function apiDel(url) {
  const r = await fetch(API_BASE + url, { method: 'DELETE' });
  return r.json();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch));
}

const PANELS = ['viewerPanel','editorLogin','editorPanel','postForm','commentsPanel'];
function showOnly(id) {
  PANELS.forEach(x => {
    const el = document.getElementById(x);
    if (x === id) el.classList.remove('hidden'); else el.classList.add('hidden');
  });
  if (id === 'postForm' || id === 'commentsPanel') {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  }
}

let posts = [];
let isEditor = false;
let editingId = null;
let currentPostId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function avg(comments) {
  if (!comments.length) return 0;
  const sum = comments.reduce((s, c) => s + Number(c.rating || 0), 0);
  return sum / comments.length;
}
function avgLabel(post) {
  const a = post && post.comments ? avg(post.comments) : 0;
  return a ? a.toFixed(1) : '-';
}
function cardHtml(post, mode) {
  const commentCount = ((post && post.comments) ? post.comments : []).length;
  const isV = mode === 'viewer';
  const editButtons = !isV ? `
    <button type="button" data-action="edit" data-id="${post.id}">แก้ไข</button>
    <button type="button" data-action="delete" data-id="${post.id}">ลบ</button>
  ` : '';
  return `
    <article class="postCard" data-id="${post.id}">
      ${post.imageData ? `<img src="${escapeHtml(post.imageData)}" alt="รูปผู้ใช้งาน" loading="lazy" />` : '<div style="height:220px;background:#eef2ff;border-radius:12px"></div>'}
      <div class="postMeta">ผู้สร้างกระทู้: <strong>${escapeHtml(post.author || '')}</strong></div>
      <div class="postTitle">ติดตามผลโปรแกรม Clean & care with HerbAura Foot Spray</div>
      <div class="row"><span class="label">การดูแลเท้า ล้าง/วัน</span><span class="value">${escapeHtml(String(post.footWash ?? ''))}</span></div>
      <div class="row"><span class="label">ซักรองเท้า</span><span class="value">${escapeHtml(String(post.shoeCare ?? ''))}</span></div>
      <div class="row"><span class="label">การดูแลถุงเท้า</span><span class="value">${escapeHtml(String(post.sockCare ?? ''))}</span></div>
      <div class="row"><span class="label">สเปรย์กำจัดกลิ่น/สัปดาห์</span><span class="value">${escapeHtml(String(post.spray ?? ''))}</span></div>
      <div class="row"><span class="label">คะแนนเฉลี่ย</span><span class="value" data-avg="${post.comments ? avg(post.comments).toFixed(2) : 0}">${avgLabel(post)} / 10</span></div>
      <div class="actions">
        ${editButtons}
        <button type="button" data-action="comments" data-id="${post.id}">Comment (${commentCount})</button>
      </div>
    </article>
  `;
}
async function render() {
  try {
    posts = await apiGet('/api/posts');
  } catch (e) {
    posts = [];
  }
  if (isEditor) {
    showOnly('editorPanel');
    const container = document.getElementById('postsListEditable');
    container.innerHTML = posts.length ? posts.map(p => cardHtml(p, 'editor')).join('') : '<p class="avg">ยังไม่มีกระทู้</p>';
    bindPostActions();
  } else {
    showOnly('viewerPanel');
    const container = document.getElementById('postsList');
    container.innerHTML = posts.length ? posts.map(p => cardHtml(p, 'viewer')).join('') : '<p class="avg">ยังไม่มีกระทู้</p>';
    bindPostActions();
  }
}
function bindPostActions() {
  $$('button[data-action="edit"]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.id)));
  $$('button[data-action="delete"]').forEach(b => b.addEventListener('click', () => deletePost(b.dataset.id)));
  $$('button[data-action="comments"]').forEach(b => b.addEventListener('click', () => openComments(b.dataset.id)));
}

// ========== auth ==========
function setMode(mode) {
  isEditor = mode === 'editor';
  document.getElementById('btnViewer').classList.toggle('active', !isEditor);
  document.getElementById('btnEditor').classList.toggle('active', isEditor);
  render();
}
document.getElementById('btnLogin').addEventListener('click', () => {
  const pwd = document.getElementById('editorPassword').value;
  if (pwd === 'cmu') { setMode('editor'); return; }
  const msg = document.getElementById('loginMsg');
  msg.textContent = 'รหัสผ่านไม่ถูกต้อง';
  document.getElementById('editorPassword').classList.add('input-error');
});
document.getElementById('btnViewer').addEventListener('click', () => setMode('viewer'));
document.getElementById('btnEditor').addEventListener('click', () => {
  if (isEditor) { setMode('editor'); return; }
  showOnly('editorLogin');
  document.getElementById('loginMsg').textContent = '';
  document.getElementById('editorPassword').value = '';
});

// ========== read file/dataurl ==========
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('ไฟล์ไม่ถูกต้อง'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

// ========== CRUD ==========
document.getElementById('btnNewPost').addEventListener('click', () => openForm());
document.getElementById('btnCancelPost').addEventListener('click', () => resetForm());
document.getElementById('btnLogout').addEventListener('click', () => { setMode('viewer'); });

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'เพิ่มสมาชิก / สร้างกระทู้ใหม่';
  ['pAuthor','pFootWash','pImageUrl','pSpray'].forEach(i => { const el = document.getElementById(i); if(el) el.value=''; });
  document.getElementById('pImageFile').value = '';
  ['pShoeCare','pSockCare'].forEach(i => { const el = document.getElementById(i); if(el) el.value=''; });
  render();
}
function openForm(id) {
  editingId = id || null;
  document.getElementById('formTitle').textContent = id ? 'แก้ไขกระทู้' : 'เพิ่มสมาชิก / สร้างกระทู้ใหม่';
  const setv = (k,v) => { const el = document.getElementById(k); if(el) el.value=v; };
  if (id) {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    setv('pAuthor', p.author || '');
    setv('pFootWash', p.footWash ?? '');
    setv('pShoeCare', p.shoeCare || '');
    setv('pSockCare', p.sockCare || '');
    setv('pSpray', p.spray ?? '');
    setv('pImageUrl', (p.imageData && !p.imageData.startsWith('data:')) ? p.imageData : '');
    document.getElementById('pImageFile').value = '';
  } else {
    setv('pAuthor','');
    setv('pFootWash','');
    setv('pImageUrl','');
    setv('pSpray','');
    document.getElementById('pImageFile').value = '';
    setv('pShoeCare','');
    setv('pSockCare','');
  }
  showOnly('postForm');
}
document.getElementById('btnSavePost').addEventListener('click', async () => {
  const author = (document.getElementById('pAuthor').value || '').trim();
  const footWash = document.getElementById('pFootWash').value.trim();
  const shoeCare = document.getElementById('pShoeCare').value;
  const sockCare = document.getElementById('pSockCare').value;
  const spray = document.getElementById('pSpray').value.trim();
  const fileInput = document.getElementById('pImageFile');
  const imageUrl = (document.getElementById('pImageUrl').value || '').trim();
  let imageData = '';
  const current = posts.find(p => p.id === editingId);
  if (current && current.imageData) imageData = current.imageData;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      imageData = await readFileAsDataURL(fileInput.files[0]);
      if (!imageData || !imageData.startsWith('data:')) {
        throw new Error('รูปภาพไม่ถูกต้อง');
      }
    } catch (e) {
      alert('อ่านไฟล์รูปภาพไม่สำเร็จ: ' + (e && e.message ? e.message : 'unknown'));
      return;
    }
  } else if (imageUrl) { imageData = imageUrl; }
  if (!author) { alert('กรุณากรอกชื่อผู้ใช้งาน'); return; }
  if (editingId) {
    await apiPut('/api/posts/' + editingId, { author, footWash, shoeCare, sockCare, spray, imageData });
  } else {
    const id = 'p_' + Date.now();
    await apiPost('/api/posts', { id, author, footWash, shoeCare, sockCare, spray, imageData });
  }
  resetForm();
});
async function deletePost(id) {
  if (!confirm('ลบกระทู้นี้?')) return;
  await apiDel('/api/posts/' + id);
  render();
}

// ========== comments ==========
async function renderComments(post) {
  const area = document.getElementById('commentsArea');
  area.innerHTML = '';
  const list = post.comments || [];
  if (!list.length) { area.innerHTML = '<p class="avg">ยังไม่มีความคิดเห็น</p>'; }
  list.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'commentBlock';
    div.innerHTML = `<div class="commentHeader"><span>${escapeHtml(c.name || 'ผู้ใช้งานไม่ระบุชื่อ')}</span><span>คะแนน: ${Number(c.rating || 0).toFixed(1)}</span></div><div class="commentText">${escapeHtml(c.text)}</div>`;
    area.appendChild(div);
  });
  const avgEl = document.createElement('div');
  avgEl.className = 'avg';
  avgEl.innerHTML = `คะแนนเฉลี่ยของกระทู้นี้: <strong>${avgLabel(post)}</strong> / 10`;
  area.appendChild(avgEl);
}
async function openComments(id) {
  currentPostId = id;
  const post = posts.find(p => p.id === id);
  if (!post) return;
  await renderComments(post);
  showOnly('commentsPanel');
  setTimeout(() => document.getElementById('commentsPanel')?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
}
document.getElementById('btnAddComment').addEventListener('click', async () => {
  const text = (document.getElementById('commentText').value || '').trim();
  const name = (document.getElementById('commentName').value || '').trim();
  const rating = Number(document.getElementById('commentRating').value);
  if (!text) { alert('กรุณากรอกความคิดเห็น'); return; }
  await apiPost('/api/posts/' + currentPostId + '/comments', { name, text, rating });
  document.getElementById('commentText').value = '';
  const post = posts.find(p => p.id === currentPostId);
  if (post) await renderComments(post);
  render();
});
document.getElementById('commentRating').addEventListener('input', e => document.getElementById('ratingValue').textContent = e.target.value);
document.getElementById('btnCloseComments').addEventListener('click', () => { setMode(isEditor ? 'editor' : 'viewer'); });

render();
