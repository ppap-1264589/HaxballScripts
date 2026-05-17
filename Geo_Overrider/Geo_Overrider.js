// ==UserScript==
// @name         Geo-Overrider
// @namespace    http://tampermonkey.net/
// @version      4.9.0
// @description  Fake GPS hoàn chỉnh: Thêm Lat, Lon, và Mã quốc gia (Code). Tích hợp chống giật lag khi vào room.
// @author       Hoang1264589
// @match        *://*.haxball.com/*
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ==================== DEBUG ====================
    const DEBUG = false;
    function log(...args) { if (DEBUG) console.log('[GeoOverrider]', ...args); }

    let isTopFrame = false;
    try { isTopFrame = window.top === window.self; } catch (e) { isTopFrame = false; }
    if (!isTopFrame) return;

    // ==================== CONFIG & STORAGE KEYS ====================
    const GEO_KEY            = 'geo';
    const UI_STATE_KEY       = 'hax_geo_isMinimized';
    const UI_POS_KEY         = 'hax_geo_pos';
    const ACTIVE_KEY         = 'hax_geo_active';
    const PRESET_KEY         = 'hax_geo_preset';
    const CUSTOM_PRESETS_KEY = 'hax_geo_custom_presets';

    // [PATCH] Danh sách class iframe HaxBall có thể dùng - dễ mở rộng sau này
    const GAME_IFRAME_CLASSES = ['gameframe'];

    const DEFAULT_PRESETS = {
        vn: { name: '🇻🇳 Hà Nội, VN',       data: { lat: 21.02451234,  lon: 105.84117123,  code: 'vn' } },
        gb: { name: '🇬🇧 Old Trafford, GB',  data: { lat: 53.4631,      lon: -2.2913,       code: 'gb' } },
        us: { name: '🇺🇸 New York, US',       data: { lat: 40.7128,      lon: -74.0060,      code: 'us' } },
        ar: { name: '🇦🇷 Río Cuarto, AR',    data: { lat: -33.12207296, lon: -64.34915075,  code: 'ar' } },
        cn: { name: '🇨🇳 Guangdong, CN',      data: { lat: 23.01901556,  lon: 113.74202686,  code: 'cn' } }
    };

    const SafeStorage = {
        _available: null,
        check() {
            if (this._available !== null) return this._available;
            try { localStorage.setItem('__geo_test__', '1'); localStorage.removeItem('__geo_test__'); return (this._available = true); }
            catch (e) { return (this._available = false); }
        },
        get(key)      { if (!this.check()) return null; try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, val) { if (!this.check()) return;      try { localStorage.setItem(key, val); }  catch (e) {} },
        remove(key)   { if (!this.check()) return;      try { localStorage.removeItem(key); }     catch (e) {} }
    };

    // ==================== PRESET MANAGEMENT ====================
    function loadPresets() {
        try {
            const raw = SafeStorage.get(CUSTOM_PRESETS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Object.keys(parsed).length > 0) return parsed;
            }
        } catch {}
        // [PATCH] Dùng structuredClone thay vì JSON.parse(JSON.stringify(...))
        return structuredClone(DEFAULT_PRESETS);
    }
    function savePresets(presets) { SafeStorage.set(CUSTOM_PRESETS_KEY, JSON.stringify(presets)); }

    let customPresets = loadPresets();

    const GeoStore = {
        get() {
            try {
                const raw = SafeStorage.get(GEO_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (parsed?.lat != null && parsed?.lon != null) return parsed;
            } catch {} return null;
        },
        set(data)        { SafeStorage.set(GEO_KEY, JSON.stringify(data)); },
        clear()          { SafeStorage.remove(GEO_KEY); },
        isUserActive()   { return SafeStorage.get(ACTIVE_KEY) === 'true'; },
        setUserActive(v) { SafeStorage.set(ACTIVE_KEY, v ? 'true' : 'false'); },
        getSavedPreset() {
            const saved = SafeStorage.get(PRESET_KEY) || 'real';
            if (saved !== 'real' && !customPresets[saved]) return 'real';
            return saved;
        },
        setSavedPreset(k) { SafeStorage.set(PRESET_KEY, k); },
    };

    // ==================== GPS API MOCK ====================
    function injectGpsMock() {
        const script = document.createElement('script');
        // [PATCH] Không cần truyền GEO_KEY qua closure vì đã inline string literal
        const GEO_KEY_INLINE = GEO_KEY;
        script.textContent = `(${function (GEO_KEY) {
            function safeGetItem(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
            const geo = navigator.geolocation;
            if (!geo) return;

            const _getCurrentPosition = geo.getCurrentPosition.bind(geo);
            const _watchPosition      = geo.watchPosition.bind(geo);

            // [PATCH] Đặt giới hạn TTL cho fake watchPosition intervals (tránh leak vô hạn)
            const watchMap = new Map();
            let watchIdCounter = 10000;
            const WATCH_MAX_IDLE_MS = 60 * 60 * 1000; // Tự clear sau 1 giờ nếu quên clearWatch

            function buildMockPosition(lat, lon) {
                return {
                    coords: { latitude: lat, longitude: lon, accuracy: 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                    timestamp: Date.now()
                };
            }

            function getMock() {
                try {
                    const raw = safeGetItem(GEO_KEY);
                    if (!raw) return null;
                    const p = JSON.parse(raw);
                    if (p?.lat != null && p?.lon != null) return buildMockPosition(p.lat, p.lon);
                } catch {} return null;
            }

            geo.getCurrentPosition = function (success, error, options) {
                const mock = getMock();
                if (mock) { setTimeout(() => success(mock), 0); }
                else { _getCurrentPosition(success, error, options); }
            };

            geo.watchPosition = function (success, error, options) {
                const mock = getMock();
                if (mock) {
                    const fakeId = ++watchIdCounter;
                    setTimeout(() => success(buildMockPosition(mock.coords.latitude, mock.coords.longitude)), 0);
                    const intervalId = setInterval(() => {
                        const latest = getMock();
                        if (latest) success(latest);
                    }, 5000);
                    // [PATCH] TTL tự động clear sau 1 giờ để tránh memory leak
                    const ttlId = setTimeout(() => {
                        clearInterval(intervalId);
                        watchMap.delete(fakeId);
                    }, WATCH_MAX_IDLE_MS);
                    watchMap.set(fakeId, { intervalId, ttlId });
                    return fakeId;
                }
                return _watchPosition(success, error, options);
            };

            geo.clearWatch = function (id) {
                if (watchMap.has(id)) {
                    const { intervalId, ttlId } = watchMap.get(id);
                    clearInterval(intervalId);
                    clearTimeout(ttlId);
                    watchMap.delete(id);
                } else {
                    const origClear = navigator.geolocation.__proto__.clearWatch;
                    if (origClear) origClear.call(navigator.geolocation, id);
                }
            };
        }.toString()})(${JSON.stringify(GEO_KEY_INLINE)});`;

        function tryInject() {
            const target = document.head || document.documentElement;
            if (target) { target.appendChild(script); script.remove(); }
            else { setTimeout(tryInject, 50); }
        }
        tryInject();
    }
    injectGpsMock();

    // ==================== CSS STYLE ====================
    const style = document.createElement('style');
    style.textContent = `
        .geo-btn { background: #2a2a3e; border: 1px solid #555; color: #ccc; border-radius: 4px; padding: 3px 6px; cursor: pointer; font-size: 11px; font-family: monospace; transition: .15s; }
        .geo-btn:hover { background: #35354f; border-color: #888; color: #fff; }
        .geo-btn.danger { border-color: #a03; color: #f77; }
        .geo-btn.danger:hover { background: #3a1020; }
        .geo-input { flex: 1; min-width: 50px; background: transparent; border: none; border-bottom: 1px dashed #555; color: #7dd3fc; font-weight: bold; font-family: monospace; font-size: 11px; padding: 2px 0; outline: none; transition: .15s; letter-spacing: 0.5px; }
        .geo-input:focus { border-bottom-color: #7dd3fc; background: rgba(0,0,0,0.3); }
        .geo-input::-webkit-outer-spin-button, .geo-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .geo-copy-label {
            color: #d7dcff !important;
            font-family: Tahoma, Arial, sans-serif !important;
            font-weight: 900 !important;
            text-shadow: 0 1px 2px rgba(0,0,0,.65);
            user-select: text !important;
            -webkit-user-select: text !important;
            cursor: text !important;
        }
        .geo-copy-label:hover {
            color: #fff !important;
            text-shadow: 0 0 6px rgba(215,220,255,.45), 0 1px 2px rgba(0,0,0,.65);
        }
        .geo-section-label {
            text-transform: uppercase;
        }
        .geo-field-label {
            width: 40px;
            display: inline-block;
        }
    `;
    document.head.appendChild(style);

    // ==================== UI PANEL STATE ====================
    let isMinimized    = SafeStorage.get(UI_STATE_KEY) === 'true';
    let panelUpdateInterval = null;
    let panelEl        = null;
    let isCreating     = false;
    let currentSelectKey = GeoStore.getSavedPreset();

    // ==================== ANTI-STUTTER MECHANISM ====================
    let isRoomTransitioning = false;
    let transitionCooldown  = null;

    function triggerRoomTransition() {
        isRoomTransitioning = true;
        if (transitionCooldown) clearTimeout(transitionCooldown);
        transitionCooldown = setTimeout(() => {
            isRoomTransitioning = false;
            transitionCooldown  = null;
            log('Room transition cooldown finished.');
            // [PATCH] Sau khi hết cooldown, kiểm tra và khôi phục panel nếu cần
            if (panelEl && !document.body.contains(panelEl)) {
                try { document.body.appendChild(panelEl); }
                catch (e) { panelEl = null; initUI(); }
            }
        }, 2000);
    }

    // [PATCH] Helper kiểm tra một node có phải game iframe không
    function isGameIframe(node) {
        if (node.nodeType !== 1 || node.tagName !== 'IFRAME') return false;
        return GAME_IFRAME_CLASSES.some(cls => node.classList.contains(cls));
    }

    // ==================== POSITION HELPERS ====================
    const PosState = {
        get() { try { const raw = SafeStorage.get(UI_POS_KEY); if (raw) return JSON.parse(raw); } catch {} return null; },
        save(xPct, yPct) { SafeStorage.set(UI_POS_KEY, JSON.stringify({ xPct, yPct })); }
    };

    function saveCurrentPosition(panel) {
        if (!panel) return;
        // [PATCH] Dùng getBoundingClientRect() làm nguồn tin cậy duy nhất thay vì
        // parseFloat(style.left) có thể trả về NaN khi panel dùng bottom/right positioning
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
        if (pos && typeof pos.xPct === 'number' && !isNaN(pos.xPct)) {
            panel.style.bottom = ''; panel.style.right = '';
            const maxX = Math.max(0, window.innerWidth  - panel.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
            panel.style.left = (pos.xPct * maxX) + 'px';
            panel.style.top  = (pos.yPct * maxY) + 'px';
        } else {
            panel.style.top  = ''; panel.style.left = '';
            panel.style.bottom = '845px'; panel.style.right = '125px';
        }
    }

    // ==================== RENDER PANEL ====================
    function renderPanel(panel) {
        // [PATCH] Clear interval TRƯỚC tiên, tránh leak nếu render được gọi nhiều lần
        clearInterval(panelUpdateInterval);
        panelUpdateInterval = null;

        const active     = GeoStore.isUserActive();
        const appliedKey = GeoStore.getSavedPreset();
        const preset     = customPresets[currentSelectKey];
        const currentGeo = GeoStore.get();

        panel.removeAttribute('style');
        Object.assign(panel.style, {
            position:   'fixed',
            zIndex:     2147483647,
            background: 'rgba(26, 26, 46, 0.7)',
            color:      '#ddd',
            border:     '1px solid #3a3a5a',
            fontFamily: "Tahoma, Arial, sans-serif",
            userSelect: 'none',
            boxSizing:  'border-box',
            borderRadius: '8px',
            boxShadow:  '0 4px 12px rgba(0,0,0,0.5)'
        });

        if (isMinimized) {
            Object.assign(panel.style, { padding: '8px 12px', minWidth: '110px' });
            const label    = active ? (customPresets[appliedKey]?.name.split(',')[0] || 'Fake GPS') : '📍 Vị trí gốc';
            const dotColor = active ? '#4ade80' : '#f87171';
            panel.innerHTML = `
                <div id="geo-drag-handle" style="display:flex;align-items:center;gap:8px;cursor:grab;touch-action:none;">
                    <span style="color:${dotColor};font-size:11px;text-shadow:0 0 5px ${dotColor};">${active ? '●' : '○'}</span>
                    <span style="font-size:12px;font-weight:600;color:#eee;">${label}</span>
                    <span id="geo-min-btn" style="font-size:14px;color:#aaa;margin-left:auto;cursor:pointer;" title="Phóng to">⛶</span>
                </div>
            `;
        } else {
            Object.assign(panel.style, { padding: '14px', width: '230px' });

            let infoHtml = '';
            if (currentSelectKey !== 'real' && preset) {
                infoHtml = `
                    <div style="font-size:13px;font-weight:bold;color:#fff;margin-bottom:8px;">${preset.name.split(',')[0].trim()}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <label style="font-size:11px;color:#aaa;display:flex;align-items:center;cursor:text;">
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Lat:</span>
                            <input type="number" id="lat-in" class="geo-input" value="${preset.data.lat}" step="any">
                        </label>
                        <label style="font-size:11px;color:#aaa;display:flex;align-items:center;cursor:text;">
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Lon:</span>
                            <input type="number" id="lon-in" class="geo-input" value="${preset.data.lon}" step="any">
                        </label>
                        <label style="font-size:11px;color:#aaa;display:flex;align-items:center;cursor:text;">
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Code:</span>
                            <input type="text" id="code-in" class="geo-input" value="${preset.data.code}" maxlength="2" style="text-transform:lowercase;color:#f0c060;">
                        </label>
                    </div>
                `;
            } else if (currentSelectKey === 'real' && currentGeo) {
                infoHtml = `
                    <div style="font-size:13px;font-weight:bold;color:#fff;margin-bottom:8px;">Trình duyệt cấp phép</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <span style="font-size:11px;color:#aaa;display:flex;align-items:center;">
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Lat:</span>
                            <span style="color:#a855f7;font-weight:bold;flex:1;">${parseFloat(currentGeo.lat.toFixed(6))}</span>
                        </span>
                        <span style="font-size:11px;color:#aaa;display:flex;align-items:center;">
                            <!-- [PATCH] Sửa typo: display-inline-block -> display:inline-block -->
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Lon:</span>
                            <span style="color:#a855f7;font-weight:bold;flex:1;">${parseFloat(currentGeo.lon.toFixed(6))}</span>
                        </span>
                        <span style="font-size:11px;color:#aaa;display:flex;align-items:center;">
                            <span class="geo-copy-label geo-field-label" style="width:40px;display:inline-block;font-weight:bold;">Code:</span>
                            <span style="color:#f0c060;font-weight:bold;flex:1;">${currentGeo.code || 'N/A'}</span>
                        </span>
                    </div>
                `;
            } else {
                infoHtml = `<div style="font-size:12px;color:#555;font-style:italic;">— Đang đọc vị trí gốc... —</div>`;
                if (currentSelectKey === 'real') {
                    panelUpdateInterval = setInterval(() => {
                        if (GeoStore.get()) {
                            clearInterval(panelUpdateInterval);
                            panelUpdateInterval = null;
                            renderPanel(panel);
                        }
                    }, 1000);
                }
            }

            let optionsHtml = `<option value="real" ${'real' === currentSelectKey ? 'selected' : ''} style="background:#1a1a2e;">📍 Vị trí gốc (Browser)</option>`;
            for (const [k, p] of Object.entries(customPresets)) {
                optionsHtml += `<option value="${k}" ${k === currentSelectKey ? 'selected' : ''} style="background:#1a1a2e;">${p.name}</option>`;
            }

            panel.innerHTML = `
                <div id="geo-drag-handle" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);cursor:grab;touch-action:none;">
                    <span style="font-size:12px;font-weight:900;letter-spacing:0.05em;color:#fff;pointer-events:none;">🌍 GEO OVERRIDER</span>
                    <button id="geo-min-btn" title="Thu nhỏ" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:20px;line-height:0.5;padding:0 4px;font-weight:bold;">–</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span class="geo-copy-label" style="font-size:12px;color:#bbb;">Trạng thái</span>
                    <span style="display:inline-block;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:bold;background:${active ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'};color:${active ? '#4ade80' : '#f87171'};border:1px solid ${active ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'};box-shadow:0 0 5px ${active ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'};">
                        ${active ? '🟢 ĐANG BẬT' : '🔴 ĐÃ TẮT'}
                    </span>
                </div>
                <div style="background:rgba(0,0,0,0.4);border:1px solid #333;border-radius:6px;padding:8px 10px;margin-bottom:12px;">
                    <div class="geo-copy-label geo-section-label" style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Thông tin tọa độ</div>
                    ${infoHtml}
                </div>

                <div style="display:flex;gap:5px;align-items:center;margin-bottom:12px;">
                    <select id="geo-select" style="flex:1;width:0;background:rgba(0,0,0,0.4);color:#eee;border:1px solid #555;padding:5px 6px;border-radius:4px;font-size:11px;outline:none;cursor:pointer;">
                        ${optionsHtml}
                    </select>
                    <button id="geo-add" class="geo-btn" title="Thêm địa điểm mới">+</button>
                    <button id="geo-ren" class="geo-btn" title="Đổi tên">✎</button>
                    <button id="geo-del" class="geo-btn danger" title="Xóa">✕</button>
                </div>

                <button id="geo-apply-btn" style="width:100%;padding:9px;background:#4ade80;color:#064e3b;font-weight:bold;border:none;border-radius:4px;cursor:pointer;font-size:12px;text-transform:uppercase;transition:background 0.2s;">💾 LƯU &amp; TẢI LẠI TRANG</button>
            `;

            if (currentSelectKey !== 'real') {
                ['lat-in', 'lon-in', 'code-in'].forEach(id => {
                    const el = panel.querySelector('#' + id);
                    if (!el) return;
                    el.addEventListener('keydown', e => e.stopPropagation());
                    el.addEventListener('input', e => {
                        if (id === 'lat-in' || id === 'lon-in') {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                                if (id === 'lat-in') customPresets[currentSelectKey].data.lat = val;
                                else                 customPresets[currentSelectKey].data.lon = val;
                            }
                        } else if (id === 'code-in') {
                            customPresets[currentSelectKey].data.code = e.target.value.toLowerCase().trim().slice(0, 2);
                        }
                        savePresets(customPresets);
                    });
                });
            }

            panel.querySelector('#geo-select').addEventListener('change', (e) => {
                currentSelectKey = e.target.value;
                renderPanel(panel);
            });

            panel.querySelector('#geo-add').onclick = () => {
                const name = prompt('Nhập tên địa điểm mới:');
                if (!name || !name.trim()) return;
                const id = 'custom_' + Date.now();
                customPresets[id] = { name: name.trim(), data: { lat: 21.0, lon: 105.8, code: 'vn' } };
                savePresets(customPresets);
                currentSelectKey = id;
                renderPanel(panel);
            };

            panel.querySelector('#geo-ren').onclick = () => {
                if (currentSelectKey === 'real') return alert('Không thể đổi tên Vị trí gốc!');
                const name = prompt('Tên mới:', customPresets[currentSelectKey].name);
                if (!name || !name.trim() || name.trim() === customPresets[currentSelectKey].name) return;
                customPresets[currentSelectKey].name = name.trim();
                savePresets(customPresets);
                renderPanel(panel);
            };

            panel.querySelector('#geo-del').onclick = () => {
                if (currentSelectKey === 'real') return alert('Không thể xóa Vị trí gốc!');
                if (!confirm(`Xóa địa điểm "${customPresets[currentSelectKey].name}"?`)) return;
                delete customPresets[currentSelectKey];
                savePresets(customPresets);
                currentSelectKey = 'real';
                if (GeoStore.getSavedPreset() !== 'real') {
                    GeoStore.clear(); GeoStore.setUserActive(false); GeoStore.setSavedPreset('real');
                }
                renderPanel(panel);
            };

            const applyBtn = panel.querySelector('#geo-apply-btn');
            applyBtn.addEventListener('mouseover', () => applyBtn.style.background = '#22c55e');
            applyBtn.addEventListener('mouseout',  () => applyBtn.style.background = '#4ade80');
            applyBtn.onclick = () => {
                const confirmed = confirm('Bạn có chắc muốn lưu và tải lại trang không?');
                if (!confirmed) return;

                if (currentSelectKey === 'real') {
                    GeoStore.clear(); GeoStore.setUserActive(false); GeoStore.setSavedPreset('real');
                } else {
                    GeoStore.set(customPresets[currentSelectKey].data);
                    GeoStore.setUserActive(true);
                    GeoStore.setSavedPreset(currentSelectKey);
                }
                window.location.reload();
            };
        }

        applyPanelPosition(panel);

        const minBtn = panel.querySelector('#geo-min-btn');
        if (minBtn) {
            minBtn.onclick = (e) => {
                e.stopPropagation();
                const rectBefore = panel.getBoundingClientRect();
                const centerX = rectBefore.left + rectBefore.width  / 2;
                const centerY = rectBefore.top  + rectBefore.height / 2;

                isMinimized = !isMinimized;
                SafeStorage.set(UI_STATE_KEY, String(isMinimized));
                renderPanel(panel);

                panel.style.bottom = ''; panel.style.right = '';
                const newWidth  = panel.offsetWidth;
                const newHeight = panel.offsetHeight;
                let newLeft = rectBefore.left;
                let newTop  = rectBefore.top;

                if (centerX > window.innerWidth  / 2) newLeft = rectBefore.right  - newWidth;
                if (centerY > window.innerHeight / 2) newTop  = rectBefore.bottom - newHeight;
                newLeft = Math.max(0, Math.min(window.innerWidth  - newWidth,  newLeft));
                newTop  = Math.max(0, Math.min(window.innerHeight - newHeight, newTop));

                panel.style.left = newLeft + 'px';
                panel.style.top  = newTop  + 'px';
                saveCurrentPosition(panel);
            };
        }

        const dragHandle = panel.querySelector('#geo-drag-handle');
        if (dragHandle) makeDraggable(panel, dragHandle);
    }

    // ==================== DRAG LOGIC ====================
    function makeDraggable(panel, handleEl) {
        handleEl.addEventListener('pointerdown', (e) => {
            if (e.target.tagName === 'BUTTON' || (e.target.tagName === 'SPAN' && e.target.id === 'geo-min-btn')) return;
            if (e.button !== 0) return;

            handleEl.setPointerCapture(e.pointerId);
            const rect     = panel.getBoundingClientRect();
            const startX   = e.clientX, startY   = e.clientY;
            const startLeft = rect.left, startTop  = rect.top;

            panel.style.bottom = ''; panel.style.right = '';
            panel.style.top    = startTop  + 'px';
            panel.style.left   = startLeft + 'px';
            handleEl.style.cursor      = 'grabbing';
            document.body.style.userSelect = 'none';

            function onPointerMove(moveEvent) {
                let newLeft = startLeft + (moveEvent.clientX - startX);
                let newTop  = startTop  + (moveEvent.clientY - startY);
                newLeft = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  newLeft));
                newTop  = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
                panel.style.left = newLeft + 'px';
                panel.style.top  = newTop  + 'px';
            }

            function onPointerUp(upEvent) {
                handleEl.releasePointerCapture(upEvent.pointerId);
                handleEl.style.cursor          = 'grab';
                document.body.style.userSelect = '';
                handleEl.removeEventListener('pointermove',  onPointerMove);
                handleEl.removeEventListener('pointerup',    onPointerUp);
                handleEl.removeEventListener('pointercancel', onPointerUp);
                saveCurrentPosition(panel);
            }

            handleEl.addEventListener('pointermove',  onPointerMove);
            handleEl.addEventListener('pointerup',    onPointerUp);
            handleEl.addEventListener('pointercancel', onPointerUp);
            e.preventDefault();
        });
    }

    // ==================== SMART SURVIVABILITY (ANTI-LAG CORE) ====================
    let bodyObserver = null;

    function attachBodyObserver() {
        // [PATCH] Chỉ tạo observer mới nếu chưa có — tránh tạo lại liên tục khi initUI bị gọi nhiều lần
        if (bodyObserver) return;

        bodyObserver = new MutationObserver((mutations) => {
            // 1. PHÁT HIỆN CHUYỂN ROOM qua helper isGameIframe()
            let iframeChanged = false;
            for (const m of mutations) {
                for (const node of [...m.addedNodes, ...m.removedNodes]) {
                    if (isGameIframe(node)) { iframeChanged = true; break; }
                }
                if (iframeChanged) break;
            }

            if (iframeChanged) {
                triggerRoomTransition();
                return;
            }

            // 2. NẾU ĐANG TRONG TRẠNG THÁI CHỐNG GIẬT -> KHÔNG LÀM GÌ CẢ
            if (isRoomTransitioning) return;

            // 3. KHÔI PHỤC PANEL NẾU BỊ MẤT
            if (panelEl && !document.body.contains(panelEl)) {
                try { document.body.appendChild(panelEl); }
                catch (e) { panelEl = null; initUI(); }
            }
        });

        bodyObserver.observe(document.body, { childList: true, subtree: false });
    }

    window.addEventListener('resize', () => {
        if (!isRoomTransitioning) applyPanelPosition(panelEl);
    });

    document.addEventListener('fullscreenchange', () => {
        if (!panelEl) return;
        setTimeout(() => {
            if (!isRoomTransitioning && !document.body.contains(panelEl)) document.body.appendChild(panelEl);
            if (!isRoomTransitioning) applyPanelPosition(panelEl);
        }, 150);
    });

    // ==================== INIT ====================
    function initUI() {
        if (isCreating || !document.body) { setTimeout(initUI, 50); return; }

        const existingPanel = document.getElementById('geo-ls-panel');
        if (existingPanel) {
            if (panelEl === existingPanel && document.body.contains(panelEl)) return;
            existingPanel.remove();
        }
        if (panelEl && document.body.contains(panelEl)) return;

        isCreating = true;
        const panel = document.createElement('div');
        panel.id = 'geo-ls-panel';
        panel.addEventListener('mousedown', (e) => {
            const tag = e.target.tagName;
            if (e.target.closest('.geo-copy-label')) return;
            if (tag !== 'SELECT' && tag !== 'OPTION' && tag !== 'BUTTON' && tag !== 'INPUT') e.preventDefault();
        });
        document.body.appendChild(panel);
        panelEl    = panel;
        isCreating = false;

        renderPanel(panel);
        attachBodyObserver();
    }

    function waitForBody() { if (document.body) initUI(); else setTimeout(waitForBody, 50); }
    waitForBody();

})();
