/* ── STATE ── */
window._entries = [];
let pending = []; // pending chips

/* ── CHIPS ── */
function addChip() {
  const name  = document.getElementById('mat-name').value.trim();
  const count = parseInt(document.getElementById('mat-count').value) || 1;
  if (!name) { flash('mat-name'); return; }
  pending.push({ name, count });
  renderChips();
  document.getElementById('mat-name').value  = '';
  document.getElementById('mat-count').value = '';
  document.getElementById('mat-name').focus();
}

function removeChip(i) { pending.splice(i, 1); renderChips(); }

function renderChips() {
  document.getElementById('chips').innerHTML = pending.map((m, i) => `
    <div class="chip">
      ${m.name}
      <span class="chip-count">×${m.count}</span>
      <button class="chip-x" onclick="removeChip(${i})">✕</button>
    </div>`).join('');
}

/* ── SUBMIT ── */
async function submitEntry() {
  const url = document.getElementById('inp-url').value.trim();
  if (!url) { flash('inp-url'); return; }

  const entry = { url, materials: [...pending], thumb: ytThumb(url) };

  // Try Firebase first, fallback to localStorage
  if (window._addEntry) {
    try {
      await window._addEntry(entry);
      toast('Entry saved ✓', 'success');
    } catch (e) {
      console.error(e);
      toast('Firebase error — check config', 'error');
      return;
    }
  } else {
    // localStorage fallback (no Firebase)
    let local = JSON.parse(localStorage.getItem('gv_entries') || '[]');
    local.unshift({ ...entry, _id: Date.now().toString(), createdAt: Date.now() });
    localStorage.setItem('gv_entries', JSON.stringify(local));
    window._entries = local;
    renderList();
    toast('Saved locally ✓', 'success');
  }

  pending = [];
  renderChips();
  document.getElementById('inp-url').value = '';
  setTimeout(() => {
    document.querySelector('.stats').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 350);
}

/* ── DELETE ── */
async function deleteEntry(id) {
  if (window._deleteEntry) {
    try { await window._deleteEntry(id); toast('Entry removed', 'error'); }
    catch (e) { toast('Delete failed', 'error'); }
  } else {
    window._entries = window._entries.filter(e => e._id !== id);
    localStorage.setItem('gv_entries', JSON.stringify(window._entries));
    renderList();
    toast('Entry removed', 'error');
  }
}

/* ── RENDER ── */
window.renderList = function () {
  const wrap    = document.getElementById('list-container');
  const entries = window._entries || [];

  // update stats
  let mats = 0, items = 0;
  entries.forEach(e => {
    mats  += (e.materials || []).length;
    items += (e.materials || []).reduce((s, m) => s + m.count, 0);
  });
  document.getElementById('stat-entries').textContent = entries.length;
  document.getElementById('stat-mats').textContent    = mats;
  document.getElementById('stat-items').textContent   = items;

  if (!entries.length) {
    wrap.innerHTML = `<div class="empty"><span class="icon">🎮</span>No entries yet — add your first one above!</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="entry-table">
      <thead>
        <tr>
          <th>Thumb</th>
          <th>URL</th>
          <th>Materials</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(e => `
          <tr>
            <td>
              ${e.thumb
                ? `<img class="thumb" src="${e.thumb}" alt="" loading="lazy"/>`
                : `<div class="thumb-placeholder">🎮</div>`}
            </td>
            <td>
              <div class="entry-url">
                <a href="${e.url}" target="_blank" rel="noopener">${shortUrl(e.url)}</a>
              </div>
            </td>
            <td>
              <div class="mat-tags">
                ${(e.materials || []).length
                  ? e.materials.map(m => `<span class="mat-tag"><span class="n">×${m.count}</span>${m.name}</span>`).join('')
                  : '<span style="color:var(--muted)">—</span>'}
              </div>
            </td>
            <td>
              <button class="btn-del" onclick="deleteEntry('${e._id}')" title="Delete">🗑</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
};

/* ── HELPERS ── */
function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function shortUrl(u) {
  try { const x = new URL(u); return x.hostname; } catch { return u.slice(0, 30); }
}

function flash(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#dc2626';
  el.style.boxShadow   = '0 0 0 3px rgba(220,38,38,.12)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1400);
}

let toastTimer;
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = type ? `show ${type}` : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ── KEYBOARD & INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  ['mat-name', 'mat-count'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') addChip(); })
  );

  // Fallback to localStorage if Firebase not connected after 3s
  setTimeout(() => {
    const dot   = document.getElementById('db-dot');
    const label = document.getElementById('db-label');
    if (!window._db) {
      window._entries = JSON.parse(localStorage.getItem('gv_entries') || '[]');
      renderList();
      dot.className     = 'error';
      label.textContent = 'Local only';
    } else {
      dot.className     = 'live';
      label.textContent = 'Live';
    }
  }, 3000);
});

// Wrap renderList to also update DB status indicator
const _origRender = window.renderList;
window.renderList = function () {
  const dot   = document.getElementById('db-dot');
  const label = document.getElementById('db-label');
  if (window._db) { dot.className = 'live'; label.textContent = 'Live'; }
  _origRender();
};
