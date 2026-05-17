// ==UserScript==
// @name         HaxBall Auto Avatar + Spam
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Combined avatar list, avatar-by-direction, and configurable spam kick tool.
// @author       Hoang1264589
// @match        *://*.haxball.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  if (window !== window.top) return;

  // ==================== STORAGE KEYS ====================
  const PROFILES_KEY       = 'hax_aas_profiles';
  const ACTIVE_KEY         = 'hax_aas_active_profile';
  const ORDER_KEY          = 'hax_aas_order';
  const MIN_KEY            = 'hax_aas_min';
  const DIRECTION_CUSTOM_MIN_KEY = 'hax_aas_direction_custom_min';
  const POS_KEY            = 'hax_aas_pos';
  const ENABLED_KEY        = 'hax_aas_enabled';
  const STOP_KEY           = 'hax_aas_stop_key';
  const AUTO_KEY           = 'hax_aas_list_auto_key';
  const DIRECTION_KEY      = 'hax_aas_direction_key';
  const AVATAR_MODE_KEY    = 'hax_aas_avatar_mode';
  const DEFAULT_AVATAR_KEY = 'hax_aas_default_avatar';
  const SPAM_TOGGLE_KEY    = 'hax_aas_spam_toggle_key';
  const SPAM_ACTION_KEY    = 'hax_aas_spam_action_key';
  const SPAM_DELAY_KEY     = 'hax_aas_spam_delay';
  const UP_KEY             = 'hax_aas_up_key';
  const DOWN_KEY           = 'hax_aas_down_key';
  const LEFT_KEY           = 'hax_aas_left_key';
  const RIGHT_KEY          = 'hax_aas_right_key';
  const LAST_AV_KEY        = 'hax_aas_last_known_avatar';
  const DIRECTION_AVATAR_PREFIX = 'hax_aas_dir_avatar_';

  const DEFAULT_PROFILE_BIND = 'KeyH';
  const DEFAULT_STOP_BIND    = 'Quote';
  const DEFAULT_AUTO_BIND    = 'KeyT';
  const DEFAULT_DIRECTION_BIND = 'KeyW';
  const DEFAULT_SPAM_TOGGLE    = 'KeyQ';
  const DEFAULT_SPAM_ACTION    = 'KeyX';
  const DEFAULT_AVATAR_TEXT    = '😈';
  const DEFAULT_UP_KEY         = 'ArrowUp';
  const DEFAULT_DOWN_KEY       = 'ArrowDown';
  const DEFAULT_LEFT_KEY       = 'ArrowLeft';
  const DEFAULT_RIGHT_KEY      = 'ArrowRight';
  const DEFAULT_DELAY_MS     = 120;
  const DEFAULT_SPAM_DELAY_MS = 80;
  const MIN_DELAY_MS         = 100;
  const MIN_SPAM_DELAY_MS    = 10;
  const MIN_COMMAND_GAP_MS   = 40;
  const DIRECTION_THROTTLE_MS = 40;
  const CHAT_FOCUS_RETRY_MS  = 120;

  const DEFAULT_DIRECTION_AVATARS = {
    up: '\u2b06',
    down: '\u2b07',
    left: '\u2b05',
    right: '\u27a1',
    'up-right': '\u2b08',
    'up-left': '\u2b09',
    'down-right': '\u2b0a',
    'down-left': '\u2b0b',
    idle: '\u2022'
  };

  const DIRECTION_AVATAR_FIELDS = [
    ['up-left', 'UP LEFT'],
    ['up', 'UP'],
    ['up-right', 'UP RIGHT'],
    ['left', 'LEFT'],
    ['right', 'RIGHT'],
    ['down-left', 'DOWN LEFT'],
    ['down', 'DOWN'],
    ['down-right', 'DOWN RIGHT']
  ];

  const DEFAULT_PROFILES = {
    moon: {
      delay: DEFAULT_DELAY_MS,
      bindCode: 'KeyH',
      cursor: 0,
      items: [
        { type: 'avatar', value: '🌑' },
        { type: 'avatar', value: '🌒' },
        { type: 'avatar', value: '🌓' },
        { type: 'avatar', value: '🌔' },
        { type: 'avatar', value: '🌕' },
        { type: 'avatar', value: '🌖' },
        { type: 'avatar', value: '🌗' },
        { type: 'avatar', value: '🌘' },
      ]
    },
    loading: {
      delay: DEFAULT_DELAY_MS,
      bindCode: 'KeyY',
      cursor: 0,
      items: [
        { type: 'avatar', value: '⣾' },
        { type: 'avatar', value: '⣽' },
        { type: 'avatar', value: '⣻' },
        { type: 'avatar', value: '⢿' },
        { type: 'avatar', value: '⡿' },
        { type: 'avatar', value: '⣟' },
        { type: 'avatar', value: '⣯' },
        { type: 'avatar', value: '⣷' },
      ]
    }
  };

  // ==================== DATA HELPERS ====================
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asNonNegativeInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function asDelayMs(value, fallback = DEFAULT_DELAY_MS) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= MIN_DELAY_MS ? parsed : fallback;
  }

  function isValidDelayMs(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= MIN_DELAY_MS;
  }

  function asSpamDelayMs(value, fallback = DEFAULT_SPAM_DELAY_MS) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= MIN_SPAM_DELAY_MS ? parsed : fallback;
  }

  function isValidSpamDelayMs(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= MIN_SPAM_DELAY_MS;
  }

  function warnFastDelay() {
    setHint('Delay qua nhanh: toi thieu 100ms.', '#f77');
  }

  function warnFastSpamDelay() {
    setHint('Spam rate qua nhanh: toi thieu 10ms.', '#f77');
  }

  function normalizeItem(item) {
    if (typeof item === 'string') return { type: 'avatar', value: item };
    const raw = item && typeof item === 'object' ? item : {};
    if (raw.type === 'delay') {
      return { type: 'delay', value: String(asDelayMs(raw.value ?? raw.ms, DEFAULT_DELAY_MS)) };
    }
    return { type: 'avatar', value: String(raw.value ?? '') };
  }

  function normalizeProfile(profile) {
    const raw = profile && typeof profile === 'object' ? profile : {};
    const migratedItems = Array.isArray(raw.items)
      ? raw.items
      : (Array.isArray(raw.avatars) ? raw.avatars : []);
    const items = migratedItems.map(normalizeItem);
    return {
      delay: asDelayMs(raw.delay, DEFAULT_DELAY_MS),
      bindCode: raw.bindCode || raw.code || DEFAULT_PROFILE_BIND,
      cursor: asNonNegativeInt(raw.cursor, 0),
      items
    };
  }

  function loadProfiles() {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      const parsed = raw ? JSON.parse(raw) : clone(DEFAULT_PROFILES);
      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return clone(DEFAULT_PROFILES);
      const out = {};
      for (const name of Object.keys(parsed)) out[name] = normalizeProfile(parsed[name]);
      return Object.keys(out).length ? out : clone(DEFAULT_PROFILES);
    } catch {
      return clone(DEFAULT_PROFILES);
    }
  }

  function saveProfiles() {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  function loadOrder(profilesValue) {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const existing = parsed.filter(name => profilesValue[name]);
          const missing = Object.keys(profilesValue).filter(name => !existing.includes(name));
          return [...existing, ...missing];
        }
      }
    } catch {}
    return Object.keys(profilesValue);
  }

  function saveOrder(order) {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }

  function loadActiveProfile() {
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored && profiles[stored]) return stored;
    return profileOrder[0];
  }

  function saveActiveProfile() {
    localStorage.setItem(ACTIVE_KEY, activeProfile);
  }

  function loadKey(key, fallback, oldFallback = null) {
    const stored = localStorage.getItem(key);
    if (oldFallback && stored === oldFallback) {
      localStorage.setItem(key, fallback);
      return fallback;
    }
    return stored || fallback;
  }

  function saveKey(key, value) {
    localStorage.setItem(key, value);
  }

  function loadDirectionAvatars() {
    const out = {};
    for (const dir of Object.keys(DEFAULT_DIRECTION_AVATARS)) {
      out[dir] = localStorage.getItem(DIRECTION_AVATAR_PREFIX + dir) ?? DEFAULT_DIRECTION_AVATARS[dir];
    }
    return out;
  }

  function saveDirectionAvatar(dir, value) {
    directionAvatars[dir] = value;
    localStorage.setItem(DIRECTION_AVATAR_PREFIX + dir, value);
  }

  function getProfile(name = activeProfile) {
    return profiles[name];
  }

  function getItems(name = activeProfile) {
    const profile = getProfile(name);
    return profile ? profile.items : [];
  }

  function getProfileDelay(name = activeProfile) {
    const profile = getProfile(name);
    return profile ? asDelayMs(profile.delay, DEFAULT_DELAY_MS) : DEFAULT_DELAY_MS;
  }

  function hasPlayableAvatar(profile) {
    return !!profile?.items?.some(item => item.type === 'avatar' && String(item.value || '').trim());
  }

  // ==================== POSITION ====================
  const PosState = {
    get() {
      try {
        const raw = localStorage.getItem(POS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save(xPct, yPct) {
      localStorage.setItem(POS_KEY, JSON.stringify({ xPct, yPct }));
    }
  };

  function saveCurrentPosition(panelEl) {
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - panelEl.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - panelEl.offsetHeight);
    PosState.save(
      maxX > 0 ? Math.max(0, Math.min(1, rect.left / maxX)) : 0,
      maxY > 0 ? Math.max(0, Math.min(1, rect.top / maxY)) : 0
    );
  }

  function applyPanelPosition(panelEl) {
    if (!panelEl) return;
    const pos = PosState.get();
    if (pos && typeof pos.xPct === 'number') {
      panelEl.style.bottom = '';
      panelEl.style.right = '';
      const maxX = Math.max(0, window.innerWidth - panelEl.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - panelEl.offsetHeight);
      panelEl.style.left = (pos.xPct * maxX) + 'px';
      panelEl.style.top = (pos.yPct * maxY) + 'px';
    } else {
      panelEl.style.top = '';
      panelEl.style.left = '';
      panelEl.style.bottom = '24px';
      panelEl.style.right = '4px';
    }
  }

  // ==================== STATE ====================
  let profiles = loadProfiles();
  let profileOrder = loadOrder(profiles);
  let activeProfile = loadActiveProfile();

  let isMinimized = localStorage.getItem(MIN_KEY) === 'true';
  let isDirectionCustomMinimized = localStorage.getItem(DIRECTION_CUSTOM_MIN_KEY) !== 'false';
  let scriptEnabled = localStorage.getItem(ENABLED_KEY) !== 'false';
  let stopBindCode = loadKey(STOP_KEY, DEFAULT_STOP_BIND);
  let autoBindCode = loadKey(AUTO_KEY, DEFAULT_AUTO_BIND);
  let directionBindCode = loadKey(DIRECTION_KEY, DEFAULT_DIRECTION_BIND);
  let spamToggleCode = loadKey(SPAM_TOGGLE_KEY, DEFAULT_SPAM_TOGGLE);
  let spamActionCode = loadKey(SPAM_ACTION_KEY, DEFAULT_SPAM_ACTION);
  let defaultAvatarText = localStorage.getItem(DEFAULT_AVATAR_KEY) ?? DEFAULT_AVATAR_TEXT;
  let upKey = loadKey(UP_KEY, DEFAULT_UP_KEY);
  let downKey = loadKey(DOWN_KEY, DEFAULT_DOWN_KEY);
  let leftKey = loadKey(LEFT_KEY, DEFAULT_LEFT_KEY);
  let rightKey = loadKey(RIGHT_KEY, DEFAULT_RIGHT_KEY);
  let spamDelay = asSpamDelayMs(localStorage.getItem(SPAM_DELAY_KEY), DEFAULT_SPAM_DELAY_MS);
  let avatarMode = localStorage.getItem(AVATAR_MODE_KEY) === 'direction' ? 'direction' : 'list';
  let directionAvatars = loadDirectionAvatars();
  let spamEnabled = false;
  let rebindTarget = null;
  let hintTimer = null;

  let autoActive = false;
  let autoProfile = null;
  let autoTimer = null;
  const manualTimers = new Map();
  const heldProfileBindCodes = new Set();
  let lastDirection = '';
  let directionTimer = null;
  let lastDirectionCommandAt = -DIRECTION_THROTTLE_MS;
  let spamActive = false;
  let spamTimer = null;
  let spamPressTimer = null;

  let lastKnownAvatar = (() => {
    const raw = localStorage.getItem(LAST_AV_KEY);
    return raw === null ? null : raw;
  })();

  let lastCommandAt = -MIN_COMMAND_GAP_MS;
  let commandGeneration = 0;
  let commandTimer = null;
  let lastInputWarningAt = 0;

  function clearQueuedCommand() {
    if (!commandTimer) return;
    clearTimeout(commandTimer);
    commandTimer = null;
  }

  function bumpCommandGeneration() {
    commandGeneration = (commandGeneration + 1) % 1000000000;
    clearQueuedCommand();
  }

  // ==================== KEY LABEL ====================
  function keyLabel(code) {
    if (!code || code === 'NONE') return '--';
    const map = {
      ControlLeft: 'Ctrl',
      ControlRight: 'Ctrl',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift',
      AltLeft: 'Alt',
      AltRight: 'Alt',
      Space: 'Space',
      Tab: 'Tab',
      Escape: 'Esc',
      Quote: "'",
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Backslash: '\\'
    };
    if (map[code]) return map[code];
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'N').replace(/^Arrow/, '');
  }

  function bindConflicts(target, code, profileName = activeProfile) {
    if (!code || code === 'NONE') return [];
    const conflicts = [];

    if (target !== 'stop' && stopBindCode === code) conflicts.push('STOP');
    if (target !== 'auto' && autoBindCode === code) conflicts.push('LIST AUTO');
    if (target !== 'direction' && directionBindCode === code) conflicts.push('DIRECTION');
    if (target !== 'spamToggle' && spamToggleCode === code) conflicts.push('SPAM');
    if (target !== 'spamAction' && spamActionCode === code) conflicts.push('KICK');

    const movementTargets = [
      ['up', upKey, 'MOVE UP'],
      ['down', downKey, 'MOVE DOWN'],
      ['left', leftKey, 'MOVE LEFT'],
      ['right', rightKey, 'MOVE RIGHT']
    ];
    for (const [moveTarget, moveCode, label] of movementTargets) {
      if (target !== moveTarget && moveCode === code) conflicts.push(label);
    }

    for (const name of profileOrder) {
      const profile = profiles[name];
      if (!profile || profile.bindCode !== code) continue;
      if (target === 'profile' && name === profileName) continue;
      conflicts.push('Profile ' + name);
    }

    return conflicts;
  }

  function hasBindConflict(target, code, profileName = activeProfile) {
    return bindConflicts(target, code, profileName).length > 0;
  }

  function conflictTitle(target, code, baseTitle, profileName = activeProfile) {
    const conflicts = bindConflicts(target, code, profileName);
    if (!conflicts.length) return baseTitle;
    return baseTitle + ' | Conflict: ' + conflicts.join(', ');
  }

  function isModifierHeld(e) {
    return e.ctrlKey || e.altKey || e.metaKey;
  }

  function isTextTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  // ==================== PANEL ====================
  const panel = document.createElement('div');
  panel.id = 'hax-aas-panel';

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #hax-aas-panel * { box-sizing: border-box; }
    #hax-aas-panel {
      color-scheme: dark;
    }
    .aa-btn {
      background: #2a2a3e; border: 1px solid #555; color: #ccc;
      border-radius: 4px; padding: 3px 7px; cursor: pointer;
      font-size: 11px; font-family: monospace;
      white-space: nowrap; flex-shrink: 0; line-height: 1.25;
    }
    .aa-btn:hover { background: #35354f; border-color: #888; color: #fff; }
    .aa-btn.danger { border-color: #a03; color: #f77; }
    .aa-btn.danger:hover { background: #3a1020; }
    .aa-btn.active { background: #1a3a2a; border-color: #4ade80; color: #4ade80; }
    .aa-btn.warn { border-color: #b88724; color: #f0c060; }

    .aa-badge {
      font-family: monospace; background: #2a2a3e; border: 1px solid #666;
      width: 46px; min-width: 46px; text-align: center;
      border-radius: 4px; padding: 3px 0; cursor: pointer; font-size: 11px;
      color: #ccc; user-select: none; flex-shrink: 0;
      line-height: 1.25;
    }
    .aa-badge:hover { border-color: #aaa; color: #fff; }
    .aa-badge.rebinding {
      border-color: #f0c060 !important; color: #f0c060;
      background: #3a3020;
    }
    .aa-badge.empty { color: #555; border-style: dashed; }
    .aa-badge.conflict {
      border-color: #f77 !important;
      color: #ff9a9a !important;
      background: #3a1020 !important;
    }

    .aa-input {
      background: #1a1a2e; border: 1px solid #444; color: #eee;
      border-radius: 4px; font-size: 12px; outline: none;
      font-family: monospace;
    }
    .aa-input:focus { border-color: #6a8fff; }
    .aa-input.invalid,
    .aa-type-btn.invalid {
      border-color: #f77 !important;
      color: #ff9a9a !important;
      background: #3a1020 !important;
    }
    .aa-delay-label.invalid { color: #f77 !important; }

    .aa-section {
      border-top: 1px solid #2a2a3e;
      margin-top: 8px;
      padding-top: 8px;
    }
    .aa-label {
      font-size: 12px;
      color: #aeb4df;
      letter-spacing: .04em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .aa-panel-title {
      font-size: 11px;
      color: #d7dcff;
      font-weight: 800;
      letter-spacing: .06em;
      pointer-events: none;
    }
    .aa-mini-title {
      font-size: 10px;
      color: #aeb4df;
      font-weight: 700;
      letter-spacing: .08em;
      flex-shrink: 0;
    }
    .aa-mini-profile {
      font-size: 11px;
      color: #d7dcff;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }

    .aa-profile-list {
      display: flex; flex-direction: column; gap: 3px;
      overflow-y: auto; max-height: 99px;
      scrollbar-width: thin; scrollbar-color: #444 transparent;
      margin-bottom: 6px;
    }
    .aa-profile-list::-webkit-scrollbar,
    .aa-token-scroll::-webkit-scrollbar { width: 4px; }
    .aa-profile-list::-webkit-scrollbar-thumb,
    .aa-token-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .aa-profile-item {
      display: flex; align-items: center; gap: 4px;
      padding: 3px 5px; border-radius: 4px; cursor: pointer;
      border: 1px solid transparent; font-size: 11px; color: #d2d7f5;
      font-weight: 600; user-select: none;
    }
    .aa-profile-item:hover { background: #2a2a3e; }
    .aa-profile-item.active {
      background: #1a2a3a; border-color: #5ba5d6; color: #9de8ff; font-weight: 700;
    }
    .aa-profile-item .profile-name {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .aa-profile-key {
      min-width: 28px;
      max-width: 42px;
      padding: 1px 4px;
      border: 1px solid #555;
      border-radius: 3px;
      color: #cbd2ff;
      background: rgba(26,26,46,.75);
      font-size: 10px;
      font-weight: 800;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .aa-profile-key.empty { color: #555; border-style: dashed; }
    .aa-profile-key.conflict {
      border-color: #f77;
      color: #ff9a9a;
      background: #3a1020;
    }

    .aa-drag-grip {
      cursor: grab; color: #8f99dc; font-size: 0; font-weight: 800;
      flex-shrink: 0; padding: 0; user-select: none; line-height: 1;
      width: 9px; height: 12px; position: relative; display: inline-block;
    }
    .aa-drag-grip::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 3px;
      width: 6px;
      height: 6px;
      background-image: radial-gradient(circle, currentColor 1.05px, transparent 1.2px);
      background-size: 3px 3px;
      background-repeat: repeat;
    }
    .aa-drag-grip:hover { color: #c5ccff; }
    .aa-drag-grip:active { cursor: grabbing; }

    .aa-token-scroll {
      overflow-y: auto; max-height: 129px;
      scrollbar-width: thin; scrollbar-color: #444 transparent;
      padding-right: 2px;
    }
    .aa-token-grid {
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      gap: 5px;
      align-items: stretch;
    }
    .aa-token-cell {
      min-width: 0;
      min-height: 62px;
      border: 1px solid #353554;
      border-radius: 5px;
      background: rgba(26,26,46,.75);
      padding: 3px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .aa-token-cell.delay { border-color: #66512a; background: rgba(42,34,26,.72); }
    .aa-token-cell.delay.invalid { border-color: #f77; background: rgba(58,16,32,.72); }
    .aa-token-head {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }
    .aa-type-btn {
      border: 1px solid #555;
      background: #202038;
      color: #cbd2ff;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 800;
      font-family: monospace;
      padding: 1px 2px;
      cursor: pointer;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .aa-type-btn.delay { color: #f0c060; border-color: #80601d; background: #2a2418; }
    .aa-cell-delete {
      border: 1px solid #6a2a42;
      background: #2a1420;
      color: #f77;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 800;
      font-family: monospace;
      line-height: 1;
      padding: 1px 2px;
      cursor: pointer;
      flex-shrink: 0;
      margin-left: auto;
    }
    .aa-cell-input {
      width: 100%;
      height: 28px;
      text-align: center;
      padding: 0 3px;
      font-weight: 700;
      font-size: 13px;
    }
    .aa-cell-input.delay {
      color: #f0c060;
      font-size: 11px;
      appearance: textfield;
      -moz-appearance: textfield;
    }
    .aa-cell-input.delay::-webkit-outer-spin-button,
    .aa-cell-input.delay::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .aa-drop-placeholder {
      background: rgba(100,120,220,0.13);
      border: 1.5px dashed #6a8fff;
      border-radius: 4px;
      min-height: 62px;
    }
  `;
  document.head.appendChild(styleEl);

  // ==================== RENDER ====================
  function render() {
    const prevProfileScroll = panel.querySelector('.aa-profile-list')?.scrollTop ?? 0;
    const prevTokenScroll = panel.querySelector('.aa-token-scroll')?.scrollTop ?? 0;

    panel.innerHTML = '';
    panel.removeAttribute('style');
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: 99999,
      background: 'rgba(14,14,28,0.7)',
      color: '#ddd',
      border: '1px solid #383860',
      fontFamily: 'monospace, sans-serif',
      userSelect: 'none',
      borderRadius: '10px'
    });

    if (isMinimized) {
      Object.assign(panel.style, { padding: '6px 8px', fontSize: '11px', width: '180px' });
      const mini = mkEl('div', {
        id: 'aa-drag-handle',
        style: 'display:flex;flex-direction:column;gap:3px;cursor:grab;touch-action:none;min-width:0;'
      });
      const miniTop = mkEl('div', { style: 'display:flex;align-items:center;gap:6px;min-width:0;width:100%;' });
      miniTop.appendChild(mkEl('span', { className: 'aa-mini-title', textContent: 'AV+SPAM' }));
      miniTop.appendChild(mkEl('span', { className: 'aa-mini-profile', textContent: activeProfile, title: activeProfile }));
      const toggleBtn = mkEl('span', {
        id: 'aa-tog',
        textContent: '+',
        style: 'cursor:pointer;color:#d7dcff;font-size:14px;font-weight:900;line-height:1;flex-shrink:0;padding-left:4px;'
      });
      toggleBtn.onclick = toggleMinimize;
      miniTop.appendChild(toggleBtn);
      mini.appendChild(miniTop);
      const avatarLabel = avatarMode === 'direction' ? 'DIR' : (autoActive ? 'AUTO' : 'LIST');
      const avatarKey = avatarMode === 'direction' ? directionBindCode : autoBindCode;
      const nextAvatarKey = getProfile()?.bindCode || 'NONE';
      const miniInfo = mkEl('div', {
        style: 'display:grid;grid-template-columns:max-content 1fr;column-gap:10px;row-gap:2px;width:100%;'
      });
      [
        ['Tool: ' + (scriptEnabled ? 'RUN' : 'STOP') + ' (' + keyLabel(stopBindCode) + ')', scriptEnabled ? '#6f6' : '#f77'],
        ['Avatar: ' + avatarLabel + ' (' + keyLabel(avatarKey) + ')', avatarMode === 'direction' || autoActive ? '#6f6' : '#9de8ff'],
        ['Spam: ' + (spamEnabled ? 'ON' : 'OFF') + ' (' + keyLabel(spamToggleCode) + ')', spamEnabled ? '#6f6' : '#aeb4df'],
        ['Next avatar: (' + keyLabel(nextAvatarKey) + ')', nextAvatarKey && nextAvatarKey !== 'NONE' ? '#9de8ff' : '#aeb4df']
      ].forEach(([text, color], idx) => {
        miniInfo.appendChild(mkEl('div', {
          textContent: text,
          title: text,
          style: 'font-size:9px;color:' + color + ';font-weight:800;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;justify-self:' + (idx % 2 ? 'end' : 'start') + ';'
        }));
      });
      mini.appendChild(miniInfo);
      panel.appendChild(mini);
      setupDrag(panel, mini);
      applyPanelPosition(panel);
      return;
    }

    Object.assign(panel.style, { padding: '10px 12px', fontSize: '12px', width: '405px' });

    const header = mkEl('div', {
      id: 'aa-drag-handle',
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:grab;touch-action:none;padding-bottom:8px;border-bottom:1px solid #2a2a3e;'
    });
    header.appendChild(mkEl('span', { className: 'aa-panel-title', textContent: 'HAXBALL AUTO AVATAR + SPAM' }));
    const minimizeBtn = mkEl('span', {
      id: 'aa-tog',
      textContent: '-',
      style: 'cursor:pointer;color:#d7dcff;font-size:16px;font-weight:900;line-height:1;padding:0 2px;'
    });
    minimizeBtn.onclick = toggleMinimize;
    header.appendChild(minimizeBtn);
    panel.appendChild(header);
    setupDrag(panel, header);

    renderGlobalControls();
    renderDirectionControls();
    renderProfiles(prevProfileScroll);
    renderActiveProfile(prevTokenScroll);
    renderSpamControls();
    renderHint();

    applyPanelPosition(panel);
  }

  function renderGlobalControls() {
    const row = mkEl('div', {
      className: 'aa-section',
      style: 'display:flex;align-items:center;gap:5px;justify-content:space-between;'
    });

    const left = mkEl('div', { style: 'display:flex;align-items:center;gap:5px;min-width:0;' });
    left.appendChild(mkEl('span', { className: 'aa-label', textContent: 'State' }));
    const stateBtn = mkEl('button', {
      className: 'aa-btn ' + (scriptEnabled ? 'active' : 'danger'),
      textContent: scriptEnabled ? 'RUN' : 'STOP',
      title: 'Toggle script on/off'
    });
    stateBtn.onclick = () => setScriptEnabled(!scriptEnabled);
    left.appendChild(stateBtn);

    const autoBtn = mkEl('button', {
      className: 'aa-btn ' + (autoActive ? 'active' : ''),
      textContent: autoActive ? 'LIST AUTO ON' : 'LIST AUTO OFF',
      title: 'Toggle avatar-by-list auto for active profile'
    });
    autoBtn.onclick = toggleAutoForActiveProfile;
    left.appendChild(autoBtn);

    const right = mkEl('div', { style: 'display:flex;align-items:center;gap:4px;flex-shrink:0;' });
    right.appendChild(mkEl('span', { textContent: 'STOP', style: 'font-size:9px;color:#8f99dc;font-weight:800;' }));
    right.appendChild(makeKeyBadge('stop', stopBindCode, 'Bind stop/run key'));
    right.appendChild(mkEl('span', { textContent: 'LIST', style: 'font-size:9px;color:#8f99dc;font-weight:800;margin-left:2px;' }));
    right.appendChild(makeKeyBadge('auto', autoBindCode, 'Bind list auto key'));

    row.appendChild(left);
    row.appendChild(right);
    panel.appendChild(row);
  }

  function renderDirectionControls() {
    const section = mkEl('div', { className: 'aa-section' });

    const top = mkEl('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;' });
    const left = mkEl('div', { style: 'display:flex;align-items:center;gap:5px;min-width:0;' });
    left.appendChild(mkEl('span', { className: 'aa-label', textContent: 'Direction' }));
    const dirBtn = mkEl('button', {
      className: 'aa-btn ' + (avatarMode === 'direction' ? 'active' : ''),
      textContent: avatarMode === 'direction' ? 'DIR ON' : 'DIR OFF',
      title: 'Toggle avatar by movement direction'
    });
    dirBtn.onclick = toggleDirectionMode;
    left.appendChild(dirBtn);
    top.appendChild(left);

    const right = mkEl('div', { style: 'display:flex;align-items:center;gap:4px;flex-shrink:0;' });
    right.appendChild(mkEl('span', { textContent: 'DIR', style: 'font-size:9px;color:#8f99dc;font-weight:800;' }));
    right.appendChild(makeKeyBadge('direction', directionBindCode, 'Bind direction avatar key'));
    top.appendChild(right);
    section.appendChild(top);

    const moveGrid = mkEl('div', { style: 'display:grid;grid-template-columns:repeat(4,minmax(86px,1fr));gap:4px;width:100%;' });
    [
      ['up', 'UP', upKey],
      ['down', 'DOWN', downKey],
      ['left', 'LEFT', leftKey],
      ['right', 'RIGHT', rightKey]
    ].forEach(([target, label, code]) => {
      const box = mkEl('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:4px;background:rgba(26,26,46,.55);border:1px solid #333;border-radius:4px;padding:3px 4px;min-width:0;height:25px;' });
      box.appendChild(mkEl('span', { textContent: label, style: 'font-size:11px;color:#aeb4df;font-weight:800;flex-shrink:0;' }));
      box.appendChild(makeKeyBadge(target, code, 'Bind movement ' + label.toLowerCase() + ' key'));
      moveGrid.appendChild(box);
    });
    section.appendChild(moveGrid);

    const customHeader = mkEl('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px;'
    });
    customHeader.appendChild(mkEl('span', {
      textContent: 'Avatar custom',
      style: 'font-size:10px;color:#8f99dc;font-weight:800;text-transform:uppercase;'
    }));
    const customToggle = mkEl('button', {
      className: 'aa-btn',
      textContent: isDirectionCustomMinimized ? '+' : '-',
      title: isDirectionCustomMinimized ? 'Show default and direction avatar settings' : 'Hide default and direction avatar settings',
      style: 'padding:1px 7px;font-size:11px;line-height:1.2;'
    });
    customToggle.onclick = () => {
      isDirectionCustomMinimized = !isDirectionCustomMinimized;
      localStorage.setItem(DIRECTION_CUSTOM_MIN_KEY, isDirectionCustomMinimized ? 'true' : 'false');
      render();
    };
    customHeader.appendChild(customToggle);
    section.appendChild(customHeader);

    if (isDirectionCustomMinimized) {
      panel.appendChild(section);
      return;
    }

    const defaults = mkEl('div', { style: 'display:flex;align-items:center;gap:6px;justify-content:space-between;margin-top:6px;margin-bottom:6px;' });
    defaults.appendChild(mkEl('span', { textContent: 'Default avatar', style: 'font-size:11px;color:#aeb4df;font-weight:700;' }));
    const defaultInput = mkEl('input', {
      className: 'aa-input',
      type: 'text',
      value: defaultAvatarText,
      maxLength: 2,
      title: 'Avatar to restore when direction mode is turned off',
      style: 'width:42px;height:23px;text-align:center;font-weight:700;'
    });
    defaultInput.addEventListener('keydown', e => e.stopPropagation());
    defaultInput.addEventListener('input', () => {
      defaultAvatarText = defaultInput.value;
      localStorage.setItem(DEFAULT_AVATAR_KEY, defaultAvatarText);
    });
    defaults.appendChild(defaultInput);
    section.appendChild(defaults);

    const avatarLabel = mkEl('div', {
      textContent: 'Direction avatars',
      style: 'font-size:10px;color:#8f99dc;font-weight:800;text-transform:uppercase;margin:4px 0;'
    });
    section.appendChild(avatarLabel);

    const avatarGrid = mkEl('div', { style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;width:100%;' });
    DIRECTION_AVATAR_FIELDS.forEach(([dir, label]) => {
      const box = mkEl('div', {
        style: 'display:flex;align-items:center;gap:3px;background:rgba(26,26,46,.55);border:1px solid #333;border-radius:4px;padding:3px;min-width:0;height:27px;'
      });
      box.appendChild(mkEl('span', {
        textContent: label,
        title: label,
        style: 'font-size:11px;color:#aeb4df;font-weight:800;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
      }));
      const input = mkEl('input', {
        className: 'aa-input',
        type: 'text',
        value: directionAvatars[dir],
        title: 'Avatar for ' + label.toLowerCase(),
        style: 'width:31px;height:20px;text-align:center;font-weight:800;font-size:12px;padding:0;flex-shrink:0;'
      });
      input.addEventListener('keydown', e => e.stopPropagation());
      input.addEventListener('input', () => {
        saveDirectionAvatar(dir, input.value);
        if (avatarMode === 'direction' && currentDirection() === dir) updateDirectionAvatar(true);
      });
      box.appendChild(input);
      avatarGrid.appendChild(box);
    });
    section.appendChild(avatarGrid);
    panel.appendChild(section);
  }

  function renderSpamControls() {
    const section = mkEl('div', { className: 'aa-section' });

    const top = mkEl('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;' });
    const left = mkEl('div', { style: 'display:flex;align-items:center;gap:5px;min-width:0;' });
    left.appendChild(mkEl('span', { className: 'aa-label', textContent: 'Spam Kick' }));
    const spamBtn = mkEl('button', {
      className: 'aa-btn ' + (spamEnabled ? 'active' : ''),
      textContent: spamEnabled ? 'SPAM ON' : 'SPAM OFF',
      title: 'Toggle spam kick mode'
    });
    spamBtn.onclick = toggleSpamMode;
    left.appendChild(spamBtn);
    top.appendChild(left);

    const right = mkEl('div', { style: 'display:flex;align-items:center;gap:4px;flex-shrink:0;' });
    right.appendChild(mkEl('span', { textContent: 'SPAM', style: 'font-size:9px;color:#8f99dc;font-weight:800;' }));
    right.appendChild(makeKeyBadge('spamToggle', spamToggleCode, 'Bind spam toggle key'));
    right.appendChild(mkEl('span', { textContent: 'KICK', style: 'font-size:9px;color:#8f99dc;font-weight:800;margin-left:2px;' }));
    right.appendChild(makeKeyBadge('spamAction', spamActionCode, 'Bind kick/action key'));
    top.appendChild(right);
    section.appendChild(top);

    const delayRow = mkEl('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:6px;' });
    const spamDelayLabel = mkEl('span', {
      className: 'aa-delay-label',
      textContent: 'Rate (ms)',
      style: 'font-size:10px;color:#aeb4df;font-weight:700;text-transform:uppercase;'
    });
    delayRow.appendChild(spamDelayLabel);
    const spamDelayInput = mkEl('input', {
      className: 'aa-input',
      type: 'number',
      value: spamDelay,
      min: MIN_SPAM_DELAY_MS,
      title: 'Delay rate for spam kick. Minimum: 10ms.',
      style: 'width:64px;height:23px;text-align:center;color:#f0c060;font-weight:700;'
    });
    spamDelayInput.addEventListener('keydown', e => e.stopPropagation());
    spamDelayInput.addEventListener('input', () => {
      if (!isValidSpamDelayMs(spamDelayInput.value)) {
        spamDelayInput.classList.add('invalid');
        spamDelayLabel.classList.add('invalid');
        warnFastSpamDelay();
        return;
      }
      spamDelayInput.classList.remove('invalid');
      spamDelayLabel.classList.remove('invalid');
      spamDelay = asSpamDelayMs(spamDelayInput.value, spamDelay || DEFAULT_SPAM_DELAY_MS);
      localStorage.setItem(SPAM_DELAY_KEY, String(spamDelay));
      clearHint();
      if (spamActive) {
        stopSpam();
        startSpam();
      }
    });
    delayRow.appendChild(spamDelayInput);
    section.appendChild(delayRow);
    panel.appendChild(section);
  }

  function renderProfiles(prevProfileScroll) {
    const profileLabelRow = mkEl('div', {
      className: 'aa-section',
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'
    });
    profileLabelRow.appendChild(mkEl('span', { className: 'aa-label', textContent: 'Profiles' }));

    const actions = mkEl('div', { style: 'display:flex;gap:4px;align-items:center;' });
    const sortBtn = mkEl('button', { className: 'aa-btn', textContent: 'A-Z', title: 'Sort profiles A-Z' });
    sortBtn.onclick = () => {
      profileOrder.sort((a, b) => a.localeCompare(b));
      saveOrder(profileOrder);
      render();
    };
    actions.appendChild(sortBtn);

    const newBtn = mkEl('button', { className: 'aa-btn', textContent: '+', title: 'Create profile' });
    newBtn.onclick = () => {
      const name = prompt('New profile name:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();
      if (profiles[trimmed]) {
        alert('Profile already exists!');
        return;
      }
      profiles[trimmed] = {
        delay: getProfileDelay(),
        bindCode: 'NONE',
        cursor: 0,
        items: []
      };
      profileOrder.push(trimmed);
      activeProfile = trimmed;
      saveProfiles();
      saveOrder(profileOrder);
      saveActiveProfile();
      render();
    };
    actions.appendChild(newBtn);

    const renameBtn = mkEl('button', { className: 'aa-btn', textContent: 'Edit', title: 'Rename active profile' });
    renameBtn.onclick = () => {
      if (activeProfile === 'Default') {
        alert('Default profile cannot be renamed.');
        return;
      }
      const name = prompt('New profile name:', activeProfile);
      if (!name || !name.trim() || name.trim() === activeProfile) return;
      const trimmed = name.trim();
      if (profiles[trimmed]) {
        alert('Profile already exists!');
        return;
      }
      profiles[trimmed] = profiles[activeProfile];
      delete profiles[activeProfile];
      const idx = profileOrder.indexOf(activeProfile);
      if (idx !== -1) profileOrder[idx] = trimmed;
      if (autoProfile === activeProfile) autoProfile = trimmed;
      activeProfile = trimmed;
      saveProfiles();
      saveOrder(profileOrder);
      saveActiveProfile();
      render();
    };
    actions.appendChild(renameBtn);

    const deleteBtn = mkEl('button', { className: 'aa-btn danger', textContent: 'x', title: 'Delete active profile' });
    deleteBtn.onclick = () => {
      if (profileOrder.length <= 1) {
        alert('At least one profile is required.');
        return;
      }
      if (!confirm(`Delete profile "${activeProfile}"?`)) return;
      if (autoProfile === activeProfile) stopAuto(true);
      clearManualTimer(activeProfile);
      delete profiles[activeProfile];
      profileOrder = profileOrder.filter(name => name !== activeProfile);
      activeProfile = profileOrder[0];
      saveProfiles();
      saveOrder(profileOrder);
      saveActiveProfile();
      render();
    };
    actions.appendChild(deleteBtn);

    profileLabelRow.appendChild(actions);
    panel.appendChild(profileLabelRow);

    const profileList = mkEl('div', { className: 'aa-profile-list' });
    profileOrder.forEach((name) => {
      const item = mkEl('div', { className: 'aa-profile-item' + (name === activeProfile ? ' active' : '') });
      item.dataset.name = name;

      const grip = mkEl('span', { className: 'aa-drag-grip', textContent: '', title: 'Drag to reorder' });
      item.appendChild(grip);
      item.appendChild(mkEl('span', { className: 'profile-name', textContent: name, title: name }));

      const profileCode = profiles[name]?.bindCode || 'NONE';
      const profileConflict = hasBindConflict('profile', profileCode, name);
      item.appendChild(mkEl('span', {
        className: 'aa-profile-key' + ((!profileCode || profileCode === 'NONE') ? ' empty' : '') + (profileConflict ? ' conflict' : ''),
        textContent: keyLabel(profileCode),
        title: conflictTitle('profile', profileCode, 'Profile bind key', name)
      }));

      item.onclick = (e) => {
        if (e.target === grip) return;
        activeProfile = name;
        saveActiveProfile();
        render();
      };
      profileList.appendChild(item);
    });

    setupProfileDrag(profileList);
    panel.appendChild(profileList);
    profileList.scrollTop = prevProfileScroll;
  }

  function renderActiveProfile(prevTokenScroll) {
    const profile = getProfile();
    if (!profile) return;

    const controlRow = mkEl('div', {
      className: 'aa-section',
      style: 'display:flex;align-items:center;gap:6px;justify-content:space-between;'
    });
    controlRow.appendChild(mkEl('span', { className: 'aa-label', textContent: 'Profile' }));

    const controlRight = mkEl('div', { style: 'display:flex;align-items:center;gap:5px;' });
    controlRight.appendChild(makeKeyBadge('profile', profile.bindCode, 'Bind manual avatar key'));

    const delayLabel = mkEl('span', {
      className: 'aa-delay-label',
      textContent: 'Delay',
      style: 'font-size:10px;color:#aeb4df;font-weight:700;text-transform:uppercase;'
    });
    controlRight.appendChild(delayLabel);

    const delayInput = mkEl('input', {
      className: 'aa-input',
      type: 'number',
      value: profile.delay,
      min: MIN_DELAY_MS,
      title: 'Delay between adjacent avatar commands in milliseconds. Minimum: 100ms.',
      style: 'width:58px;height:23px;text-align:center;color:#f0c060;font-weight:700;'
    });
    delayInput.addEventListener('keydown', e => e.stopPropagation());
    delayInput.addEventListener('input', () => {
      if (!isValidDelayMs(delayInput.value)) {
        delayInput.classList.add('invalid');
        delayLabel.classList.add('invalid');
        warnFastDelay();
        return;
      }
      delayInput.classList.remove('invalid');
      delayLabel.classList.remove('invalid');
      profile.delay = asDelayMs(delayInput.value, profile.delay || DEFAULT_DELAY_MS);
      saveProfiles();
    });
    controlRight.appendChild(delayInput);

    controlRow.appendChild(controlRight);
    panel.appendChild(controlRow);

    const seqHeader = mkEl('div', {
      style: 'display:flex;align-items:center;justify-content:space-between;margin:7px 0 5px;'
    });
    seqHeader.appendChild(mkEl('span', { className: 'aa-label', textContent: 'Avatar List' }));

    const actions = mkEl('div', { style: 'display:flex;align-items:center;gap:4px;' });
    const addAvatarBtn = mkEl('button', { className: 'aa-btn', textContent: '+ AV', title: 'Add avatar cell' });
    addAvatarBtn.onclick = () => {
      profile.items.push({ type: 'avatar', value: '' });
      saveProfiles();
      render();
      scrollTokensToEnd();
    };
    actions.appendChild(addAvatarBtn);

    const addDelayBtn = mkEl('button', { className: 'aa-btn warn', textContent: '+ MS', title: 'Add delay block' });
    addDelayBtn.onclick = () => {
      profile.items.push({ type: 'delay', value: String(getProfileDelay()) });
      saveProfiles();
      render();
      scrollTokensToEnd();
    };
    actions.appendChild(addDelayBtn);

    const resetBtn = mkEl('button', { className: 'aa-btn', textContent: 'Reset', title: 'Reset next avatar to the first cell' });
    resetBtn.onclick = () => {
      profile.cursor = 0;
      saveProfiles();
      setHint('Next avatar reset.', '#6f6');
    };
    actions.appendChild(resetBtn);

    seqHeader.appendChild(actions);
    panel.appendChild(seqHeader);

    const scrollBox = mkEl('div', { className: 'aa-token-scroll' });
    const grid = mkEl('div', { className: 'aa-token-grid' });

    profile.items.forEach((item, idx) => {
      grid.appendChild(renderTokenCell(profile, item, idx));
    });

    if (profile.items.length === 0) {
      const empty = mkEl('div', {
        style: 'grid-column:1/-1;font-size:11px;color:#555;text-align:center;padding:10px 0;border:1px dashed #333;border-radius:5px;',
        textContent: 'No cells yet. Add AV or MS blocks.'
      });
      grid.appendChild(empty);
    }

    setupTokenDrag(grid);
    scrollBox.appendChild(grid);
    panel.appendChild(scrollBox);
    scrollBox.scrollTop = prevTokenScroll;
  }

  function renderTokenCell(profile, item, idx) {
    const isDelay = item.type === 'delay';
    const isFastDelay = isDelay && !isValidDelayMs(item.value);
    const cell = mkEl('div', {
      className: 'aa-token-cell' + (isDelay ? ' delay' : '') + (isFastDelay ? ' invalid' : '')
    });
    cell.dataset.idx = idx;

    const head = mkEl('div', { className: 'aa-token-head' });
    head.appendChild(mkEl('span', { className: 'aa-drag-grip', textContent: '', title: 'Drag to reorder' }));

    const typeBtn = mkEl('button', {
      className: 'aa-type-btn' + (isDelay ? ' delay' : '') + (isFastDelay ? ' invalid' : ''),
      textContent: isDelay ? 'MS' : 'AV',
      title: 'Toggle cell type'
    });
    typeBtn.onclick = () => {
      item.type = isDelay ? 'avatar' : 'delay';
      item.value = item.type === 'delay' ? String(getProfileDelay()) : '';
      saveProfiles();
      render();
    };
    head.appendChild(typeBtn);

    const delBtn = mkEl('button', { className: 'aa-cell-delete', textContent: 'x', title: 'Delete cell' });
    delBtn.onclick = () => {
      profile.items.splice(idx, 1);
      if (profile.cursor >= profile.items.length) profile.cursor = 0;
      saveProfiles();
      render();
    };
    head.appendChild(delBtn);
    cell.appendChild(head);

    const input = mkEl('input', {
      className: 'aa-input aa-cell-input' + (isDelay ? ' delay' : '') + (isFastDelay ? ' invalid' : ''),
      type: isDelay ? 'number' : 'text',
      value: item.value,
      min: isDelay ? MIN_DELAY_MS : undefined,
      placeholder: isDelay ? 'ms' : 'icon',
      title: isDelay ? 'Delay block in milliseconds. Minimum: 100ms.' : 'Avatar: one icon or up to two letters'
    });
    input.addEventListener('keydown', e => e.stopPropagation());
    input.addEventListener('input', () => {
      if (isDelay && !isValidDelayMs(input.value)) {
        input.classList.add('invalid');
        typeBtn.classList.add('invalid');
        cell.classList.add('invalid');
        warnFastDelay();
        return;
      }
      input.classList.remove('invalid');
      typeBtn.classList.remove('invalid');
      cell.classList.remove('invalid');
      item.value = isDelay ? String(asDelayMs(input.value, item.value || getProfileDelay())) : input.value;
      saveProfiles();
    });
    cell.appendChild(input);

    return cell;
  }

  function renderHint() {
    const hint = mkEl('div', {
      id: 'aa-hint',
      style: 'font-size:10px;color:#f0c060;height:13px;margin-top:6px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
    });
    if (rebindTarget) {
      hint.textContent = 'Press a key - ESC to cancel';
    } else if (!scriptEnabled) {
      hint.textContent = 'Stopped: avatar commands are blocked';
    } else if (avatarMode === 'direction') {
      hint.textContent = 'Direction avatar mode is active';
      hint.style.color = '#6f6';
    } else if (autoActive) {
      hint.textContent = 'List auto running: ' + autoProfile;
      hint.style.color = '#6f6';
    } else if (spamEnabled) {
      hint.textContent = 'Spam kick armed';
      hint.style.color = '#6f6';
    }
    panel.appendChild(hint);
  }

  function scrollTokensToEnd() {
    setTimeout(() => {
      const sc = panel.querySelector('.aa-token-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    }, 0);
  }

  function makeKeyBadge(target, code, title, profileName = activeProfile) {
    const isThisRebinding = rebindTarget === target;
    const hasConflict = hasBindConflict(target, code, profileName);
    const badge = mkEl('span', {
      className: 'aa-badge'
        + (isThisRebinding ? ' rebinding' : '')
        + ((!code || code === 'NONE') && !isThisRebinding ? ' empty' : '')
        + (hasConflict && !isThisRebinding ? ' conflict' : ''),
      textContent: isThisRebinding ? '...' : keyLabel(code),
      title: conflictTitle(target, code, title, profileName)
    });
    badge.addEventListener('mousedown', e => e.preventDefault());
    badge.addEventListener('click', e => {
      e.stopPropagation();
      startRebind(target);
    });
    badge.addEventListener('dblclick', e => {
      e.stopPropagation();
      clearBind(target);
    });
    return badge;
  }

  // ==================== DRAG HELPERS ====================
  function setupDragList(listEl, itemSelector, onDrop, mode = 'vertical') {
    listEl.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.aa-drag-grip');
      if (!grip) return;
      const item = grip.closest(itemSelector);
      if (!item) return;
      e.preventDefault();

      const allItems = () => [...listEl.querySelectorAll(itemSelector)];
      const fromIdx = allItems().indexOf(item);
      const itemRect = item.getBoundingClientRect();
      const itemStyle = getComputedStyle(item);
      const itemH = item.offsetHeight;
      const itemW = item.offsetWidth;
      const pointerOffsetX = e.clientX - itemRect.left;
      const pointerOffsetY = e.clientY - itemRect.top;

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
        cursor: 'grabbing',
        fontFamily: itemStyle.fontFamily,
        fontSize: itemStyle.fontSize,
        fontWeight: itemStyle.fontWeight,
        lineHeight: itemStyle.lineHeight,
        color: itemStyle.color
      });
      document.body.appendChild(dragEl);

      const ph = mkEl('div', { className: 'aa-drop-placeholder' });
      Object.assign(ph.style, {
        height: itemH + 'px',
        minHeight: itemH + 'px',
        marginBottom: itemStyle.marginBottom
      });
      item.replaceWith(ph);
      document.body.style.cursor = 'grabbing';

      const moveGhost = (x, y) => {
        dragEl.style.left = (x - pointerOffsetX) + 'px';
        dragEl.style.top = (y - pointerOffsetY) + 'px';
      };
      moveGhost(e.clientX, e.clientY);
      listEl.setPointerCapture(e.pointerId);

      listEl.addEventListener('pointermove', onMove);
      listEl.addEventListener('pointerup', onUp);
      listEl.addEventListener('pointercancel', onUp);

      function shouldInsertBefore(pointerEvent, rect) {
        if (mode !== 'grid') return pointerEvent.clientY < rect.top + rect.height / 2;
        if (pointerEvent.clientY < rect.top) return true;
        if (pointerEvent.clientY > rect.bottom) return false;
        return pointerEvent.clientX < rect.left + rect.width / 2;
      }

      function onMove(me) {
        moveGhost(me.clientX, me.clientY);
        const items = allItems();
        let inserted = false;
        for (const it of items) {
          const rect = it.getBoundingClientRect();
          if (shouldInsertBefore(me, rect)) {
            listEl.insertBefore(ph, it);
            inserted = true;
            break;
          }
        }
        if (!inserted) listEl.appendChild(ph);
      }

      function onUp() {
        const scrollTop = listEl.closest('.aa-token-scroll, .aa-profile-list')?.scrollTop ?? listEl.scrollTop;
        listEl.releasePointerCapture(e.pointerId);
        listEl.removeEventListener('pointermove', onMove);
        listEl.removeEventListener('pointerup', onUp);
        listEl.removeEventListener('pointercancel', onUp);
        dragEl.remove();
        document.body.style.cursor = '';

        const toIdx = allItems().filter(it => {
          return ph.compareDocumentPosition(it) & Node.DOCUMENT_POSITION_PRECEDING;
        }).length;

        ph.remove();
        onDrop(fromIdx, toIdx, { scrollTop });
      }
    });
  }

  function setupProfileDrag(listEl) {
    setupDragList(listEl, '.aa-profile-item', (fromIdx, toIdx, meta) => {
      const moved = profileOrder.splice(fromIdx, 1)[0];
      profileOrder.splice(toIdx, 0, moved);
      saveOrder(profileOrder);
      render();
      restoreListScroll('.aa-profile-list', meta.scrollTop);
    }, 'vertical');
  }

  function setupTokenDrag(gridEl) {
    setupDragList(gridEl, '.aa-token-cell', (fromIdx, toIdx, meta) => {
      const items = getItems();
      const moved = items.splice(fromIdx, 1)[0];
      items.splice(toIdx, 0, moved);
      getProfile().cursor = Math.min(getProfile().cursor, Math.max(0, items.length - 1));
      saveProfiles();
      render();
      restoreListScroll('.aa-token-scroll', meta.scrollTop);
    }, 'grid');
  }

  function restoreListScroll(selector, scrollTop) {
    const restore = () => {
      const list = panel.querySelector(selector);
      if (list) list.scrollTop = scrollTop;
    };
    restore();
    requestAnimationFrame(restore);
  }

  function setupDrag(panelEl, handleEl) {
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.target.id === 'aa-tog') return;
      if (e.button !== 0) return;
      handleEl.setPointerCapture(e.pointerId);

      const rect = panelEl.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;

      panelEl.style.bottom = '';
      panelEl.style.right = '';
      panelEl.style.left = startLeft + 'px';
      panelEl.style.top = startTop + 'px';
      document.body.style.userSelect = 'none';
      handleEl.style.cursor = 'grabbing';

      function onMove(me) {
        let nextLeft = startLeft + (me.clientX - startX);
        let nextTop = startTop + (me.clientY - startY);
        nextLeft = Math.max(0, Math.min(window.innerWidth - panelEl.offsetWidth, nextLeft));
        nextTop = Math.max(0, Math.min(window.innerHeight - panelEl.offsetHeight, nextTop));
        panelEl.style.left = nextLeft + 'px';
        panelEl.style.top = nextTop + 'px';
      }

      function onUp(ue) {
        handleEl.releasePointerCapture(ue.pointerId);
        handleEl.style.cursor = 'grab';
        document.body.style.userSelect = '';
        handleEl.removeEventListener('pointermove', onMove);
        handleEl.removeEventListener('pointerup', onUp);
        handleEl.removeEventListener('pointercancel', onUp);
        saveCurrentPosition(panelEl);
      }

      handleEl.addEventListener('pointermove', onMove);
      handleEl.addEventListener('pointerup', onUp);
      handleEl.addEventListener('pointercancel', onUp);
      e.preventDefault();
    });
  }

  // ==================== REBIND ====================
  function startRebind(target) {
    rebindTarget = target;
    render();
  }

  function cancelRebind() {
    rebindTarget = null;
    render();
  }

  function clearBind(target) {
    if (target === 'profile') {
      getProfile().bindCode = 'NONE';
      saveProfiles();
    } else if (target === 'stop') {
      stopBindCode = 'NONE';
      saveKey(STOP_KEY, stopBindCode);
    } else if (target === 'auto') {
      autoBindCode = 'NONE';
      saveKey(AUTO_KEY, autoBindCode);
    } else if (target === 'direction') {
      directionBindCode = 'NONE';
      saveKey(DIRECTION_KEY, directionBindCode);
    } else if (target === 'spamToggle') {
      spamToggleCode = 'NONE';
      saveKey(SPAM_TOGGLE_KEY, spamToggleCode);
    } else if (target === 'spamAction') {
      spamActionCode = 'NONE';
      saveKey(SPAM_ACTION_KEY, spamActionCode);
    } else if (target === 'up') {
      upKey = 'NONE';
      saveKey(UP_KEY, upKey);
    } else if (target === 'down') {
      downKey = 'NONE';
      saveKey(DOWN_KEY, downKey);
    } else if (target === 'left') {
      leftKey = 'NONE';
      saveKey(LEFT_KEY, leftKey);
    } else if (target === 'right') {
      rightKey = 'NONE';
      saveKey(RIGHT_KEY, rightKey);
    }
    if (rebindTarget === target) rebindTarget = null;
    render();
  }

  function finishRebind(code) {
    if (!rebindTarget) return;
    const target = rebindTarget;
    rebindTarget = null;
    let message = 'Canceled.';
    let color = '#888';
    if (code !== 'Escape') {
      const conflicts = bindConflicts(target, code, activeProfile);
      if (conflicts.length) {
        render();
        setHint('Key ' + keyLabel(code) + ' bi trung voi ' + conflicts.join(', ') + '.', '#f77');
        return;
      }
      if (target === 'profile') {
        getProfile().bindCode = code;
        saveProfiles();
      } else if (target === 'stop') {
        stopBindCode = code;
        saveKey(STOP_KEY, code);
      } else if (target === 'auto') {
        autoBindCode = code;
        saveKey(AUTO_KEY, code);
      } else if (target === 'direction') {
        directionBindCode = code;
        saveKey(DIRECTION_KEY, code);
      } else if (target === 'spamToggle') {
        spamToggleCode = code;
        saveKey(SPAM_TOGGLE_KEY, code);
      } else if (target === 'spamAction') {
        spamActionCode = code;
        saveKey(SPAM_ACTION_KEY, code);
      } else if (target === 'up') {
        upKey = code;
        saveKey(UP_KEY, code);
      } else if (target === 'down') {
        downKey = code;
        saveKey(DOWN_KEY, code);
      } else if (target === 'left') {
        leftKey = code;
        saveKey(LEFT_KEY, code);
      } else if (target === 'right') {
        rightKey = code;
        saveKey(RIGHT_KEY, code);
      }
      if (['up', 'down', 'left', 'right'].includes(target)) {
        lastDirection = '';
        if (avatarMode === 'direction') updateDirectionAvatar(true);
      }
      message = 'Saved key: ' + keyLabel(code);
      color = '#6f6';
    }
    render();
    setHint(message, color);
  }

  // ==================== SEQUENCE ENGINE ====================
  function nextSequenceEffect(profileName) {
    const profile = getProfile(profileName);
    if (!profile || !profile.items.length || !hasPlayableAvatar(profile)) return null;

    const len = profile.items.length;
    profile.cursor = asNonNegativeInt(profile.cursor, 0) % len;

    for (let attempt = 0; attempt < len; attempt++) {
      const idx = profile.cursor % len;
      const item = profile.items[idx];
      profile.cursor = (idx + 1) % len;

      if (item.type === 'delay') {
        return { type: 'delay', ms: asDelayMs(item.value, getProfileDelay(profileName)) };
      }

      const value = String(item.value || '').trim();
      if (value) {
        return { type: 'avatar', value };
      }
    }

    return null;
  }

  function nextPlayableType(profileName) {
    const profile = getProfile(profileName);
    if (!profile || !profile.items.length || !hasPlayableAvatar(profile)) return null;

    const len = profile.items.length;
    let cursor = asNonNegativeInt(profile.cursor, 0) % len;
    for (let attempt = 0; attempt < len; attempt++) {
      const item = profile.items[cursor % len];
      cursor = (cursor + 1) % len;
      if (item.type === 'delay') return 'delay';
      if (String(item.value || '').trim()) return 'avatar';
    }
    return null;
  }

  function waitAfterAvatar(profileName) {
    return nextPlayableType(profileName) === 'delay' ? 0 : getProfileDelay(profileName);
  }

  function profileNameForBind(code) {
    if (!code || code === 'NONE') return null;
    for (const name of profileOrder) {
      const profile = profiles[name];
      if (profile?.bindCode && profile.bindCode !== 'NONE' && profile.bindCode === code) return name;
    }
    return null;
  }

  function setAvatarMode(mode, restoreDefault) {
    const nextMode = mode === 'direction' ? 'direction' : 'list';
    const wasDirection = avatarMode === 'direction';
    if (avatarMode !== nextMode) bumpCommandGeneration();
    avatarMode = nextMode;
    localStorage.setItem(AVATAR_MODE_KEY, avatarMode);

    if (avatarMode === 'direction') {
      stopAuto(false);
      clearAllManualTimers();
      lastDirection = '';
      updateDirectionAvatar(true);
    } else {
      if (directionTimer) {
        clearTimeout(directionTimer);
        directionTimer = null;
      }
      lastDirection = '';
      if (restoreDefault && wasDirection && scriptEnabled) applyDefaultAvatar();
    }
  }

  function toggleDirectionMode() {
    if (!scriptEnabled) {
      setHint('Script is stopped.', '#f77');
      return;
    }
    setAvatarMode(avatarMode === 'direction' ? 'list' : 'direction', true);
    render();
  }

  function triggerProfileBind(profileName) {
    const profile = getProfile(profileName);
    if (!profile) return false;

    if (autoActive && avatarMode === 'list') {
      bumpCommandGeneration();
      clearAllManualTimers();
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      activeProfile = profileName;
      autoProfile = profileName;
      profile.cursor = 0;
      saveActiveProfile();
      render();
      runAutoStep();
      return true;
    }

    const shouldReset = avatarMode !== 'list' || activeProfile !== profileName;
    if (avatarMode !== 'list') setAvatarMode('list', false);

    if (shouldReset) {
      clearAllManualTimers();
      activeProfile = profileName;
      profile.cursor = 0;
      saveActiveProfile();
      render();
    }

    triggerManualStep(profileName);
    return true;
  }

  function triggerManualStep(profileName) {
    if (!scriptEnabled || avatarMode !== 'list' || manualTimers.has(profileName) || autoActive) return;
    runManualStep(profileName);
  }

  function isManualProfileHeld(profileName) {
    const code = getProfile(profileName)?.bindCode;
    return !!code && code !== 'NONE' && heldProfileBindCodes.has(code);
  }

  function scheduleManualNext(profileName, wait) {
    const timer = setTimeout(() => {
      manualTimers.delete(profileName);
      if (isManualProfileHeld(profileName)) runManualStep(profileName);
    }, Math.max(0, wait));
    manualTimers.set(profileName, timer);
  }

  function runManualStep(profileName) {
    if (!scriptEnabled) {
      clearManualTimer(profileName);
      return;
    }
    if (isUserTyping()) {
      const timer = setTimeout(() => {
        manualTimers.delete(profileName);
        if (isManualProfileHeld(profileName)) runManualStep(profileName);
      }, CHAT_FOCUS_RETRY_MS);
      manualTimers.set(profileName, timer);
      return;
    }

    const effect = nextSequenceEffect(profileName);
    if (!effect) {
      setHint('No avatar cells in this profile.', '#f77');
      clearManualTimer(profileName);
      return;
    }

    if (effect.type === 'delay') {
      scheduleManualNext(profileName, effect.ms);
      return;
    }

    sendAvatarValue(effect.value);
    const wait = waitAfterAvatar(profileName);
    if (wait > 0 || isManualProfileHeld(profileName)) scheduleManualNext(profileName, wait);
  }

  function startAuto(profileName) {
    if (!scriptEnabled) {
      setHint('Script is stopped.', '#f77');
      return;
    }
    const profile = getProfile(profileName);
    if (!hasPlayableAvatar(profile)) {
      setHint('No avatar cells in this profile.', '#f77');
      return;
    }
    if (avatarMode !== 'list') setAvatarMode('list', false);
    bumpCommandGeneration();
    clearAllManualTimers();
    if (autoActive) stopAuto(true);
    autoActive = true;
    autoProfile = profileName;
    render();
    runAutoStep();
  }

  function stopAuto(restoreAvatar) {
    if (autoActive || autoTimer) bumpCommandGeneration();
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    autoActive = false;
    autoProfile = null;
    render();
    if (restoreAvatar && scriptEnabled) applyDefaultAvatar();
  }

  function runAutoStep() {
    if (!autoActive || !scriptEnabled || avatarMode !== 'list' || !autoProfile) return;
    if (isUserTyping()) {
      autoTimer = setTimeout(runAutoStep, CHAT_FOCUS_RETRY_MS);
      return;
    }
    const effect = nextSequenceEffect(autoProfile);
    if (!effect) {
      stopAuto(false);
      setHint('Auto stopped: no avatar cells.', '#f77');
      return;
    }

    if (effect.type === 'delay') {
      autoTimer = setTimeout(runAutoStep, effect.ms);
      return;
    }

    sendAvatarValue(effect.value);
    autoTimer = setTimeout(runAutoStep, waitAfterAvatar(autoProfile));
  }

  function toggleAutoForActiveProfile() {
    if (autoActive && autoProfile === activeProfile) {
      stopAuto(true);
      return;
    }
    startAuto(activeProfile);
  }

  function setScriptEnabled(enabled) {
    const nextEnabled = !!enabled;
    const shouldRestoreDefault = scriptEnabled && !nextEnabled;
    scriptEnabled = nextEnabled;
    localStorage.setItem(ENABLED_KEY, scriptEnabled ? 'true' : 'false');
    if (!scriptEnabled) {
      bumpCommandGeneration();
      stopAuto(false);
      clearAllManualTimers();
      stopSpam();
      if (directionTimer) {
        clearTimeout(directionTimer);
        directionTimer = null;
      }
      lastDirection = '';
      if (shouldRestoreDefault) applyDefaultAvatar(true);
    } else {
      if (avatarMode === 'direction') updateDirectionAvatar(true);
      if (spamEnabled) startSpam();
    }
    render();
  }

  function clearManualTimer(profileName) {
    const timer = manualTimers.get(profileName);
    if (timer) clearTimeout(timer);
    manualTimers.delete(profileName);
  }

  function clearAllManualTimers() {
    for (const timer of manualTimers.values()) clearTimeout(timer);
    manualTimers.clear();
  }

  function releaseProfileBindKey(code) {
    if (!code || !heldProfileBindCodes.has(code)) return;
    heldProfileBindCodes.delete(code);
  }

  // ==================== GAME COMMANDS ====================
  const heldKeys = new Set();

  function getMovementKeys() {
    return new Set([
      upKey, downKey, leftKey, rightKey,
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
    ].filter(code => code && code !== 'NONE'));
  }

  function getFrame() {
    return document.querySelector('iframe.gameframe');
  }

  function getFrameDoc() {
    return getFrame()?.contentDocument ?? null;
  }

  function getInput() {
    return getFrameDoc()?.querySelector('input[data-hook="input"]');
  }

  function getCanvas() {
    return getFrameDoc()?.querySelector('canvas');
  }

  function isGameChatFocused() {
    const doc = getFrameDoc();
    const input = doc?.querySelector('input[data-hook="input"]');
    return !!input && doc?.activeElement === input;
  }

  function isUserTyping() {
    return isTextTarget(document.activeElement) || isGameChatFocused();
  }

  function setLastKnownAvatar(value) {
    lastKnownAvatar = value;
  }

  function sendAvatarValue(value) {
    const avatar = String(value ?? '').trim();
    if (!avatar) return false;
    return queueCommand('/avatar ' + avatar, () => setLastKnownAvatar(avatar));
  }

  function applyDefaultAvatar(force = false) {
    const avatar = String(defaultAvatarText || '').trim();
    const command = avatar ? '/avatar ' + avatar : '/clear_avatar';
    const onSuccess = () => setLastKnownAvatar(avatar);
    if (isUserTyping()) {
      setTimeout(() => applyDefaultAvatar(force), CHAT_FOCUS_RETRY_MS);
      return true;
    }
    if (force) {
      const sent = dispatchCommand(command);
      if (sent) onSuccess();
      else if (isUserTyping()) setTimeout(() => applyDefaultAvatar(force), CHAT_FOCUS_RETRY_MS);
      return sent;
    }
    return queueCommand(command, onSuccess);
  }

  function currentDirection() {
    const up = heldKeys.has(upKey) || heldKeys.has('ArrowUp');
    const down = heldKeys.has(downKey) || heldKeys.has('ArrowDown');
    const left = heldKeys.has(leftKey) || heldKeys.has('ArrowLeft');
    const right = heldKeys.has(rightKey) || heldKeys.has('ArrowRight');
    if (up && right) return 'up-right';
    if (up && left) return 'up-left';
    if (down && right) return 'down-right';
    if (down && left) return 'down-left';
    if (up) return 'up';
    if (down) return 'down';
    if (left) return 'left';
    if (right) return 'right';
    return 'idle';
  }

  function updateDirectionAvatar(force = false) {
    if (!scriptEnabled || avatarMode !== 'direction') return;
    if (isUserTyping()) return;

    const direction = currentDirection();
    if (!force && direction === lastDirection) return;

    const applyDirection = () => {
      directionTimer = null;
      if (!scriptEnabled || avatarMode !== 'direction') return;
      const latestDirection = currentDirection();
      if (!force && latestDirection === lastDirection) return;
      lastDirection = latestDirection;
      lastDirectionCommandAt = performance.now();
      sendAvatarValue(directionAvatars[latestDirection]);
    };

    const elapsed = performance.now() - lastDirectionCommandAt;
    if (force || elapsed >= DIRECTION_THROTTLE_MS) {
      if (directionTimer) {
        clearTimeout(directionTimer);
        directionTimer = null;
      }
      lastDirection = direction;
      lastDirectionCommandAt = performance.now();
      sendAvatarValue(directionAvatars[direction]);
      return;
    }

    if (directionTimer) clearTimeout(directionTimer);
    directionTimer = setTimeout(applyDirection, DIRECTION_THROTTLE_MS - elapsed);
  }

  function dispatchCanvasKey(type, code) {
    const canvas = getCanvas();
    if (!canvas || !code || code === 'NONE') return false;
    canvas.dispatchEvent(new KeyboardEvent(type, {
      code,
      key: code.replace(/^Key/, '').replace(/^Digit/, '').toLowerCase(),
      bubbles: true,
      cancelable: true
    }));
    return true;
  }

  function startSpam() {
    if (spamActive || !scriptEnabled || !spamEnabled || !heldKeys.has(spamActionCode)) return;
    if (getFrameDoc()?.activeElement === getInput()) return;
    spamActive = true;

    const loop = () => {
      if (!spamActive || !scriptEnabled || !spamEnabled || !heldKeys.has(spamActionCode)) {
        stopSpam();
        return;
      }
      dispatchCanvasKey('keyup', spamActionCode);
      const rate = asSpamDelayMs(spamDelay, DEFAULT_SPAM_DELAY_MS);
      const repressDelay = Math.min(30, Math.max(4, Math.floor(rate * 0.4)));
      if (spamPressTimer) clearTimeout(spamPressTimer);
      spamPressTimer = setTimeout(() => {
        spamPressTimer = null;
        if (!spamActive || !scriptEnabled || !spamEnabled || !heldKeys.has(spamActionCode)) {
          stopSpam();
          return;
        }
        dispatchCanvasKey('keydown', spamActionCode);
      }, repressDelay);
    };

    loop();
    spamTimer = setInterval(loop, asSpamDelayMs(spamDelay, DEFAULT_SPAM_DELAY_MS));
  }

  function stopSpam() {
    if (spamTimer) {
      clearInterval(spamTimer);
      spamTimer = null;
    }
    if (spamPressTimer) {
      clearTimeout(spamPressTimer);
      spamPressTimer = null;
    }
    const wasActive = spamActive;
    spamActive = false;
    if (wasActive && heldKeys.has(spamActionCode)) dispatchCanvasKey('keydown', spamActionCode);
  }

  function toggleSpamMode() {
    if (!scriptEnabled) {
      setHint('Script is stopped.', '#f77');
      return;
    }
    spamEnabled = !spamEnabled;
    if (!spamEnabled) stopSpam();
    else startSpam();
    render();
  }

  function queueCommand(text, onSuccess, generation = commandGeneration) {
    if (generation !== commandGeneration) return false;
    if (!scriptEnabled) return false;

    const attemptSend = () => {
      commandTimer = null;
      if (generation !== commandGeneration || !scriptEnabled) return false;

      if (isUserTyping()) {
        commandTimer = setTimeout(attemptSend, CHAT_FOCUS_RETRY_MS);
        return true;
      }

      const now = performance.now();
      const wait = Math.max(0, MIN_COMMAND_GAP_MS - (now - lastCommandAt));
      if (wait > 0) {
        commandTimer = setTimeout(attemptSend, wait);
        return true;
      }

      const sent = dispatchCommand(text);
      if (sent) {
        lastCommandAt = performance.now();
        if (onSuccess) onSuccess();
      }
      return sent;
    };

    clearQueuedCommand();
    return attemptSend();
  }

  function dispatchCommand(text) {
    const frame = getFrame();
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    const input = doc?.querySelector('input[data-hook="input"]');
    const canvas = doc?.querySelector('canvas');
    if (!frame || !doc || !win || !input || !canvas) {
      const now = performance.now();
      if (now - lastInputWarningAt > 1200) {
        lastInputWarningAt = now;
        setHint('Game input not found.', '#f77');
      }
      return false;
    }
    if (doc.activeElement === input || isTextTarget(document.activeElement)) return false;

    const nativeSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
    if (!nativeSetter) return false;

    nativeSetter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
      keyCode: 13,
      code: 'Enter',
      key: 'Enter',
      bubbles: true,
      cancelable: true
    }));

    if (doc.activeElement !== canvas) canvas.focus();
    setTimeout(() => {
      const movementKeys = getMovementKeys();
      heldKeys.forEach(code => {
        if (movementKeys.has(code)) {
          canvas.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
        }
      });
    }, 0);
    return true;
  }

  function recordAvatarCommand(text) {
    const command = String(text || '').trim();
    const avatarMatch = command.match(/^\/avatar\s+(.+)$/i);
    if (avatarMatch) {
      setLastKnownAvatar(avatarMatch[1].trim());
      return;
    }
    if (/^\/clear_avatar\b/i.test(command)) setLastKnownAvatar('');
  }

  // ==================== KEY HANDLERS ====================
  function handleKeyDown(e) {
    if (!e.isTrusted) return false;

    if (rebindTarget) {
      if (isModifierHeld(e)) return false;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      finishRebind(e.code || 'NONE');
      return true;
    }

    if (isTextTarget(e.target) || isModifierHeld(e) || !e.code) return false;

    if (stopBindCode && stopBindCode !== 'NONE' && e.code === stopBindCode) {
      setScriptEnabled(!scriptEnabled);
      e.preventDefault();
      return true;
    }

    if (!scriptEnabled) return false;

    if (autoBindCode && autoBindCode !== 'NONE' && e.code === autoBindCode) {
      toggleAutoForActiveProfile();
      e.preventDefault();
      return true;
    }

    if (directionBindCode && directionBindCode !== 'NONE' && e.code === directionBindCode) {
      toggleDirectionMode();
      e.preventDefault();
      return true;
    }

    if (spamToggleCode && spamToggleCode !== 'NONE' && e.code === spamToggleCode) {
      toggleSpamMode();
      e.preventDefault();
      return true;
    }

    const boundProfileName = profileNameForBind(e.code);
    if (boundProfileName) {
      heldProfileBindCodes.add(e.code);
      triggerProfileBind(boundProfileName);
      e.preventDefault();
      return true;
    }

    return false;
  }

  function onTopKeyDown(e) {
    handleKeyDown(e);
  }

  function onTopKeyUp(e) {
    if (!e.code) return;
    heldKeys.delete(e.code);
    releaseProfileBindKey(e.code);
    if (e.code === spamActionCode) stopSpam();
  }

  function clearTransientInputState() {
    heldKeys.clear();
    heldProfileBindCodes.clear();
    stopSpam();
    lastDirection = '';
  }

  function onFrameKeyDown(e) {
    if (!e.isTrusted) return;
    if (e.code && e.code !== 'Enter') heldKeys.add(e.code);
    if (handleKeyDown(e)) return;
    if (!isTextTarget(e.target)) {
      if (getMovementKeys().has(e.code)) updateDirectionAvatar();
      if (e.code === spamActionCode && spamEnabled && scriptEnabled) startSpam();
    }
    if (e.target?.matches?.('input[data-hook="input"]') && e.key === 'Enter') {
      recordAvatarCommand(e.target.value);
    }
  }

  function onFrameKeyUp(e) {
    if (!e.isTrusted) return;
    heldKeys.delete(e.code);
    releaseProfileBindKey(e.code);
    if (getMovementKeys().has(e.code)) updateDirectionAvatar();
    if (e.code === spamActionCode) stopSpam();
  }

  // ==================== FRAME SURVIVABILITY ====================
  let attachedDoc = null;
  let attachedCleanup = null;
  let frameAttachTimer = null;

  function scheduleFrameAttachCheck(delay = 0) {
    if (frameAttachTimer) return;
    frameAttachTimer = setTimeout(() => {
      frameAttachTimer = null;
      if (!attachFrameListeners() && !attachedDoc) scheduleFrameAttachCheck(1000);
    }, delay);
  }

  function attachFrameListeners() {
    const frame = getFrame();
    const doc = frame?.contentDocument ?? null;
    if (!frame || !doc) {
      if (attachedCleanup) attachedCleanup();
      return false;
    }
    if (doc === attachedDoc) return true;
    if (attachedCleanup) attachedCleanup();

    doc.addEventListener('keydown', onFrameKeyDown, true);
    doc.addEventListener('keyup', onFrameKeyUp, true);
    const win = frame.contentWindow;
    if (win) win.addEventListener('pagehide', clearTransientInputState);
    const onFrameLoad = () => scheduleFrameAttachCheck();
    frame.addEventListener('load', onFrameLoad, true);
    const onVisibilityChange = () => {
      if (doc.hidden) clearTransientInputState();
    };
    doc.addEventListener('visibilitychange', onVisibilityChange);

    const isAvatarNoticeText = (text) => {
      const value = String(text || '');
      return value.length > 0
        && value.length < 100
        && (value.includes('Avatar set') || value.includes('Avatar cleared'));
    };

    const isAvatarNoticeNode = (node) => {
      if (typeof node === 'string') return isAvatarNoticeText(node);
      if (!node || (node.nodeType !== 1 && node.nodeType !== 3)) return false;
      return isAvatarNoticeText(node.textContent);
    };

    const removeAvatarNoticeNode = (node) => {
      let target = node;
      if (target?.nodeType === 3) target = target.parentElement;
      if (!target || target.nodeType !== 1 || !target.isConnected) return false;

      const scrollAnchors = [];
      for (let el = target.parentElement; el && el !== doc.body; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight) scrollAnchors.push([el, el.scrollTop]);
      }

      target.remove();
      for (const [el, top] of scrollAnchors) el.scrollTop = top;
      return true;
    };

    const originalAppendChild = win.Node.prototype.appendChild;
    const originalInsertBefore = win.Node.prototype.insertBefore;
    const originalReplaceChild = win.Node.prototype.replaceChild;
    const originalAppend = win.Element.prototype.append;
    const originalPrepend = win.Element.prototype.prepend;

    win.Node.prototype.appendChild = function appendChildNoAvatarNotice(child) {
      if (isAvatarNoticeNode(child)) return child;
      return originalAppendChild.call(this, child);
    };

    win.Node.prototype.insertBefore = function insertBeforeNoAvatarNotice(child, before) {
      if (isAvatarNoticeNode(child)) return child;
      return originalInsertBefore.call(this, child, before);
    };

    win.Node.prototype.replaceChild = function replaceChildNoAvatarNotice(child, oldChild) {
      if (isAvatarNoticeNode(child)) return oldChild;
      return originalReplaceChild.call(this, child, oldChild);
    };

    win.Element.prototype.append = function appendNoAvatarNotice(...nodes) {
      const filtered = nodes.filter(node => !isAvatarNoticeNode(node));
      if (filtered.length) originalAppend.apply(this, filtered);
    };

    win.Element.prototype.prepend = function prependNoAvatarNotice(...nodes) {
      const filtered = nodes.filter(node => !isAvatarNoticeNode(node));
      if (filtered.length) originalPrepend.apply(this, filtered);
    };

    const restoreChatInsertBlocker = () => {
      win.Node.prototype.appendChild = originalAppendChild;
      win.Node.prototype.insertBefore = originalInsertBefore;
      win.Node.prototype.replaceChild = originalReplaceChild;
      win.Element.prototype.append = originalAppend;
      win.Element.prototype.prepend = originalPrepend;
    };

    const chatObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          removeAvatarNoticeNode(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (isAvatarNoticeNode(node)) removeAvatarNoticeNode(node);
        }
      }
    });
    if (doc.body) chatObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });

    attachedDoc = doc;
    attachedCleanup = () => {
      doc.removeEventListener('keydown', onFrameKeyDown, true);
      doc.removeEventListener('keyup', onFrameKeyUp, true);
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      if (win) win.removeEventListener('pagehide', clearTransientInputState);
      frame.removeEventListener('load', onFrameLoad, true);
      chatObserver.disconnect();
      restoreChatInsertBlocker();
      attachedDoc = null;
      attachedCleanup = null;
    };
    return true;
  }

  let bodyObserver = null;
  function attachBodyObserver() {
    if (bodyObserver) bodyObserver.disconnect();
    bodyObserver = new MutationObserver(() => {
      if (!document.body.contains(panel)) document.body.appendChild(panel);
      scheduleFrameAttachCheck();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });
  }

  // ==================== UI HELPERS ====================
  function toggleMinimize() {
    if (rebindTarget) rebindTarget = null;

    const rectBefore = panel.getBoundingClientRect();

    isMinimized = !isMinimized;
    localStorage.setItem(MIN_KEY, isMinimized);
    render();

    panel.style.bottom = '';
    panel.style.right = '';
    const nextW = panel.offsetWidth;
    const nextH = panel.offsetHeight;
    let nextLeft = rectBefore.right - nextW;
    let nextTop = rectBefore.bottom - nextH;
    nextLeft = Math.max(0, Math.min(window.innerWidth - nextW, nextLeft));
    nextTop = Math.max(0, Math.min(window.innerHeight - nextH, nextTop));
    panel.style.left = nextLeft + 'px';
    panel.style.top = nextTop + 'px';
    saveCurrentPosition(panel);
  }

  function setHint(message, color = '#f0c060') {
    const hint = panel.querySelector('#aa-hint');
    if (!hint) return;
    hint.style.color = color;
    hint.textContent = message;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(clearHint, 1800);
  }

  function clearHint() {
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = null;
    }
    const hint = panel.querySelector('#aa-hint');
    if (!hint) return;
    hint.style.color = '#f0c060';
    if (rebindTarget) {
      hint.textContent = 'Press a key - ESC to cancel';
    } else if (!scriptEnabled) {
      hint.textContent = 'Stopped: avatar commands are blocked';
    } else if (avatarMode === 'direction') {
      hint.textContent = 'Direction avatar mode is active';
      hint.style.color = '#6f6';
    } else if (autoActive) {
      hint.textContent = 'List auto running: ' + autoProfile;
      hint.style.color = '#6f6';
    } else if (spamEnabled) {
      hint.textContent = 'Spam kick armed';
      hint.style.color = '#6f6';
    } else {
      hint.textContent = '';
    }
  }

  function mkEl(tag, props = {}) {
    const el = document.createElement(tag);
    Object.keys(props).forEach(key => {
      if (key === 'style' && typeof props[key] === 'string') el.style.cssText = props[key];
      else if (props[key] !== undefined) el[key] = props[key];
    });
    return el;
  }

  // ==================== MOUNT ====================
  document.body.appendChild(panel);
  render();

  window.addEventListener('keydown', onTopKeyDown, true);
  window.addEventListener('keyup', onTopKeyUp, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTransientInputState();
  });
  window.addEventListener('resize', () => applyPanelPosition(panel));

  attachBodyObserver();
  scheduleFrameAttachCheck();
  if (avatarMode === 'direction') setTimeout(() => updateDirectionAvatar(true), 600);
})();
