// ==UserScript==
// @name         HaxBall Quick Chat
// @namespace    http://tampermonkey.net/
// @version      4.7
// @description  Quick Chat với hệ thống Profile – Kéo thả profile, bind động, scroll, ESC hủy, double-click xóa bind
// @author       Hoang1264589
// @match        *://*.haxball.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Chỉ chạy ở top-level page, không chạy trong bất kỳ iframe nào
  if (window !== window.top) return;

  // ==================== STORAGE KEYS ====================
  const PROFILES_KEY = 'hax_qc_profiles';
  const ACTIVE_KEY   = 'hax_qc_active_profile';
  const DELAY_KEY    = 'hax_qc_delay';
  const MIN_KEY      = 'hax_qc_min';
  const POS_KEY      = 'hax_qc_pos';
  const ORDER_KEY    = 'hax_qc_order'; // thứ tự profile
  const ENABLED_KEY  = 'hax_qc_enabled';
  const STOP_KEY     = 'hax_qc_stop_key';
  const DEFAULT_STOP_BIND = 'Slash';

  // ==================== POSITION ====================
  const PosState = {
    get() { try { const r = localStorage.getItem(POS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
    save(xPct, yPct) { localStorage.setItem(POS_KEY, JSON.stringify({ xPct, yPct })); }
  };

  function saveCurrentPosition(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth  - panel.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
    PosState.save(
      maxX > 0 ? Math.max(0, Math.min(1, rect.left / maxX)) : 0,
      maxY > 0 ? Math.max(0, Math.min(1, rect.top  / maxY)) : 0
    );
  }

  function applyPanelPosition(panel) {
    if (!panel) return;
    const pos = PosState.get();
    if (pos && typeof pos.xPct === 'number') {
      panel.style.bottom = ''; panel.style.right = '';
      const maxX = Math.max(0, window.innerWidth  - panel.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
      panel.style.left = (pos.xPct * maxX) + 'px';
      panel.style.top  = (pos.yPct * maxY) + 'px';
    } else {
      panel.style.top = ''; panel.style.left = '';
      panel.style.bottom = '45px'; panel.style.left = '10px';
    }
  }

  // ==================== PROFILE ORDER ====================
  function loadOrder(profiles) {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        // Lọc chỉ giữ những tên còn tồn tại, thêm cái mới vào cuối
        const existing = arr.filter(n => profiles[n]);
        const missing  = Object.keys(profiles).filter(n => !existing.includes(n));
        return [...existing, ...missing];
      }
    } catch {}
    return Object.keys(profiles);
  }

  function saveOrder(order) {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }

  // ==================== DEFAULT DATA ====================
  const DEFAULT_PROFILES = {
    'Default': {
      binds: [
        { code: 'KeyI', msg: 'Chuyền!' },
        { code: 'KeyJ', msg: 'Sút đi!' },
        { code: 'KeyK', msg: 'Đẹp quá!' },
        { code: 'KeyU', msg: 'Gì vậy?' },
        { code: 'KeyO', msg: 'Sao k sút?' },
        { code: 'KeyL', msg: 'GK lên!' },
      ]
    }
  };

  function loadProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PROFILES));
      const parsed = JSON.parse(raw);
      // Migration: nếu binds là object {1:..., 2:...} thì convert sang array
      for (const name of Object.keys(parsed)) {
        if (parsed[name].binds && !Array.isArray(parsed[name].binds)) {
          parsed[name].binds = Object.values(parsed[name].binds);
        }
        if (!parsed[name].binds) parsed[name].binds = [];
      }
      if (typeof parsed !== 'object' || Object.keys(parsed).length === 0)
        return JSON.parse(JSON.stringify(DEFAULT_PROFILES));
      return parsed;
    } catch { return JSON.parse(JSON.stringify(DEFAULT_PROFILES)); }
  }

  function saveProfiles() { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); }

  function loadActiveProfile() {
    const name = localStorage.getItem(ACTIVE_KEY);
    if (name && profiles[name]) return name;
    return profileOrder[0];
  }

  function saveActiveProfile() { localStorage.setItem(ACTIVE_KEY, activeProfile); }

  function loadKey(key, fallback) {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, fallback);
      return fallback;
    }
    return stored || fallback;
  }

  function saveKey(key, value) {
    localStorage.setItem(key, value);
  }

  // ==================== STATE ====================
  let profiles      = loadProfiles();
  let profileOrder  = loadOrder(profiles);
  let activeProfile = loadActiveProfile();
  let chatDelay     = parseInt(localStorage.getItem(DELAY_KEY) || '0', 10);
  let isMinimized   = localStorage.getItem(MIN_KEY) === 'true';
  let scriptEnabled = localStorage.getItem(ENABLED_KEY) !== 'false';
  let stopBindCode  = loadKey(STOP_KEY, DEFAULT_STOP_BIND);
  let rebindIdx     = null; // index trong binds array, null = không rebind
  let rebindStop    = false;

  function getBinds() { return profiles[activeProfile].binds; }

  // ==================== ANTI-STUTTER ====================
  let isRoomTransitioning = false;
  let transitionCooldown  = null;

  function triggerRoomTransition() {
    if (isRoomTransitioning) return;
    isRoomTransitioning = true;
    if (transitionCooldown) clearTimeout(transitionCooldown);
    transitionCooldown = setTimeout(() => {
      isRoomTransitioning = false;
      transitionCooldown = null;
    }, 2000);
  }

  // ==================== KEY LABEL ====================
  function keyLabel(code) {
    if (!code || code === 'NONE') return '—';
    const map = {
      ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
      ShiftLeft: 'Shift',  ShiftRight: 'Shift',
      AltLeft: 'Alt',      AltRight: 'Alt',
      Space: 'Space', Tab: 'Tab',
      Slash: '/', Backslash: '\\',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    };
    if (map[code]) return map[code];
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'N').replace(/^Arrow/, '');
  }

  function bindConflicts(target, code, idx = null) {
    if (!code || code === 'NONE') return [];
    const conflicts = [];

    if (target !== 'stop' && stopBindCode === code) conflicts.push('STOP');

    const binds = getBinds();
    binds.forEach((bind, bindIdx) => {
      if (!bind || bind.code !== code) return;
      if (target === 'bind' && bindIdx === idx) return;
      conflicts.push('Bind #' + (bindIdx + 1));
    });

    return conflicts;
  }

  function hasBindConflict(target, code, idx = null) {
    return bindConflicts(target, code, idx).length > 0;
  }

  function conflictTitle(target, code, baseTitle, idx = null) {
    const conflicts = bindConflicts(target, code, idx);
    if (!conflicts.length) return baseTitle;
    return baseTitle + ' | Trùng với: ' + conflicts.join(', ');
  }

  function isModifierHeld(e) {
    return e.ctrlKey || e.altKey || e.metaKey;
  }

  function isTextTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function handleStopToggleKey(e) {
    if (!e.isTrusted || !e.code || e.repeat || isModifierHeld(e) || isTextTarget(e.target)) return false;
    if (!stopBindCode || stopBindCode === 'NONE' || e.code !== stopBindCode) return false;
    setScriptEnabled(!scriptEnabled);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return true;
  }

  // ==================== PUSH TO GAME ====================
  // Không cần dispatch event nữa vì key handler đọc getBinds() và chatDelay trực tiếp.
  function pushToGame() { /* no-op: binds & delay đọc live từ state */ }

  // ==================== PANEL ====================
  const panel = document.createElement('div');
  panel.id = 'hax-qc-panel';

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #hax-qc-panel * { box-sizing: border-box; }
    .qc-btn {
      background: #2a2a3e; border: 1px solid #555; color: #ccc;
      border-radius: 4px; padding: 3px 7px; cursor: pointer;
      font-size: 11px; font-family: monospace;
      transition: background .15s, border-color .15s; white-space: nowrap; flex-shrink: 0;
    }
    .qc-btn:hover { background: #35354f; border-color: #888; color: #fff; }
    .qc-btn.danger { border-color: #a03; color: #f77; }
    .qc-btn.danger:hover { background: #3a1020; }
    .qc-btn.active { background: #1a3a2a; border-color: #4ade80; color: #4ade80; }

    .qc-badge {
      font-family: monospace; background: #2a2a3e; border: 1px solid #666;
      width: 44px; min-width: 44px; text-align: center;
      border-radius: 4px; padding: 3px 0; cursor: pointer; font-size: 11px;
      color: #ccc; transition: .15s; user-select: none; flex-shrink: 0;
    }
    .qc-badge:hover { border-color: #aaa; color: #fff; }
    .qc-badge.rebinding { border-color: #f0c060 !important; color: #f0c060;
      animation: qc-pulse .6s infinite alternate; }
    .qc-badge.empty { color: #555; border-style: dashed; }
    .qc-badge.conflict {
      border-color: #f77 !important;
      color: #ff9a9a !important;
      background: #3a1020 !important;
    }

    .qc-msg-input {
      flex: 1; height: 24px; background: #1a1a2e; border: 1px solid #444;
      color: #eee; border-radius: 4px; font-size: 12px; padding: 0 6px;
      outline: none; font-family: monospace; transition: border-color .15s; min-width: 0;
    }
    .qc-msg-input:focus { border-color: #6a8fff; }

    /* Scroll container cho bind list */
    .qc-bind-scroll {
      overflow-y: auto; max-height: 260px;
      scrollbar-width: thin; scrollbar-color: #444 transparent;
    }
    .qc-bind-scroll::-webkit-scrollbar { width: 4px; }
    .qc-bind-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    /* Profile list drag */
    .qc-profile-list {
      display: flex; flex-direction: column; gap: 3px;
      overflow-y: auto; max-height: 140px;
      scrollbar-width: thin; scrollbar-color: #444 transparent;
      margin-bottom: 6px;
    }
    .qc-profile-list::-webkit-scrollbar { width: 4px; }
    .qc-profile-list::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .qc-profile-item {
      display: flex; align-items: center; gap: 4px;
      padding: 3px 5px; border-radius: 4px; cursor: pointer;
      border: 1px solid transparent; font-size: 11px; color: #d2d7f5;
      font-weight: 600;
      transition: background .1s; user-select: none;
      text-shadow: 0 1px 2px rgba(0,0,0,.5);
    }
    .qc-profile-item:hover { background: #2a2a3e; }
    .qc-profile-item.active {
      background: #1a2a3a;
      border-color: #5ba5d6;
      color: #9de8ff;
      font-weight: 700;
    }
    .qc-profile-item .profile-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .drag-grip {
      cursor: grab;
      color: #8f99dc;
      font-size: 13px;
      font-weight: 800;
      flex-shrink: 0;
      padding: 0 2px;
      user-select: none;
      line-height: 1;
      text-shadow: 0 1px 2px rgba(0,0,0,.55);
    }
    .drag-grip:hover { color: #c5ccff; }
    .drag-grip:active { cursor: grabbing; }

    .qc-drop-placeholder {
      background: rgba(100,120,220,0.13);
      border: 1.5px dashed #6a8fff;
      border-radius: 4px;
      box-sizing: border-box;
      flex-shrink: 0;
      box-shadow: inset 0 0 0 1px rgba(106,143,255,.18);
    }

    .qc-section { border-top: 1px solid #2a2a3e; margin-top: 8px; padding-top: 8px; }
    .qc-label {
      font-size: 12px;
      color: #aeb4df;
      letter-spacing: .04em;
      text-transform: uppercase;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,.55);
    }

    .qc-mini-title {
      font-size: 10px;
      color: #aeb4df;
      font-weight: 700;
      letter-spacing: .08em;
      flex-shrink: 0;
      text-shadow: 0 1px 2px rgba(0,0,0,.55);
    }

    .qc-mini-profile {
      font-size: 11px;
      color: #d7dcff;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
      text-shadow: 0 1px 2px rgba(0,0,0,.6);
    }

    .qc-panel-title {
      font-size: 11px;
      color: #d7dcff;
      font-weight: 800;
      letter-spacing: .06em;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,.6);
    }

    .qc-sort-btn {
      font-size: 12px; background: #1a1a2e; border: 1px solid #555; color: #d7dcff;
      border-radius: 3px; padding: 1px 5px; cursor: pointer; flex-shrink: 0;
      font-weight: 800; letter-spacing: .04em;
      text-shadow: 0 1px 2px rgba(0,0,0,.6);
    }
    .qc-sort-btn:hover { border-color: #8fa0ff; color: #fff; }

    @keyframes qc-pulse {
      from { box-shadow: 0 0 0 0 rgba(240,192,96,.6); }
      to   { box-shadow: 0 0 0 4px rgba(240,192,96,0); }
    }
  `;
  document.head.appendChild(styleEl);

  // ==================== RENDER ====================
  function render() {
    if (isRoomTransitioning) return;

    // Lưu scroll position trước khi rebuild
    const prevProfileScroll = panel.querySelector('.qc-profile-list')?.scrollTop ?? 0;
    const prevBindScroll    = panel.querySelector('.qc-bind-scroll')?.scrollTop ?? 0;

    panel.innerHTML = '';
    panel.removeAttribute('style');
    Object.assign(panel.style, {
      position: 'fixed', zIndex: 99999,
      background: 'rgba(14,14,28,0.7)',
      color: '#ddd', border: '1px solid #383860',
      fontFamily: 'monospace, sans-serif', userSelect: 'none',
      borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,.5)'
    });

    if (isMinimized) {
      Object.assign(panel.style, { padding: '7px 10px', fontSize: '12px', maxWidth: '220px' });
      panel.innerHTML = `
        <div id="qc-drag-handle" style="display:flex;flex-direction:column;gap:3px;cursor:grab;touch-action:none;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;">
            <span class="qc-mini-title">QC</span>
            <span class="qc-mini-profile" title="${activeProfile}">${activeProfile}</span>
            <span id="qc-tog" style="cursor:pointer;color:#d7dcff;font-size:14px;font-weight:900;line-height:1;flex-shrink:0;padding-left:4px;text-shadow:0 1px 2px rgba(0,0,0,.6);">+</span>
          </div>
          <div style="font-size:9px;color:${scriptEnabled ? '#6f6' : '#f77'};font-weight:800;letter-spacing:.04em;">
            Tool: ${scriptEnabled ? 'BẬT' : 'TẮT'} (${keyLabel(stopBindCode)})
          </div>
        </div>`;
      panel.querySelector('#qc-tog').onclick = toggle;
      setupDrag(panel, panel.querySelector('#qc-drag-handle'));
      applyPanelPosition(panel);
      return;
    }

    Object.assign(panel.style, { padding: '10px 12px', fontSize: '12px', width: '260px' });

    // ---- HEADER ----
    const header = mkEl('div', {
      id: 'qc-drag-handle',
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:grab;touch-action:none;padding-bottom:8px;border-bottom:1px solid #2a2a3e;'
    });
    header.innerHTML = `
      <span class="qc-panel-title">HAX QUICK CHAT</span>
      <span id="qc-tog" style="cursor:pointer;color:#d7dcff;font-size:16px;font-weight:900;line-height:1;padding:0 2px;text-shadow:0 1px 2px rgba(0,0,0,.6);">−</span>`;
    header.querySelector('#qc-tog').onclick = toggle;
    panel.appendChild(header);
    setupDrag(panel, header);

    // ---- STATE ----
    const stateRow = mkEl('div', {
      className: 'qc-section',
      style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:0;padding-top:0;border-top:0;margin-bottom:8px;'
    });
    const stateLeft = mkEl('div', { style: 'display:flex;align-items:center;gap:5px;min-width:0;' });
    stateLeft.appendChild(mkEl('span', { className: 'qc-label', textContent: 'State' }));
    const stateBtn = mkEl('button', {
      className: 'qc-btn ' + (scriptEnabled ? 'active' : 'danger'),
      textContent: scriptEnabled ? 'BẬT' : 'TẮT',
      title: 'Bật/tắt Quick Chat'
    });
    stateBtn.onclick = () => setScriptEnabled(!scriptEnabled);
    stateLeft.appendChild(stateBtn);

    const stateRight = mkEl('div', { style: 'display:flex;align-items:center;gap:4px;flex-shrink:0;' });
    stateRight.appendChild(mkEl('span', { textContent: 'STOP', style: 'font-size:9px;color:#8f99dc;font-weight:800;' }));
    stateRight.appendChild(makeStopBadge());

    stateRow.appendChild(stateLeft);
    stateRow.appendChild(stateRight);
    panel.appendChild(stateRow);

    // ---- PROFILE SECTION LABEL ----
    const profileLabelRow = mkEl('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;' });
    profileLabelRow.innerHTML = `<span class="qc-label">Profiles</span>`;

    const profileActions = mkEl('div', { style: 'display:flex;gap:4px;align-items:center;' });

    // Nút tự sắp xếp A-Z
    const sortBtn = mkEl('button', { className: 'qc-sort-btn', textContent: 'A-Z', title: 'Sắp xếp A→Z' });
    sortBtn.onclick = () => {
      profileOrder.sort((a, b) => a.localeCompare(b));
      saveOrder(profileOrder);
      render();
    };
    profileActions.appendChild(sortBtn);

    const btnNew = mkEl('button', { className: 'qc-btn', textContent: '+', title: 'Tạo profile mới' });
    btnNew.onclick = () => {
      const name = prompt('Tên profile mới:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();
      if (profiles[trimmed]) { alert('Tên đã tồn tại!'); return; }
      profiles[trimmed] = { binds: [] };
      profileOrder.push(trimmed);
      activeProfile = trimmed;
      saveProfiles(); saveOrder(profileOrder); saveActiveProfile(); pushToGame(); render();
    };
    profileActions.appendChild(btnNew);

    const btnRen = mkEl('button', { className: 'qc-btn', textContent: '✎', title: 'Đổi tên profile đang chọn' });
    btnRen.onclick = () => {
      if (activeProfile === 'Default') { alert('Không đổi tên Default!'); return; }
      const newName = prompt('Tên mới:', activeProfile);
      if (!newName || !newName.trim() || newName.trim() === activeProfile) return;
      const trimmed = newName.trim();
      if (profiles[trimmed]) { alert('Tên đã tồn tại!'); return; }
      profiles[trimmed] = profiles[activeProfile]; delete profiles[activeProfile];
      const idx = profileOrder.indexOf(activeProfile);
      if (idx !== -1) profileOrder[idx] = trimmed;
      activeProfile = trimmed;
      saveProfiles(); saveOrder(profileOrder); saveActiveProfile(); pushToGame(); render();
    };
    profileActions.appendChild(btnRen);

    const btnDel = mkEl('button', { className: 'qc-btn danger', textContent: '✕', title: 'Xoá profile đang chọn' });
    btnDel.onclick = () => {
      if (profileOrder.length <= 1) { alert('Phải có ít nhất 1 profile!'); return; }
      if (!confirm(`Xoá profile "${activeProfile}"?`)) return;
      delete profiles[activeProfile];
      profileOrder = profileOrder.filter(n => n !== activeProfile);
      activeProfile = profileOrder[0];
      saveProfiles(); saveOrder(profileOrder); saveActiveProfile(); pushToGame(); render();
    };
    profileActions.appendChild(btnDel);

    profileLabelRow.appendChild(profileActions);
    panel.appendChild(profileLabelRow);

    // ---- PROFILE LIST (kéo thả) ----
    const profileList = mkEl('div', { className: 'qc-profile-list' });
    profileOrder.forEach((name) => {
      const item = mkEl('div', { className: 'qc-profile-item' + (name === activeProfile ? ' active' : '') });
      item.dataset.name = name;

      const grip = mkEl('span', { className: 'drag-grip', textContent: '⠿' });
      item.appendChild(grip);

      const nameSpan = mkEl('span', { className: 'profile-name', textContent: name });
      item.appendChild(nameSpan);

      // Click để chọn profile
      item.onclick = (e) => {
        if (e.target === grip) return;
        activeProfile = name;
        saveActiveProfile(); pushToGame(); render();
      };

      profileList.appendChild(item);
    });

    // Kéo thả profile trong list
    setupProfileDrag(profileList);
    panel.appendChild(profileList);
    // Restore scroll position của profile list
    profileList.scrollTop = prevProfileScroll;

    // ---- BINDS SECTION ----
    const bindLabelRow = mkEl('div', { className: 'qc-section', style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;' });
    bindLabelRow.innerHTML = `<span class="qc-label">Binds — ${activeProfile}</span>`;

    const addBindBtn = mkEl('button', { className: 'qc-btn', textContent: '+ Bind', title: 'Thêm bind mới' });
    addBindBtn.onclick = () => {
      getBinds().push({ code: 'NONE', msg: '' });
      saveProfiles(); pushToGame(); render();
      // Scroll xuống cuối
      setTimeout(() => { const sc = panel.querySelector('.qc-bind-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 0);
    };
    bindLabelRow.appendChild(addBindBtn);
    panel.appendChild(bindLabelRow);

    // Scroll container
    const scrollBox = mkEl('div', { className: 'qc-bind-scroll' });

    const binds = getBinds();
    binds.forEach((bind, idx) => {
      const row = mkEl('div', {
        className: 'qc-bind-row',
        style: 'display:flex;gap:5px;align-items:center;margin-bottom:5px;'
      });
      row.dataset.idx = idx;

      // Drag grip
      const grip = mkEl('span', { className: 'drag-grip', textContent: '⠿', title: 'Kéo để sắp xếp' });
      row.appendChild(grip);

      // Badge phím
      const isThisRebinding = rebindIdx === idx;
      const isEmpty = !bind.code || bind.code === 'NONE';
      const hasConflict = hasBindConflict('bind', bind.code, idx);
      const badge = mkEl('span', {
        className: 'qc-badge'
          + (isThisRebinding ? ' rebinding' : '')
          + (isEmpty && !isThisRebinding ? ' empty' : '')
          + (hasConflict && !isThisRebinding ? ' conflict' : ''),
        textContent: isThisRebinding ? '…' : keyLabel(bind.code),
        title: conflictTitle('bind', bind.code, 'Click: bind phím | Double-click: xóa bind', idx)
      });

      badge.addEventListener('mousedown', (e) => { e.preventDefault(); });
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        startRebind(idx);
      });
      badge.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (rebindStop || rebindIdx === idx) cancelRebind();
        bind.code = 'NONE';
        saveProfiles(); pushToGame(); render();
      });

      row.appendChild(badge);

      // Input nội dung
      const msgInput = mkEl('input', { className: 'qc-msg-input', type: 'text', value: bind.msg, placeholder: 'Nội dung chat...' });
      msgInput.addEventListener('keydown', (e) => e.stopPropagation());
      msgInput.addEventListener('input', () => {
        bind.msg = msgInput.value;
        saveProfiles(); pushToGame();
      });
      row.appendChild(msgInput);

      // Nút xóa bind
      const delBtn = mkEl('button', { className: 'qc-btn danger', textContent: '✕', title: 'Xóa bind này' });
      delBtn.style.cssText = 'padding:3px 5px;';
      delBtn.onclick = () => {
        if (rebindStop || rebindIdx === idx) cancelRebind();
        binds.splice(idx, 1);
        saveProfiles(); pushToGame(); render();
      };
      row.appendChild(delBtn);

      scrollBox.appendChild(row);
    });

    if (binds.length === 0) {
      scrollBox.innerHTML = `<div style="font-size:11px;color:#555;text-align:center;padding:8px 0;">Chưa có bind nào. Nhấn + Bind để thêm.</div>`;
    }

    setupBindDrag(scrollBox);
    panel.appendChild(scrollBox);
    // Restore scroll position của bind list
    scrollBox.scrollTop = prevBindScroll;

    // ---- DELAY ----
    const delaySection = mkEl('div', { className: 'qc-section', style: 'display:flex;justify-content:space-between;align-items:center;' });
    delaySection.innerHTML = `<span class="qc-label" title="Thời gian chờ tối thiểu giữa 2 lần gửi (ms)">Delay (ms)</span>`;
    const delayInput = mkEl('input', {
      type: 'number', value: chatDelay, min: 0,
      style: 'width:55px;height:22px;text-align:center;background:#1a1a2e;border:1px solid #555;color:#f0c060;border-radius:4px;font-size:12px;outline:none;'
    });
    delayInput.addEventListener('keydown', (e) => e.stopPropagation());
    delayInput.addEventListener('input', () => {
      let v = parseInt(delayInput.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      chatDelay = v;
      localStorage.setItem(DELAY_KEY, chatDelay);
      pushToGame();
    });
    delaySection.appendChild(delayInput);
    panel.appendChild(delaySection);

    // ---- HINT ----
    const hint = mkEl('div', { id: 'qc-hint', style: 'font-size:10px;color:#f0c060;height:13px;margin-top:5px;text-align:center;' });
    if (rebindStop) {
      hint.textContent = 'Nhấn phím bật/tắt tool — ESC để hủy — Double-click badge để xóa bind';
    } else if (rebindIdx !== null) {
      hint.textContent = 'Nhấn phím mới — ESC để hủy — Double-click badge để xóa bind';
    } else if (!scriptEnabled) {
      hint.textContent = 'Quick Chat đang tắt';
      hint.style.color = '#f77';
    }
    panel.appendChild(hint);

    applyPanelPosition(panel);
  }

  // ==================== DRAG & DROP HELPER (dùng chung cho profile và bind) ====================
  // itemSelector: CSS selector của item có thể kéo
  // onDrop(fromIdx, toIdx, meta): callback khi thả xong
  function setupDragList(listEl, itemSelector, onDrop) {
    listEl.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.drag-grip');
      if (!grip) return;
      const item = grip.closest(itemSelector);
      if (!item) return;
      e.preventDefault();

      const allItems = () => [...listEl.querySelectorAll(itemSelector)];
      const fromIdx  = allItems().indexOf(item);
      const itemRect = item.getBoundingClientRect();
      const itemStyle = getComputedStyle(item);
      const itemH = item.offsetHeight;
      const itemW = item.offsetWidth;
      const pointerOffsetX = e.clientX - itemRect.left;
      const pointerOffsetY = e.clientY - itemRect.top;

      // Ghost theo chuột. Copy font từ item vì ghost được đưa ra ngoài panel.
      const dragEl = item.cloneNode(true);
      const sourceFields = item.querySelectorAll('input, textarea, select');
      const clonedFields = dragEl.querySelectorAll('input, textarea, select');
      sourceFields.forEach((field, i) => {
        if (clonedFields[i] && 'value' in clonedFields[i]) clonedFields[i].value = field.value;
      });
      Object.assign(dragEl.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 999999,
        left: itemRect.left + 'px',
        top: itemRect.top + 'px',
        width: itemW + 'px',
        height: itemH + 'px',
        opacity: '0.88',
        background: 'rgba(40,40,80,0.96)',
        border: '1px solid #6a8fff',
        borderRadius: itemStyle.borderRadius || '4px',
        boxShadow: '0 4px 16px rgba(0,0,0,.5)',
        cursor: 'grabbing',
        fontFamily: itemStyle.fontFamily,
        fontSize: itemStyle.fontSize,
        fontWeight: itemStyle.fontWeight,
        lineHeight: itemStyle.lineHeight,
        letterSpacing: itemStyle.letterSpacing,
        color: itemStyle.color,
      });
      document.body.appendChild(dragEl);

      // Placeholder giữ chỗ trong list
      const ph = mkEl('div', { className: 'qc-drop-placeholder' });
      Object.assign(ph.style, {
        height: itemH + 'px',
        marginBottom: itemStyle.marginBottom,
      });
      item.replaceWith(ph);

      // Đổi cursor toàn trang khi đang kéo
      document.body.style.cursor = 'grabbing';

      const moveGhost = (x, y) => {
        dragEl.style.left = (x - pointerOffsetX) + 'px';
        dragEl.style.top  = (y - pointerOffsetY) + 'px';
      };
      moveGhost(e.clientX, e.clientY);
      listEl.setPointerCapture(e.pointerId);

      listEl.addEventListener('pointermove', onMove);
      listEl.addEventListener('pointerup',   onUp);
      listEl.addEventListener('pointercancel', onUp);

      function onMove(me) {
        moveGhost(me.clientX, me.clientY);
        // Di chuyển placeholder đến vị trí thích hợp
        const items = allItems();
        let inserted = false;
        for (const it of items) {
          const rect = it.getBoundingClientRect();
          if (me.clientY < rect.top + rect.height / 2) {
            listEl.insertBefore(ph, it);
            inserted = true;
            break;
          }
        }
        if (!inserted) listEl.appendChild(ph);
      }

      function onUp() {
        const dropScrollTop = listEl.scrollTop;
        const dropPlaceholderTop = ph.getBoundingClientRect().top;

        listEl.releasePointerCapture(e.pointerId);
        listEl.removeEventListener('pointermove', onMove);
        listEl.removeEventListener('pointerup',   onUp);
        listEl.removeEventListener('pointercancel', onUp);
        dragEl.remove();
        document.body.style.cursor = '';

        // Tính toIdx = số item trước placeholder
        const toIdx = allItems().filter(it => {
          // item nằm trước placeholder trong DOM không?
          return ph.compareDocumentPosition(it) & Node.DOCUMENT_POSITION_PRECEDING;
        }).length;

        ph.remove();
        onDrop(fromIdx, toIdx, {
          scrollTop: dropScrollTop,
          placeholderTop: dropPlaceholderTop,
        });
      }
    });
  }

  function restoreListScroll(selector, scrollTop) {
    const restore = () => {
      const list = panel.querySelector(selector);
      if (list) list.scrollTop = scrollTop;
    };
    restore();
    requestAnimationFrame(restore);
  }

  function setupProfileDrag(listEl) {
    setupDragList(listEl, '.qc-profile-item', (fromIdx, toIdx, meta) => {
      const moved = profileOrder.splice(fromIdx, 1)[0];
      profileOrder.splice(toIdx, 0, moved);
      saveOrder(profileOrder);
      render();
      restoreListScroll('.qc-profile-list', meta.scrollTop);
    });
  }

  function setupBindDrag(scrollEl) {
    setupDragList(scrollEl, '.qc-bind-row', (fromIdx, toIdx, meta) => {
      const binds = getBinds();
      const [moved] = binds.splice(fromIdx, 1);
      binds.splice(toIdx, 0, moved);
      saveProfiles(); pushToGame();
      render();
      restoreListScroll('.qc-bind-scroll', meta.scrollTop);
    });
  }

  // ==================== REBIND ====================
  function makeStopBadge() {
    const isThisRebinding = rebindStop;
    const hasConflict = hasBindConflict('stop', stopBindCode);
    const badge = mkEl('span', {
      className: 'qc-badge'
        + (isThisRebinding ? ' rebinding' : '')
        + ((!stopBindCode || stopBindCode === 'NONE') && !isThisRebinding ? ' empty' : '')
        + (hasConflict && !isThisRebinding ? ' conflict' : ''),
      textContent: isThisRebinding ? '…' : keyLabel(stopBindCode),
      title: conflictTitle('stop', stopBindCode, 'Click: bind phím bật/tắt tool | Double-click: xóa bind')
    });
    badge.addEventListener('mousedown', (e) => { e.preventDefault(); });
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      startStopRebind();
    });
    badge.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      clearStopBind();
    });
    return badge;
  }

  function setScriptEnabled(enabled) {
    const nextEnabled = !!enabled;
    if (scriptEnabled !== nextEnabled) sendGeneration = (sendGeneration + 1) % 1000000000;
    scriptEnabled = nextEnabled;
    localStorage.setItem(ENABLED_KEY, scriptEnabled ? 'true' : 'false');
    if (!scriptEnabled) {
      recentChats.length = 0;
    }
    render();
    setHint(scriptEnabled ? 'Quick Chat đã bật.' : 'Quick Chat đã tắt.', scriptEnabled ? '#6f6' : '#f77');
  }

  function startRebind(idx) {
    rebindStop = false;
    rebindIdx = idx;
    render();
    window.dispatchEvent(new CustomEvent('__hax_qc_setRebind', { detail: true }));
  }

  function startStopRebind() {
    rebindIdx = null;
    rebindStop = true;
    render();
    window.dispatchEvent(new CustomEvent('__hax_qc_setRebind', { detail: true }));
  }

  function cancelRebind() {
    rebindIdx = null;
    rebindStop = false;
    window.dispatchEvent(new CustomEvent('__hax_qc_setRebind', { detail: false }));
  }

  function clearStopBind() {
    if (rebindStop) cancelRebind();
    stopBindCode = 'NONE';
    saveKey(STOP_KEY, stopBindCode);
    render();
  }

  function finishRebind(code) {
    if (!rebindStop && rebindIdx === null) return;
    const isStopTarget = rebindStop;
    const idx = rebindIdx;
    cancelRebind();
    let message = 'Đã hủy.';
    let color = '#888';
    if (code !== 'Escape') {
      const conflicts = bindConflicts(isStopTarget ? 'stop' : 'bind', code, idx);
      if (conflicts.length) {
        render();
        setHint('Phím ' + keyLabel(code) + ' bị trùng với ' + conflicts.join(', ') + '.', '#f77');
        return;
      }
      if (isStopTarget) {
        stopBindCode = code;
        saveKey(STOP_KEY, stopBindCode);
      } else {
        getBinds()[idx].code = code;
        saveProfiles();
      }
      message = '✓ Đã lưu!';
      color = '#6f6';
    }
    render();
    setHint(message, color);
  }

  window.addEventListener('keydown', (e) => {
    if (!rebindStop && rebindIdx === null) {
      handleStopToggleKey(e);
      return;
    }
    if (isModifierHeld(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    finishRebind(e.code); // 'Escape' sẽ cancel trong finishRebind
  }, true);

  window.addEventListener('__hax_qc_forwardRebind', (e) => finishRebind(e.detail));

  function setHint(msg, color = '#f0c060') {
    const h = panel.querySelector('#qc-hint');
    if (!h) return;
    h.style.color = color; h.textContent = msg;
    if (msg) setTimeout(() => {
      const h2 = panel.querySelector('#qc-hint');
      if (!h2 || rebindStop || rebindIdx !== null) return;
      if (!scriptEnabled) {
        h2.style.color = '#f77';
        h2.textContent = 'Quick Chat đang tắt';
      } else {
        h2.textContent = '';
      }
    }, 1800);
  }

  // ==================== TOGGLE MINIMIZE ====================
  function toggle() {
    if (rebindStop || rebindIdx !== null) cancelRebind();
    const rectBefore = panel.getBoundingClientRect();
    const centerX = rectBefore.left + rectBefore.width  / 2;
    const centerY = rectBefore.top  + rectBefore.height / 2;

    isMinimized = !isMinimized;
    localStorage.setItem(MIN_KEY, isMinimized);
    render();

    panel.style.bottom = ''; panel.style.right = '';
    const nW = panel.offsetWidth, nH = panel.offsetHeight;
    let nL = rectBefore.left, nT = rectBefore.top;
    if (centerX > window.innerWidth  / 2) nL = rectBefore.right  - nW;
    if (centerY > window.innerHeight / 2) nT = rectBefore.bottom - nH;
    nL = Math.max(0, Math.min(window.innerWidth  - nW, nL));
    nT = Math.max(0, Math.min(window.innerHeight - nH, nT));
    panel.style.left = nL + 'px';
    panel.style.top  = nT + 'px';
    saveCurrentPosition(panel);
  }

  // ==================== PANEL DRAG ====================
  function setupDrag(panel, handleEl) {
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'qc-tog') return;
      if (e.button !== 0) return;
      handleEl.setPointerCapture(e.pointerId);

      const rect = panel.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = rect.left, startTop = rect.top;

      panel.style.bottom = ''; panel.style.right = '';
      panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
      document.body.style.userSelect = 'none';
      handleEl.style.cursor = 'grabbing';

      function onMove(me) {
        let nL = startLeft + (me.clientX - startX);
        let nT = startTop  + (me.clientY - startY);
        nL = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  nL));
        nT = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, nT));
        panel.style.left = nL + 'px'; panel.style.top = nT + 'px';
      }

      function onUp(ue) {
        handleEl.releasePointerCapture(ue.pointerId);
        handleEl.style.cursor = 'grab';
        document.body.style.userSelect = '';
        handleEl.removeEventListener('pointermove',   onMove);
        handleEl.removeEventListener('pointerup',     onUp);
        handleEl.removeEventListener('pointercancel', onUp);
        saveCurrentPosition(panel);
      }

      handleEl.addEventListener('pointermove',   onMove);
      handleEl.addEventListener('pointerup',     onUp);
      handleEl.addEventListener('pointercancel', onUp);
      e.preventDefault();
    });
  }

  // ==================== HELPERS ====================
  function mkEl(tag, props = {}) {
    const e = document.createElement(tag);
    Object.keys(props).forEach(k => {
      if (k === 'style' && typeof props[k] === 'string') e.style.cssText = props[k];
      else e[k] = props[k];
    });
    return e;
  }

  // ==================== SMART SURVIVABILITY ====================
  let bodyObserver = null;

  function attachBodyObserver() {
    if (bodyObserver) bodyObserver.disconnect();
    bodyObserver = new MutationObserver((mutations) => {
      if (isRoomTransitioning) return;
      let iframeChanged = false;
      for (const m of mutations) {
        for (const node of [...m.addedNodes, ...m.removedNodes]) {
          if (node.nodeType === 1 && node.tagName === 'IFRAME' && node.classList?.contains('gameframe')) {
            iframeChanged = true;
          }
        }
      }
      if (iframeChanged) {
        triggerRoomTransition();
        window.dispatchEvent(new CustomEvent('__hax_qc_init_frame'));
        return;
      }
      if (!document.body.contains(panel)) document.body.appendChild(panel);
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });
  }

  // ==================== MOUNT ====================
  document.body.appendChild(panel);
  render();

  window.addEventListener('resize', () => {
    if (!isRoomTransitioning) applyPanelPosition(panel);
  });

  // ==================== GAME LOGIC (chạy từ page context, truy cập frame trực tiếp) ====================
  const movementKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD']);
  const heldKeys     = new Set();
  let lastChatTime   = -Infinity;
  let isRebinding    = false;
  let gameActive     = false; // true khi đã detect room thật

  window.addEventListener('__hax_qc_setRebind', (e) => { isRebinding = e.detail; });

  function getFrame()    { return document.querySelector('iframe.gameframe'); }
  function getFrameDoc() { return getFrame()?.contentDocument ?? null; }
  function getInput()    { return getFrameDoc()?.querySelector('input[data-hook="input"]'); }
  function getCanvas()   { return getFrameDoc()?.querySelector('canvas'); }

  function dispatchChat(text) {
    if (!scriptEnabled) return;
    const input  = getInput();
    const canvas = getCanvas();
    const doc    = getFrameDoc();
    if (!input || !canvas || !doc) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      getFrame().contentWindow.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 13, code: 'Enter', key: 'Enter', bubbles: true, cancelable: true
    }));
    if (doc.activeElement !== canvas) canvas.focus();
    setTimeout(() => {
      heldKeys.forEach(code => {
        if (movementKeys.has(code))
          canvas.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
      });
    }, 0);
  }

  const recentChats = [];
  let sendGeneration = 0;
  function sendChat(text) {
    if (!scriptEnabled) return;
    if (!text || !text.trim()) return;
    const now = performance.now();
    while (recentChats.length > 0 && now - recentChats[0] > 3000) recentChats.shift();
    if (recentChats.length >= 5) return;
    recentChats.push(now);
    const elapsed = now - lastChatTime;
    if (elapsed < chatDelay) {
      const generation = sendGeneration;
      setTimeout(() => {
        if (generation === sendGeneration) sendChat(text);
      }, chatDelay - elapsed);
      return;
    }
    lastChatTime = now;
    dispatchChat(text);
  }

  function onFrameKeyDown(e) {
    if (!e.isTrusted) return;
    if (isRebinding) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('__hax_qc_forwardRebind', { detail: e.code }));
      return;
    }
    if (isModifierHeld(e)) return;
    const doc = getFrameDoc();
    if (doc?.activeElement?.tagName === 'INPUT') {
      if (e.code && e.code !== 'Enter') heldKeys.add(e.code);
      return;
    }
    if (handleStopToggleKey(e)) return;
    if (!scriptEnabled) return;
    const binds = getBinds();
    for (const bind of binds) {
      if (bind?.code && bind.code !== 'NONE' && e.code === bind.code) {
        sendChat(bind.msg); e.preventDefault(); return;
      }
    }
    if (e.repeat) return;
    heldKeys.add(e.code);
  }

  function onFrameKeyUp(e) {
    if (!e.isTrusted) return;
    heldKeys.delete(e.code);
  }

  // Attach key listeners vào frame doc (gọi lại mỗi khi frame thay đổi)
  let attachedDoc = null;
  function attachFrameListeners() {
    const doc = getFrameDoc();
    if (!doc || doc === attachedDoc) return;
    if (attachedDoc) {
      attachedDoc.removeEventListener('keydown', onFrameKeyDown, true);
      attachedDoc.removeEventListener('keyup',   onFrameKeyUp,   true);
    }
    doc.addEventListener('keydown', onFrameKeyDown, true);
    doc.addEventListener('keyup',   onFrameKeyUp,   true);
    attachedDoc = doc;
  }

  function isInRealRoom() {
    const doc = getFrameDoc();
    if (!doc) return false;
    const logContents = doc.querySelector('.log-contents');
    if (!logContents) return false;
    return logContents.querySelectorAll('p').length > 0;
  }

  // Watcher: liên tục check frame, attach listeners, detect room
  setInterval(() => {
    attachFrameListeners();
    if (!gameActive && isInRealRoom()) {
      gameActive = true;
    }
  }, 500);

  attachBodyObserver();

})();
