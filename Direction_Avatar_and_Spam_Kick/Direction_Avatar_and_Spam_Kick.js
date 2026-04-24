// ==UserScript==
// @name         HaxBall Avatar + Spam + Custom Keys
// @namespace    http://tampermonkey.net/
// @version      2.25
// @description  Fix mapLoading + 0ms Instant Avatar (Smart Throttle) + Anti-Stutter + Lobby Hotkeys
// @author       Hoang1264589
// @include      *://*.haxball.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULT_AVATAR_TOGGLE = 'KeyE';
  const DEFAULT_SPAM_TOGGLE   = 'KeyQ';
  const DEFAULT_SPAM_ACTION   = 'KeyX';
  const DEFAULT_AVATAR_TEXT   = '😈';

  const STORE_AV_TOGGLE   = 'hax_avToggleKey';
  const STORE_SPAM_TOGGLE = 'hax_spamToggleKey';
  const STORE_SPAM_ACTION = 'hax_spamActionKey';
  const STORE_AV_TEXT     = 'hax_defaultAvatar';
  const STORE_MINIMIZED   = 'hax_isMinimized';

  function loadKey(k, def) { return localStorage.getItem(k) || def; }
  function saveKey(k, v)   { localStorage.setItem(k, v); }

  let avToggleKey       = loadKey(STORE_AV_TOGGLE,   DEFAULT_AVATAR_TOGGLE);
  let spamToggleKey     = loadKey(STORE_SPAM_TOGGLE, DEFAULT_SPAM_TOGGLE);
  let spamActionKey     = loadKey(STORE_SPAM_ACTION, DEFAULT_SPAM_ACTION);
  let defaultAvatarText = loadKey(STORE_AV_TEXT,     DEFAULT_AVATAR_TEXT);
  let isMinimized       = loadKey(STORE_MINIMIZED,   'false') === 'true';

  let avatarEnabled   = true;
  let spamModeEnabled = false;

  // ==================== UI PANEL ====================
  const panel = document.createElement('div');
  panel.id = 'hax-panel';

  function keyLabel(code) {
    if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
    if (code === 'Space') return 'Space';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    return code.replace('Key','').replace('Arrow','').replace('Digit','').replace('Numpad','Num ');
  }

  function toggleMinimize() {
    if (rebindTarget) {
      rebindTarget = null;
      window.dispatchEvent(new CustomEvent('__hax_setRebindState', { detail: { state: false } }));
    }
    isMinimized = !isMinimized;
    saveKey(STORE_MINIMIZED, isMinimized);
    renderPanel();
  }

  panel.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'INPUT') e.preventDefault();
  });

  panel.addEventListener('click', (e) => {
    if (e.target.id === 'hax-minimize-btn') { toggleMinimize();  return; }
    if (e.target.id === 'hax-av-status')    { toggleAvatar();    return; }
    if (e.target.id === 'hax-spam-status')  { toggleSpamMode();  return; }
  });

  function renderPanel() {
    panel.removeAttribute('style');
    Object.assign(panel.style, {
      position: 'fixed', bottom: '45px', right: '4px', zIndex: 99999,
      background: 'rgba(26, 26, 46, 0.6)', color: '#ddd', border: '1px solid #333',
      fontFamily: 'sans-serif', userSelect: 'none', boxSizing: 'border-box'
    });

    if (isMinimized) {
      Object.assign(panel.style, {
        borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
        minWidth: '120px', cursor: 'default'
      });
      panel.innerHTML = `
        <div id="hax-minimize-btn" title="Phóng to Cài đặt" style="
          position:absolute;top:4px;right:4px;cursor:pointer;
          font-size:16px;line-height:10px;color:#888;font-weight:bold;padding:2px 6px;border-radius:4px;">+</div>
        <div style="font-size:10px;color:#888;margin-bottom:6px;letter-spacing:.05em;text-align:left;">HAX MINI</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span id="hax-av-status"   style="font-size:12px;cursor:pointer;" title="Click để Bật/Tắt">${avatarEnabled   ? '🟢 Avatar ON' : '🔴 Avatar OFF'}</span>
          <span id="hax-spam-status" style="font-size:12px;cursor:pointer;" title="Click để Bật/Tắt">${spamModeEnabled ? '🟢 Spam ON'   : '🔴 Spam OFF'  }</span>
        </div>`;
    } else {
      Object.assign(panel.style, {
        borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
        minWidth: '190px', cursor: 'default'
      });
      panel.innerHTML = `
        <div id="hax-minimize-btn" title="Thu nhỏ" style="
          position:absolute;top:4px;right:4px;cursor:pointer;
          font-size:16px;line-height:10px;color:#888;font-weight:bold;padding:2px 6px;border-radius:4px;">&minus;</div>
        <div style="font-size:10px;color:#888;margin-bottom:5px;letter-spacing:.05em;text-align:center;">HAXBALL TOOLS V2.24</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span id="hax-av-status" style="font-size:12px;cursor:pointer;" title="Click để Bật/Tắt">${avatarEnabled ? '🟢 Avatar ON' : '🔴 Avatar OFF'}</span>
          <span id="hax-toggle-badge" title="Đổi phím" style="
            font-family:monospace;background:#2a2a3e;border:1px solid #444;
            border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;color:#ccc">${keyLabel(avToggleKey)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px">Avatar mặc định:</span>
          <input id="hax-av-input" type="text" value="${defaultAvatarText}" maxlength="2" title="Gõ/Paste Emoji" style="
            width:30px;height:18px;text-align:center;background:#2a2a3e;border:1px solid #444;
            color:#fff;border-radius:4px;font-size:13px;padding:0;outline:none;">
        </div>
        <hr style="border:0;border-top:1px solid #333;margin:6px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span id="hax-spam-status" style="font-size:12px;cursor:pointer;" title="Click để Bật/Tắt">${spamModeEnabled ? '🟢 Spam ON' : '🔴 Spam OFF'}</span>
          <span id="hax-spam-badge" title="Đổi phím" style="
            font-family:monospace;background:#2a2a3e;border:1px solid #444;
            border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;color:#ccc">${keyLabel(spamToggleKey)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#aaa">Phím Đá/Spam:</span>
          <span id="hax-action-badge" title="Cài đặt phím" style="
            font-family:monospace;background:#4a2a2a;border:1px solid #644;
            border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;color:#fcc">${keyLabel(spamActionKey)}</span>
        </div>
        <div id="hax-rebind-hint" style="font-size:10px;color:#666;margin-top:4px;height:8px;line-height:8px;text-align:center;"></div>`;

      panel.querySelector('#hax-toggle-badge').addEventListener('mousedown',  (e) => { e.preventDefault(); startRebind('avatar'); });
      panel.querySelector('#hax-spam-badge').addEventListener('mousedown',    (e) => { e.preventDefault(); startRebind('spamToggle'); });
      panel.querySelector('#hax-action-badge').addEventListener('mousedown',  (e) => { e.preventDefault(); startRebind('spamAction'); });

      const avInput = panel.querySelector('#hax-av-input');
      avInput.addEventListener('keydown', (e) => { e.stopPropagation(); });
      avInput.addEventListener('input', (e) => {
        defaultAvatarText = e.target.value;
        saveKey(STORE_AV_TEXT, defaultAvatarText);
        window.dispatchEvent(new CustomEvent('__hax_updateDefaultAvatar', { detail: { text: defaultAvatarText } }));
      });
    }

    const minBtn = panel.querySelector('#hax-minimize-btn');
    if (minBtn) {
      minBtn.onmouseenter = () => { minBtn.style.color = '#fff'; minBtn.style.background = 'rgba(255,255,255,0.1)'; };
      minBtn.onmouseleave = () => { minBtn.style.color = '#888'; minBtn.style.background = 'transparent'; };
    }
  }

  // ==================== REBIND LOGIC ====================
  let rebindTarget = null;
  let hintTimer    = null;

  function startRebind(target) {
    if (isMinimized) return;
    if (hintTimer) clearTimeout(hintTimer);
    rebindTarget = target;
    const hint = panel.querySelector('#hax-rebind-hint');
    hint.style.color = '#f0c060';
    hint.textContent = `Bấm phím... (Esc hủy)`;
    const badgeId = target === 'avatar' ? '#hax-toggle-badge' : target === 'spamToggle' ? '#hax-spam-badge' : '#hax-action-badge';
    const badge = panel.querySelector(badgeId);
    badge.textContent = '…'; badge.style.borderColor = '#f0c060'; badge.style.color = '#f0c060';
    window.dispatchEvent(new CustomEvent('__hax_setRebindState', { detail: { state: true } }));
  }

  function processRebindKey(code) {
    if (!rebindTarget || isMinimized) return;
    if (hintTimer) clearTimeout(hintTimer);
    const hint = panel.querySelector('#hax-rebind-hint');
    if (code === 'Escape') {
      hint.style.color = '#888'; hint.textContent = 'Đã hủy.';
    } else {
      if      (rebindTarget === 'avatar')     { avToggleKey   = code; saveKey(STORE_AV_TOGGLE,   avToggleKey); }
      else if (rebindTarget === 'spamToggle') { spamToggleKey = code; saveKey(STORE_SPAM_TOGGLE, spamToggleKey); }
      else if (rebindTarget === 'spamAction') { spamActionKey = code; saveKey(STORE_SPAM_ACTION, spamActionKey); }
      window.dispatchEvent(new CustomEvent('__hax_updateKeys', { detail: { avToggleKey, spamToggleKey, spamActionKey } }));
      hint.style.color = '#6f6'; hint.textContent = 'Đã lưu!';
    }
    rebindTarget = null;
    renderPanel();
    window.dispatchEvent(new CustomEvent('__hax_setRebindState', { detail: { state: false } }));
    hintTimer = setTimeout(() => {
      const h = panel.querySelector('#hax-rebind-hint');
      if (h && !rebindTarget) h.textContent = '';
    }, 1500);
  }

  window.addEventListener('keydown', (e) => {
    if (!rebindTarget) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    processRebindKey(e.code);
  }, true);

  window.addEventListener('__hax_forwardRebindKey', (e) => { processRebindKey(e.detail.code); });
  document.body.appendChild(panel);

  function toggleAvatar() {
    avatarEnabled = !avatarEnabled; renderPanel();
    window.dispatchEvent(new CustomEvent('__hax_setAvatarState', { detail: { enabled: avatarEnabled } }));
  }
  function toggleSpamMode() {
    spamModeEnabled = !spamModeEnabled; renderPanel();
    window.dispatchEvent(new CustomEvent('__hax_setSpamMode', { detail: { enabled: spamModeEnabled } }));
  }

  window.addEventListener('keydown', (e) => {
    if (rebindTarget || e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === avToggleKey)   toggleAvatar();
    if (e.code === spamToggleKey) toggleSpamMode();
  });

  window.addEventListener('__hax_reqToggleAvatar',   toggleAvatar);
  window.addEventListener('__hax_reqToggleSpamMode', toggleSpamMode);
  renderPanel();

  // ==================== SCRIPT INJECT VÀO GAME ====================
  const script = document.createElement('script');
  script.textContent = `
  (function avatarMain() {
    let currentAvToggleKey   = ${JSON.stringify(avToggleKey)};
    let currentSpamToggleKey = ${JSON.stringify(spamToggleKey)};
    let currentSpamActionKey = ${JSON.stringify(spamActionKey)};
    let currentDefaultAvatar = ${JSON.stringify(defaultAvatarText)};

    let avatarEnabled   = true;
    let spamModeEnabled = false;
    let currentScript   = null;
    let currentInputRef = null;
    let isRebinding     = false;

    let watcherInterval = null;
    let currentLobbyDoc = null;

    // --- BẮT PHÍM Ở SẢNH CHỜ (LOBBY) ---
    function lobbyKeyHandler(e) {
      if (!e.isTrusted) return;

      // Xử lý Rebind Key khi focus đang ở sảnh chờ
      if (isRebinding) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        window.dispatchEvent(new CustomEvent('__hax_forwardRebindKey', { detail: { code: e.code } }));
        return;
      }

      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Bỏ qua nếu đã vào phòng (currentScript đang chạy) để nhường quyền cho hàm onKeyDown bên dưới
      if (currentScript !== null) return;

      if (e.code === currentAvToggleKey) {
        window.dispatchEvent(new CustomEvent('__hax_reqToggleAvatar'));
      } else if (e.code === currentSpamToggleKey) {
        window.dispatchEvent(new CustomEvent('__hax_reqToggleSpamMode'));
      }
    }

    window.addEventListener('__hax_setRebindState',      (e) => { isRebinding = e.detail.state; });
    window.addEventListener('__hax_updateKeys',          (e) => {
      currentAvToggleKey   = e.detail.avToggleKey;
      currentSpamToggleKey = e.detail.spamToggleKey;
      currentSpamActionKey = e.detail.spamActionKey;
    });
    window.addEventListener('__hax_updateDefaultAvatar', (e) => {
      currentDefaultAvatar = e.detail.text;
      if (!avatarEnabled && currentScript) currentScript.applyDefaultAvatar();
    });
    window.addEventListener('__hax_setAvatarState', (e) => {
      avatarEnabled = e.detail.enabled;
      if (currentScript) avatarEnabled ? currentScript.resume() : currentScript.pause();
    });
    window.addEventListener('__hax_setSpamMode', (e) => {
      spamModeEnabled = e.detail.enabled;
      if (currentScript) {
        if (!spamModeEnabled) { currentScript.stopSpam(); currentScript.restoreHoldState(); }
        else currentScript.checkAndStartSpam();
      }
    });

    function initForFrame(frame) {
      const win    = frame.contentWindow;
      const doc    = frame.contentDocument;
      const input  = doc && doc.querySelector('input[data-hook="input"]');
      const canvas = doc && doc.querySelector('canvas');
      if (!input || !canvas) return false;

      if (currentScript) currentScript.stop();

      const nativeSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;

      const directionMap = {
        'up':'⬆','down':'⬇','left':'⬅','right':'➡',
        'up-right':'⬈','up-left':'⬉','down-right':'⬊','down-left':'⬋','idle':'•',
      };

      const movementKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD']);
      const heldKeys     = new Set();

      let paused  = !avatarEnabled;
      let lastDir = '';

      // ── SMART THROTTLE ──────────────────────────────────────────────────
      const THROTTLE_MS = 40;
      let lastCmdTime   = -THROTTLE_MS;
      let throttleTimer = null;

      // ── SPAM ────────────────────────────────────────────────────────────
      let spamActive = false;
      let spamTimer  = null;

      // ── MAP CHANGE DETECTION ────────────────────────────────────────────
      let mapLoading      = false;
      let mapLoadCooldown = null;
      let mapLoadFallback = null;

      function resetMapLoading() {
        mapLoading = false;
        lastDir    = '';
        if (mapLoadCooldown) { clearTimeout(mapLoadCooldown); mapLoadCooldown = null; }
        if (mapLoadFallback) { clearTimeout(mapLoadFallback); mapLoadFallback = null; }
      }

      function onMapChange() {
        if (mapLoading) return;
        mapLoading = true;
        lastDir    = '';
        if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }

        if (mapLoadCooldown) clearTimeout(mapLoadCooldown);
        if (mapLoadFallback) clearTimeout(mapLoadFallback);

        mapLoadCooldown = setTimeout(() => {
          mapLoadCooldown = null;
          const newCanvas = doc.querySelector('canvas');
          if (newCanvas && newCanvas !== canvas) initForFrame(frame);
          else resetMapLoading();
        }, 1500);

        mapLoadFallback = setTimeout(() => {
          if (mapLoading) resetMapLoading();
        }, 5000);
      }

      const bodyObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.removedNodes) {
            if (node === canvas || (node.nodeType === 1 && node.tagName === 'CANVAS')) {
              onMapChange();
            }
          }
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && node.tagName === 'CANVAS') onMapChange();
          }
        }
      });
      bodyObserver.observe(doc.body, { childList: true, subtree: false });
      if (canvas.parentElement && canvas.parentElement !== doc.body) {
        bodyObserver.observe(canvas.parentElement, { childList: true });
      }

      const canvasResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w === 0 || h === 0) onMapChange();
          else if (mapLoading && w > 0 && h > 0) requestAnimationFrame(() => resetMapLoading());
        }
      });
      canvasResizeObserver.observe(canvas);

      let isLiveGame = canvas.offsetWidth > 0;
      const inputResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) isLiveGame = entry.contentRect.width > 0;
      });
      inputResizeObserver.observe(input);

      // ── CHAT OBSERVER (ẩn thông báo "/avatar set") ─────────────────────
      const chatObserver = new MutationObserver((mutations) => {
        const toRemove = [];
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const txt = node.textContent || '';
              if ((txt.includes('Avatar set') || txt.includes('Avatar cleared')) && txt.length < 100) {
                toRemove.push(node);
              }
            }
          }
        }
        if (toRemove.length === 0) return;
        chatObserver.disconnect();
        for (const node of toRemove) node.remove();
        chatObserver.observe(doc.body, { childList: true, subtree: true });
      });
      chatObserver.observe(doc.body, { childList: true, subtree: true });

      // ── SPAM ─────────────────────────────────────────────────────────────
      function startSpam() {
        if (spamActive || !isLiveGame || mapLoading) return;
        spamActive = true;
        const loop = () => {
          if (!heldKeys.has(currentSpamActionKey) || !spamModeEnabled || !isLiveGame || mapLoading) {
            stopSpam(); return;
          }
          canvas.dispatchEvent(new KeyboardEvent('keyup', {
            code: currentSpamActionKey,
            key:  currentSpamActionKey.replace('Key','').toLowerCase(),
            bubbles: true, cancelable: true
          }));
          setTimeout(() => {
            if (heldKeys.has(currentSpamActionKey) && spamModeEnabled && isLiveGame && !mapLoading) {
              canvas.dispatchEvent(new KeyboardEvent('keydown', {
                code: currentSpamActionKey,
                key:  currentSpamActionKey.replace('Key','').toLowerCase(),
                bubbles: true, cancelable: true
              }));
            }
          }, 30);
        };
        loop();
        spamTimer = setInterval(loop, 80);
      }

      function stopSpam() {
        if (!spamActive) return;
        spamActive = false;
        clearInterval(spamTimer);
        spamTimer = null;
      }

      function checkAndStartSpam() {
        if (spamModeEnabled && heldKeys.has(currentSpamActionKey) && doc.activeElement !== input && isLiveGame && !mapLoading)
          startSpam();
      }

      function restoreHoldState() {
        if (heldKeys.has(currentSpamActionKey) && doc.activeElement !== input && isLiveGame && !mapLoading) {
          canvas.dispatchEvent(new KeyboardEvent('keydown', {
            code: currentSpamActionKey,
            key:  currentSpamActionKey.replace('Key','').toLowerCase(),
            bubbles: true, cancelable: true
          }));
        }
      }

      // ── SEND COMMAND ─────────────────────────────────────────────────────
      function sendCommand(text) {
        if (!isLiveGame || mapLoading) return;
        nativeSetter.call(input, text);
        input.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13, key: 'Enter', bubbles: true, cancelable: true }));
        if (doc.activeElement !== canvas) canvas.focus();
        setTimeout(() => {
          heldKeys.forEach(code => {
            if (movementKeys.has(code)) {
              canvas.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
            }
          });
        }, 0);
      }

      // ── AVATAR UPDATE VỚI SMART THROTTLE ────────────────────────────────
      function getDirection() {
        const up    = heldKeys.has('ArrowUp')    || heldKeys.has('KeyW');
        const down  = heldKeys.has('ArrowDown')  || heldKeys.has('KeyS');
        const left  = heldKeys.has('ArrowLeft')  || heldKeys.has('KeyA');
        const right = heldKeys.has('ArrowRight') || heldKeys.has('KeyD');
        if (up && right)   return 'up-right';
        if (up && left)    return 'up-left';
        if (down && right) return 'down-right';
        if (down && left)  return 'down-left';
        if (up)    return 'up';
        if (down)  return 'down';
        if (left)  return 'left';
        if (right) return 'right';
        return 'idle';
      }

      function applyAvatar(dir) {
        lastDir = dir;
        sendCommand('/avatar ' + directionMap[dir]);
        lastCmdTime = performance.now();
      }

      function triggerAvatarUpdate() {
        if (paused || mapLoading || doc.activeElement === input || !isLiveGame) return;

        const dir = getDirection();
        if (dir === lastDir) return;

        const elapsed = performance.now() - lastCmdTime;

        if (elapsed >= THROTTLE_MS) {
          if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
          applyAvatar(dir);
        } else {
          if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
              throttleTimer = null;
              const latestDir = getDirection();
              if (!paused && !mapLoading && doc.activeElement !== input && isLiveGame && latestDir !== lastDir) {
                applyAvatar(latestDir);
              }
            }, THROTTLE_MS - elapsed);
          }
        }
      }

      // ── KEYBOARD EVENTS ──────────────────────────────────────────────────
      function onKeyDown(e) {
        if (!e.isTrusted) return;
        if (isRebinding) {
          e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
          window.dispatchEvent(new CustomEvent('__hax_forwardRebindKey', { detail: { code: e.code } }));
          return;
        }
        if (doc.activeElement === input || e.repeat) {
          if (e.code && e.code !== 'Enter') heldKeys.add(e.code);
          return;
        }
        if (e.code === currentAvToggleKey) {
          if (avatarEnabled && isLiveGame && !mapLoading) {
            sendCommand(currentDefaultAvatar.trim() ? '/avatar ' + currentDefaultAvatar : '/clear_avatar');
          }
          window.dispatchEvent(new CustomEvent('__hax_reqToggleAvatar'));
          return;
        }
        if (e.code === currentSpamToggleKey) {
          window.dispatchEvent(new CustomEvent('__hax_reqToggleSpamMode'));
          return;
        }

        heldKeys.add(e.code);

        if (movementKeys.has(e.code)) triggerAvatarUpdate();

        if (e.code === currentSpamActionKey && spamModeEnabled && isLiveGame && !mapLoading) startSpam();
      }

      function onKeyUp(e) {
        if (!e.isTrusted || isRebinding) return;
        heldKeys.delete(e.code);

        if (movementKeys.has(e.code)) triggerAvatarUpdate();

        if (e.code === currentSpamActionKey) stopSpam();
      }

      doc.addEventListener('keydown', onKeyDown, true);
      doc.addEventListener('keyup',   onKeyUp,   true);

      // ── API ───────────────────────────────────────────────────────────────
      currentScript = {
        pause: () => {
          paused = true;
          lastDir = '';
          if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
          if (isLiveGame && !mapLoading) {
            sendCommand(currentDefaultAvatar.trim() ? '/avatar ' + currentDefaultAvatar : '/clear_avatar');
          }
        },
        resume: () => { paused = false; lastDir = ''; triggerAvatarUpdate(); },
        stopSpam,
        checkAndStartSpam,
        restoreHoldState,
        applyDefaultAvatar: () => {
          if (isLiveGame && !mapLoading) {
            sendCommand(currentDefaultAvatar.trim() ? '/avatar ' + currentDefaultAvatar : '/clear_avatar');
          }
        },
        stop: () => {
          if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
          resetMapLoading();
          bodyObserver.disconnect();
          canvasResizeObserver.disconnect();
          inputResizeObserver.disconnect();
          chatObserver.disconnect();
          stopSpam();
          doc.removeEventListener('keydown', onKeyDown, true);
          doc.removeEventListener('keyup',   onKeyUp,   true);
          currentScript   = null;
          currentInputRef = null;
        }
      };

      currentInputRef = input;
      console.log('✅ HaxBall Tools v2.24 — Lobby Hotkeys Added');
      return true;
    }

    function startWatcher() {
      if (watcherInterval) clearInterval(watcherInterval);
      watcherInterval = setInterval(() => {
        const frame  = document.querySelector('iframe.gameframe');
        const doc    = frame?.contentDocument;

        // 1. NGAY TẠI SẢNH CHỜ: Add Listener luôn khi có iframe Document
        if (doc && doc !== currentLobbyDoc) {
          if (currentLobbyDoc) currentLobbyDoc.removeEventListener('keydown', lobbyKeyHandler, true);
          doc.addEventListener('keydown', lobbyKeyHandler, true);
          currentLobbyDoc = doc;
        }

        // 2. KHI VÀO PHÒNG: Tìm thấy canvas + input -> Chạy initForFrame
        const input  = doc?.querySelector('input[data-hook="input"]');
        const canvas = doc?.querySelector('canvas');
        if (input && canvas && input !== currentInputRef) {
          initForFrame(frame);
        }
      }, 1000);
    }

    startWatcher();

  })();
  `;
  document.head.appendChild(script);

})();