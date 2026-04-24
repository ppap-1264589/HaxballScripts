// ==UserScript==
// @name         Geo-Overrider
// @namespace    http://tampermonkey.net/
// @version      3.9.5
// @description  Fake GPS bằng cách đè localStorage 'geo' và API navigator.geolocation (Tối ưu chuẩn Haxball + Fix Fullscreen + Rút gọn hiển thị Toạ độ)
// @author       Hoang1264589
// @match        *://*.haxball.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window.self) return;

    // ==================== CONFIG ====================
    const GEO_KEY        = 'geo';
    const UI_STATE_KEY   = 'hax_geo_isMinimized';
    const UI_POS_KEY     = 'hax_geo_pos';
    const ACTIVE_KEY     = 'hax_geo_active';
    const PRESET_KEY     = 'hax_geo_preset';

    const PRESETS = {
        real: { name: '📍 Vị trí browser', data: null },
        vn:   {
            name: '🇻🇳 Hà Nội, VN',
            data: {
                lat: 21.024512345678,
                lon: 105.841171234567,
                code: 'vn'
            }
        },
        gb:   {
            name: '🇬🇧 Old Trafford, GB',
            data: {
                lat: 53.4631,
                lon: -2.2913,
                code: 'gb'
            }
        },
        us:   {
            name: '🇺🇸 New York, US',
            data: {
                lat: 40.7128,
                lon: -74.0060,
                code: 'us'
            }
        },

        ar:   {
            name: '🇦🇷 Río Cuarto, AR',
            data: {
                lat: -33.122072960747076,
                lon: -64.34915075283122,
                code: 'ar'
            }
        },
    };

    // ==================== GEO STORE ====================
    const GeoStore = {
        get() {
            try {
                const raw = localStorage.getItem(GEO_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (parsed?.lat != null && parsed?.lon != null) return parsed;
            } catch { }
            return null;
        },
        set(data)  { localStorage.setItem(GEO_KEY, JSON.stringify(data)); },
        clear()    { localStorage.removeItem(GEO_KEY); },
        isUserActive()     { return localStorage.getItem(ACTIVE_KEY) === 'true'; },
        setUserActive(v)   { localStorage.setItem(ACTIVE_KEY, v ? 'true' : 'false'); },
        getSavedPreset()   { return localStorage.getItem(PRESET_KEY) || 'real'; },
        setSavedPreset(k)  { localStorage.setItem(PRESET_KEY, k); },
    };

    // ==================== GPS API MOCK ====================
    function injectGpsMock() {
        const script = document.createElement('script');
        script.textContent = `(${function (GEO_KEY) {
            const geo = navigator.geolocation;
            const _getCurrentPosition = geo.getCurrentPosition.bind(geo);
            const _watchPosition      = geo.watchPosition.bind(geo);
            const watchMap = new Map();
            let watchIdCounter = 10000;

            function buildMockPosition(lat, lon) {
                return {
                    coords: { latitude: lat, longitude: lon, accuracy: 20, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                    timestamp: Date.now()
                };
            }

            function getMock() {
                try {
                    const raw = localStorage.getItem(GEO_KEY);
                    if (!raw) return null;
                    const p = JSON.parse(raw);
                    if (p?.lat != null && p?.lon != null) return buildMockPosition(p.lat, p.lon);
                } catch { }
                return null;
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
                    watchMap.set(fakeId, intervalId);
                    return fakeId;
                }
                return _watchPosition(success, error, options);
            };

            geo.clearWatch = function (id) {
                if (watchMap.has(id)) {
                    clearInterval(watchMap.get(id));
                    watchMap.delete(id);
                } else {
                    const origClear = navigator.geolocation.__proto__.clearWatch;
                    if (origClear) origClear.call(navigator.geolocation, id);
                }
            };
        }.toString()})(${JSON.stringify(GEO_KEY)});`;

        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }
    injectGpsMock();

    // ==================== UI PANEL LOGIC ====================
    let isMinimized = localStorage.getItem(UI_STATE_KEY) === 'true';
    let panelUpdateInterval = null;
    let panelEl = null;
    let isCreating = false;

    // STATE: LƯU TOẠ ĐỘ THEO TỶ LỆ PHẦN TRĂM (%) ĐỂ RESIZE/F11 KHÔNG BỊ LỆCH
    const PosState = {
        get() {
            try { const raw = localStorage.getItem(UI_POS_KEY); if (raw) return JSON.parse(raw); } catch { }
            return null;
        },
        save(xPct, yPct) { localStorage.setItem(UI_POS_KEY, JSON.stringify({ xPct, yPct })); }
    };

    // HÀM TÍNH TOÁN & LƯU TỶ LỆ (%) TỪ VỊ TRÍ HIỆN TẠI
    function saveCurrentPosition(panel) {
        if (!panel) return;
        const left = parseFloat(panel.style.left) || panel.getBoundingClientRect().left;
        const top  = parseFloat(panel.style.top)  || panel.getBoundingClientRect().top;
        const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);

        const xPct = maxX > 0 ? Math.max(0, Math.min(1, left / maxX)) : 0;
        const yPct = maxY > 0 ? Math.max(0, Math.min(1, top / maxY)) : 0;

        PosState.save(xPct, yPct);
    }

    // HÀM ÁP DỤNG VỊ TRÍ THEO TỶ LỆ (Responsive)
    function applyPanelPosition(panel) {
        if (!panel) return;
        const pos = PosState.get();

        if (pos) {
            panel.style.bottom = '';
            panel.style.right = '';

            let xPct = 0;
            let yPct = 0;

            if (typeof pos.xPct === 'number') {
                xPct = pos.xPct;
                yPct = pos.yPct;
            } else if (typeof pos.left === 'number') {
                // Tự động Migrate/Fix data cũ (Pixel -> %)
                const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
                const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
                xPct = maxX > 0 ? Math.max(0, Math.min(1, pos.left / maxX)) : 0;
                yPct = maxY > 0 ? Math.max(0, Math.min(1, pos.top / maxY)) : 0;
                PosState.save(xPct, yPct);
            }

            const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
            const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);

            panel.style.left = (xPct * maxX) + 'px';
            panel.style.top  = (yPct * maxY) + 'px';
        } else {
            // Mặc định ban đầu
            panel.style.top = ''; panel.style.left = '';
            panel.style.bottom = '845px';
            panel.style.right = '125px';
        }
    }

    function renderPanel(panel) {
        clearInterval(panelUpdateInterval);

        const active    = GeoStore.isUserActive();
        const presetKey = GeoStore.getSavedPreset();
        const preset    = (active && presetKey !== 'real') ? PRESETS[presetKey] : null;
        const currentGeo = GeoStore.get();

        panel.removeAttribute('style');
        Object.assign(panel.style, {
            position: 'fixed', zIndex: 2147483647,
            background: 'rgba(26, 26, 46, 0.95)', color: '#ddd', border: '1px solid #3a3a5a',
            fontFamily: 'sans-serif', userSelect: 'none', boxSizing: 'border-box',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        });

        // Hàm helper giới hạn hiển thị tối đa 4 chữ số thập phân
        const formatCoord = (val) => typeof val === 'number' ? parseFloat(val.toFixed(4)) : val;

        if (isMinimized) {
            Object.assign(panel.style, { padding: '8px 12px', minWidth: '110px' });
            const label = active ? (PRESETS[presetKey]?.name.split(',')[0] || 'Fake') : '📍 Vị trí browser';
            const dotColor = active ? '#4ade80' : '#f87171';
            panel.innerHTML = `
                <div id="geo-drag-handle" style="display:flex; align-items:center; gap:8px; cursor:grab; touch-action:none;">
                    <span style="color:${dotColor}; font-size:11px; text-shadow: 0 0 5px ${dotColor};">${active ? '●' : '○'}</span>
                    <span style="font-size:12px; font-weight:600; color:#eee;">${label}</span>
                    <span id="geo-min-btn" style="font-size:14px; color:#aaa; margin-left:auto; cursor:pointer;" title="Phóng to">⛶</span>
                </div>
            `;
        } else {
            Object.assign(panel.style, { padding: '14px', width: '220px' });

            let infoHtml = '';
            if (preset) {
                const latFmt = formatCoord(preset.data.lat);
                const lonFmt = formatCoord(preset.data.lon);
                infoHtml = `
                    <div style="font-size:13px; font-weight:bold; color:#fff; margin-bottom:4px;">${preset.name.split(',')[0].trim()}</div>
                    <div style="display:flex; gap:10px; user-select:text; cursor:text;">
                        <span style="font-size:11px; color:#aaa;">Lat: <span style="color:#7dd3fc; font-weight:bold;">${latFmt}</span></span>
                        <span style="font-size:11px; color:#aaa;">Lon: <span style="color:#7dd3fc; font-weight:bold;">${lonFmt}</span></span>
                    </div>
                `;
            } else if (currentGeo) {
                const latFmt = formatCoord(currentGeo.lat);
                const lonFmt = formatCoord(currentGeo.lon);
                infoHtml = `
                    <div style="font-size:13px; font-weight:bold; color:#fff; margin-bottom:4px;">Trình duyệt cấp phép</div>
                    <div style="display:flex; gap:10px; user-select:text; cursor:text;">
                        <span style="font-size:11px; color:#aaa;">Lat: <span style="color:#a855f7; font-weight:bold;">${latFmt}</span></span>
                        <span style="font-size:11px; color:#aaa;">Lon: <span style="color:#a855f7; font-weight:bold;">${lonFmt}</span></span>
                    </div>
                `;
            } else {
                infoHtml = `<div style="font-size:12px; color:#555; font-style:italic;">— Đang chờ lấy vị trí... —</div>`;
                panelUpdateInterval = setInterval(() => {
                    if (GeoStore.get()) renderPanel(panel);
                }, 1000);
            }

            let optionsHtml = '';
            for (const [k, p] of Object.entries(PRESETS)) {
                optionsHtml += `<option value="${k}" ${k === presetKey ? 'selected' : ''} style="background:#1a1a2e;">${p.name}</option>`;
            }

            panel.innerHTML = `
                <div id="geo-drag-handle" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.15); cursor:grab; touch-action:none;">
                    <span style="font-size:12px; font-weight:900; letter-spacing:0.05em; color:#fff; pointer-events:none;">🌍 GEO OVERRIDER</span>
                    <button id="geo-min-btn" title="Thu nhỏ" style="background:none; border:none; color:#aaa; cursor:pointer; font-size:20px; line-height:0.5; padding:0 4px; font-weight:bold;">–</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:12px; color:#bbb;">Trạng thái</span>
                    <span style="display:inline-block; padding:3px 8px; border-radius:20px; font-size:10px; font-weight:bold; background:${active ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}; color:${active ? '#4ade80' : '#f87171'}; border:1px solid ${active ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}; box-shadow: 0 0 5px ${active ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'};">
                        ${active ? '🟢 ĐANG BẬT' : '🔴 ĐÃ TẮT'}
                    </span>
                </div>
                <div style="background:rgba(0,0,0,0.4); border:1px solid #333; border-radius:6px; padding:8px 10px; margin-bottom:12px;">
                    <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:5px;">${active ? 'Đang fake tại' : 'Vị trí hiện tại'}</div>
                    ${infoHtml}
                </div>
                <label style="font-size:12px; color:#bbb; display:block; margin-bottom:6px;">Chọn khu vực:</label>
                <select id="geo-select" style="width:100%; background:rgba(0,0,0,0.4); color:#eee; border:1px solid #555; padding:7px 8px; border-radius:4px; font-size:12px; outline:none; cursor:pointer; margin-bottom:12px; font-family:sans-serif;">
                    ${optionsHtml}
                </select>
                <button id="geo-apply-btn" style="width:100%; padding:9px; background:#4ade80; color:#064e3b; font-weight:bold; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-family:sans-serif; text-transform:uppercase; transition: background 0.2s;">💾 Lưu & Tải Lại</button>
            `;
        }

        // Áp dụng tọa độ % sau khi giao diện đã có kích thước thực
        applyPanelPosition(panel);

        const minBtn = panel.querySelector('#geo-min-btn');
        if (minBtn) {
            minBtn.onclick = (e) => {
                e.stopPropagation();
                const rectBefore = panel.getBoundingClientRect();
                const centerX = rectBefore.left + rectBefore.width / 2;
                const centerY = rectBefore.top + rectBefore.height / 2;

                isMinimized = !isMinimized;
                localStorage.setItem(UI_STATE_KEY, String(isMinimized));
                renderPanel(panel);

                panel.style.bottom = '';
                panel.style.right = '';

                const newWidth = panel.offsetWidth;
                const newHeight = panel.offsetHeight;

                let newLeft = rectBefore.left;
                let newTop = rectBefore.top;

                // Smart Anchor: Giữ mép dựa theo vị trí màn hình hiện tại
                if (centerX > window.innerWidth / 2) newLeft = rectBefore.right - newWidth;
                if (centerY > window.innerHeight / 2) newTop = rectBefore.bottom - newHeight;

                // Tránh tràn màn hình
                newLeft = Math.max(0, Math.min(window.innerWidth - newWidth, newLeft));
                newTop  = Math.max(0, Math.min(window.innerHeight - newHeight, newTop));

                panel.style.left = newLeft + 'px';
                panel.style.top = newTop + 'px';

                // Lưu lại theo phần trăm (%)
                saveCurrentPosition(panel);
            };
        }

        const applyBtn = panel.querySelector('#geo-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('mouseover', () => applyBtn.style.background = '#22c55e');
            applyBtn.addEventListener('mouseout', () => applyBtn.style.background = '#4ade80');
            applyBtn.onclick = () => {
                const selected = panel.querySelector('#geo-select').value;
                if (selected === 'real') {
                    GeoStore.clear();
                    GeoStore.setUserActive(false);
                    GeoStore.setSavedPreset('real');
                } else {
                    GeoStore.set(PRESETS[selected].data);
                    GeoStore.setUserActive(true);
                    GeoStore.setSavedPreset(selected);
                }
                window.location.reload();
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

            let startX = e.clientX;
            let startY = e.clientY;

            const rect = panel.getBoundingClientRect();
            let startLeft = rect.left;
            let startTop  = rect.top;

            panel.style.bottom = '';
            panel.style.right  = '';
            panel.style.top    = startTop  + 'px';
            panel.style.left   = startLeft + 'px';

            handleEl.style.cursor = 'grabbing';
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
                handleEl.style.cursor = 'grab';
                document.body.style.userSelect = '';

                handleEl.removeEventListener('pointermove', onPointerMove);
                handleEl.removeEventListener('pointerup', onPointerUp);
                handleEl.removeEventListener('pointercancel', onPointerUp);

                // Sau khi kéo thả xong, lưu toạ độ mới dưới dạng % tỷ lệ màn hình
                saveCurrentPosition(panel);
            }

            handleEl.addEventListener('pointermove', onPointerMove);
            handleEl.addEventListener('pointerup', onPointerUp);
            handleEl.addEventListener('pointercancel', onPointerUp);
            e.preventDefault();
        });
    }

    // ==================== RESPONSIVE LISTENERS ====================
    // Khi resize hoặc F11, gọi lại hàm apply toạ độ phần trăm
    window.addEventListener('resize', () => {
        applyPanelPosition(panelEl);
    });

    document.addEventListener('fullscreenchange', () => {
        if (!panelEl) return;
        setTimeout(() => {
            if (!document.body.contains(panelEl)) {
                document.body.appendChild(panelEl);
            }
            applyPanelPosition(panelEl);
        }, 150);
    });

    setInterval(() => {
        if (!document.body) return;
        if (!panelEl || !document.body.contains(panelEl)) {
            if (panelEl) panelEl.remove();
            initUI();
        }
    }, 1000);

    // ==================== INIT ====================
    function initUI() {
        if (isCreating) return;

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
            const isSelectable = window.getComputedStyle(e.target).userSelect !== 'none';
            if (tag !== 'SELECT' && tag !== 'OPTION' && tag !== 'BUTTON' && !isSelectable) {
                e.preventDefault();
            }
        });

        document.body.appendChild(panel);
        panelEl = panel;
        isCreating = false;
        renderPanel(panel);
    }

    function waitForBody() {
        if (document.body) {
            initUI();
        } else {
            setTimeout(waitForBody, 50);
        }
    }

    waitForBody();

})();