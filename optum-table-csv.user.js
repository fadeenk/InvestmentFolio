// ==UserScript==
// @name         Optum Table to CSV picker
// @namespace    https://github.com/fadee zde
// @version      1.0.0
// @description  Alt+T arms table pick-mode on account.optumbank.com. Hover previews exact rows in scope, click downloads CSV.
// @match        https://account.optumbank.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const store = {
    get(k, d) {
      try {
        const v = typeof GM_getValue !== 'undefined' ? GM_getValue(k, d) : d;
        return v === undefined ? d : v;
      } catch {
        try {
          const raw = localStorage.getItem('otc_' + k);
          return raw === null ? d : JSON.parse(raw);
        } catch { return d; }
      }
    },
    set(k, v) {
      try {
        if (typeof GM_setValue !== 'undefined') return GM_setValue(k, v);
      } catch { /* fall through */ }
      try { localStorage.setItem('otc_' + k, JSON.stringify(v)); } catch { /* ignore */ }
    }
  };

  const settings = {
    scope: store.get('scope', 'entire'), // 'entire' | 'first' | 'last'
    n: Math.max(1, parseInt(store.get('n', 10), 10) || 10),
    prefix: store.get('prefix', 'optum-mutual_funds_transactions'),
    showBadge: store.get('showBadge', true),
    shortcut: store.get('shortcut', 'Alt+T'),
    btnPos: store.get('btnPos', null),
  };
  const save = () => {
    store.set('scope', settings.scope);
    store.set('n', settings.n);
    store.set('prefix', settings.prefix);
    store.set('showBadge', settings.showBadge);
    store.set('shortcut', settings.shortcut);
    store.set('btnPos', settings.btnPos);
  };

  let armed = false;
  let hoveredTable = null;
  let tintedRows = [];
  let fileCounter = 0;

  // ---------- tiny UI ----------
  const z = 2147483647;
  const btn = document.createElement('button');
  btn.textContent = '⬇ CSV';
  btn.title = `Table CSV picker (${settings.shortcut}) — click to arm, ⚙ for settings. Drag to move.`;
  Object.assign(btn.style, {
    position: 'fixed', zIndex: String(z), cursor: 'grab',
    bottom: '24px', right: '24px', padding: '8px 12px',
    fontSize: '13px', fontWeight: '600', fontFamily: 'system-ui,sans-serif',
    background: '#111827', color: '#fff', border: '1px solid #374151',
    borderRadius: '999px', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
    opacity: '.92',
  });
  if (settings.btnPos) {
    btn.style.bottom = 'auto';
    btn.style.top = settings.btnPos.top + 'px';
    btn.style.left = settings.btnPos.left + 'px';
    btn.style.right = 'auto';
  }
  document.documentElement.appendChild(btn);

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', zIndex: String(z), display: 'none',
    bottom: '70px', right: '24px', width: '260px', padding: '12px',
    background: '#fff', color: '#111', border: '1px solid #d1d5db',
    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.25)',
    fontFamily: 'system-ui,sans-serif', fontSize: '13px',
  });
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">Table CSV settings</div>
    <label>Scope<br><select id="otc-scope" style="width:100%;margin:4px 0 8px">
      <option value="entire">Entire table</option>
      <option value="first">First N rows</option>
      <option value="last">Last N rows</option>
    </select></label>
    <label>N rows<br><input id="otc-n" type="number" min="1" max="100000" style="width:100%;margin:4px 0 8px"></label>
    <label>Filename prefix<br><input id="otc-prefix" type="text" style="width:100%;margin:4px 0 8px"></label>
    <label style="display:block;margin-bottom:8px"><input id="otc-badge" type="checkbox"> hover badge</label>
    <label>Shortcut<br><input id="otc-short" type="text" readonly style="width:100%;margin:4px 0 8px" title="Click then press keys"></label>
    <div style="color:#6b7280;font-size:12px">Armed: <b id="otc-armed">off</b> — ${'Esc'} cancels, click table downloads.</div>
  `;
  document.documentElement.appendChild(panel);

  const scopeSel = panel.querySelector('#otc-scope');
  const nInput = panel.querySelector('#otc-n');
  const prefixInput = panel.querySelector('#otc-prefix');
  const badgeChk = panel.querySelector('#otc-badge');
  const shortInput = panel.querySelector('#otc-short');
  const armedLabel = panel.querySelector('#otc-armed');
  const syncPanel = () => {
    scopeSel.value = settings.scope;
    nInput.value = String(settings.n);
    prefixInput.value = settings.prefix;
    badgeChk.checked = settings.showBadge;
    shortInput.value = settings.shortcut;
    armedLabel.textContent = armed ? 'ON' : 'off';
    btn.style.background = armed ? '#047857' : '#111827';
    btn.title = `Table CSV picker (${settings.shortcut}) — ${armed ? 'ARMED, click a table' : 'click to arm'}. Shift-click for settings. Drag to move.`;
  };
  scopeSel.onchange = () => { settings.scope = scopeSel.value; save(); refreshHover(); };
  nInput.onchange = () => { settings.n = Math.max(1, parseInt(nInput.value, 10) || 10); save(); refreshHover(); };
  prefixInput.onchange = () => { settings.prefix = prefixInput.value.trim() || 'optum-table'; save(); };
  badgeChk.onchange = () => { settings.showBadge = badgeChk.checked; save(); badge.style.display = 'none'; refreshHover(); };
  shortInput.onclick = () => { shortInput.value = 'press keys…'; };
  syncPanel();

  // drag button; shift-click or right-click opens settings (plain click toggles arm)
  let dragDx = 0, dragDy = 0, dragging = false, moved = false;
  btn.addEventListener('mousedown', (e) => {
    dragging = true; moved = false;
    dragDx = e.clientX - btn.getBoundingClientRect().left;
    dragDy = e.clientY - btn.getBoundingClientRect().top;
    btn.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) moved = true;
    btn.style.left = (e.clientX - dragDx) + 'px';
    btn.style.top = (e.clientY - dragDy) + 'px';
    btn.style.right = 'auto'; btn.style.bottom = 'auto';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; btn.style.cursor = 'grab';
    if (moved) {
      const r = btn.getBoundingClientRect();
      settings.btnPos = { left: Math.round(r.left), top: Math.round(r.top) };
      save();
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = Math.min(window.innerWidth - 280, r.left) + 'px';
      panel.style.top = Math.max(8, r.top - panel.offsetHeight - 12 || r.top - 300) + 'px';
    }
  });
  btn.addEventListener('click', (e) => {
    if (moved) { moved = false; return; }
    if (e.shiftKey || e.button === 2) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      syncPanel();
    } else if (panel.style.display === 'block' && !armed) {
      panel.style.display = 'none';
      setArmed(true);
    } else {
      setArmed(!armed);
    }
  });
  btn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    syncPanel();
  });

  // ---------- hover badge / toast ----------
  const badge = document.createElement('div');
  Object.assign(badge.style, {
    position: 'fixed', zIndex: String(z), display: 'none', pointerEvents: 'none',
    background: '#111827', color: '#fff', fontSize: '12px', fontFamily: 'system-ui,sans-serif',
    padding: '4px 8px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,.3)',
  });
  document.documentElement.appendChild(badge);

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', zIndex: String(z), left: '50%', bottom: '32px',
      transform: 'translateX(-50%)', background: '#111827', color: '#fff',
      padding: '10px 16px', borderRadius: '10px', fontSize: '13px',
      fontFamily: 'system-ui,sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,.35)',
    });
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // ---------- table logic ----------
  function ownRows(table) {
    return Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
  }
  function cellsOf(row) {
    return Array.from(row.children).filter((el) => /^(TD|TH)$/i.test(el.tagName));
  }
  function inScopeRows(table) {
    const rows = ownRows(table);
    if (settings.scope === 'first') return rows.slice(0, settings.n);
    if (settings.scope === 'last') return rows.slice(-settings.n);
    return rows;
  }
  function scopeLabel(total, picked) {
    if (settings.scope === 'first') return `will download first ${picked} of ${total}`;
    if (settings.scope === 'last') return `will download last ${picked} of ${total}`;
    return `will download all ${total}`;
  }

  function clearTint() {
    for (const r of tintedRows) { r.style.background = ''; r.style.opacity = ''; }
    tintedRows = [];
    if (hoveredTable) hoveredTable.style.outline = '';
    hoveredTable = null;
    badge.style.display = 'none';
  }
  function refreshHover() {
    if (!armed || !hoveredTable || !hoveredTable.isConnected) return;
    paintTable(hoveredTable);
  }
  function paintTable(table) {
    clearTint();
    hoveredTable = table;
    const all = ownRows(table);
    const picked = inScopeRows(table);
    const pickedSet = new Set(picked);
    table.style.outline = '3px solid #2563eb';
    table.style.outlineOffset = '2px';
    for (const r of all) {
      if (pickedSet.has(r)) {
        r.style.background = 'rgba(37,99,235,.14)';
        tintedRows.push(r);
      } else {
        r.style.opacity = '.45';
        tintedRows.push(r);
      }
    }
    if (settings.showBadge) {
      const cols = Math.max(0, ...all.map((r) => cellsOf(r).length));
      badge.textContent = `${all.length} rows × ${cols} cols → ${scopeLabel(all.length, picked.length)} — click to save`;
      badge.style.display = 'block';
    }
  }

  document.addEventListener('mousemove', (e) => {
    if (!armed || !settings.showBadge) return;
    if (badge.style.display === 'block') {
      badge.style.left = (e.clientX + 14) + 'px';
      badge.style.top = (e.clientY + 14) + 'px';
    }
  }, true);

  document.addEventListener('mouseover', (e) => {
    if (!armed) return;
    const t = e.target instanceof Element ? e.target.closest('table') : null;
    if (!t) { clearTint(); return; }
    if (t === hoveredTable) return;
    paintTable(t);
  }, true);

  document.addEventListener('click', (e) => {
    if (!armed) return;
    const t = e.target instanceof Element ? e.target.closest('table') : null;
    if (!t || t.closest('#otc-scope')) return;
    // ignore clicks on our own UI
    if (btn.contains(e.target) || panel.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    downloadTable(t);
  }, true);

  function cellText(el) {
    // direct text only: strip nested tables to avoid duplication
    const clone = el.cloneNode(true);
    clone.querySelectorAll('table').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function csvEscape(s) {
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function tableToCSV(table) {
    const rows = inScopeRows(table);
    return rows.map((r) => cellsOf(r).map((c) => csvEscape(cellText(c))).join(',')).join('\r\n');
  }
  function downloadTable(table) {
    const rows = inScopeRows(table);
    if (!rows.length) { toast('No rows in scope — nothing saved.'); return; }
    const cols = Math.max(...rows.map((r) => cellsOf(r).length), 0);
    const csv = tableToCSV(table);
    const date = new Date().toISOString().slice(0, 10);
    fileCounter += 1;
    const suffix = fileCounter > 1 ? `-${fileCounter}` : '';
    const slug = (settings.prefix || 'optum-table').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-');
    const name = `${slug}-${date}${suffix}.csv`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(`Saved ${rows.length} rows × ${cols} cols to ${name}`);
  }

  // ---------- arming + shortcut ----------
  function setArmed(on) {
    armed = on;
    if (!on) clearTint();
    syncPanel();
    if (on) toast(`Pick-mode ON (${settings.shortcut}) — hover a table, click to download, Esc exits.`);
  }

  function shortcutMatches(e) {
    // settings.shortcut like "Alt+T", "Ctrl+Shift+S"
    const parts = settings.shortcut.split('+').map((s) => s.trim().toLowerCase());
    const key = parts.pop();
    const want = { alt: parts.includes('alt'), ctrl: parts.includes('ctrl'), shift: parts.includes('shift'), meta: parts.includes('meta') };
    return e.altKey === want.alt && e.ctrlKey === want.ctrl &&
      e.shiftKey === want.shift && (e.metaKey || false) === want.meta &&
      (e.key || '').toLowerCase() === key;
  }
  let recording = false;
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === shortInput) {
      e.preventDefault();
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean);
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      settings.shortcut = [...mods, k].join('+');
      save(); syncPanel();
      shortInput.blur();
      return;
    }
    if (shortcutMatches(e)) { e.preventDefault(); setArmed(!armed); return; }
    if (armed && e.key === 'Escape') setArmed(false);
  }, true);
  // right-click cancels pick-mode (but preserve our panel contextmenu)
  document.addEventListener('contextmenu', (e) => {
    if (armed && !panel.contains(e.target) && e.target !== btn) { setArmed(false); }
  }, true);

  syncPanel();
})();
