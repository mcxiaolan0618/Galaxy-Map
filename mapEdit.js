<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>星图编辑器 // 箱庭指令</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="canvas-container">
        <canvas id="editCanvas"></canvas>
        <div class="status-bar" id="statusBar">🖐️ 选择/拖拽模式</div>
        <a href="index.html" class="btn btn-primary" style="position:absolute; top:20px; left:20px; width:auto;">🔙 保存并返回视图</a>
    </div>

    <div class="sidebar">
        <div class="sidebar-header">
            <h1>星图编辑器</h1>
        </div>
        <div class="sidebar-content">
            
            <div class="control-group">
                <h2>操作模式</h2>
                <select id="modeSelect">
                    <option value="select">🖐️ 选择/拖拽</option>
                    <option value="add-planet">🪐 快速添加星球</option>
                    <option value="add-supply">🔗 连接补给线</option>
                    <option value="add-sector">🔲 圈定星区</option>
                </select>
            </div>

            <div class="control-group" id="editPlanetPanel" style="display:none; border-color: var(--accent);">
                <h2 style="color: var(--accent);">正在编辑星球</h2>
                <div class="field"><label>英文名</label><input type="text" id="editNameEn" oninput="updatePlanetData()"></div>
                <div class="field"><label>中文名</label><input type="text" id="editNameCn" oninput="updatePlanetData()"></div>
                <div class="field">
                    <label>所属势力</label>
                    <select id="editFaction" onchange="updatePlanetData()"></select>
                </div>
                <button class="btn btn-small" onclick="deselectPlanet()">完成编辑</button>
            </div>

            <div class="control-group">
                <h2>星球列表</h2>
                <div id="planetList" style="max-height: 150px; overflow-y: auto;"></div>
            </div>

            <div class="control-group">
                <h2>星区列表</h2>
                <div id="sectorList" style="max-height: 100px; overflow-y: auto;"></div>
            </div>

            <div class="control-group">
                <h2>补给线列表</h2>
                <div id="supplyList" style="max-height: 100px; overflow-y: auto;"></div>
            </div>

            <div class="control-group">
                <h2>势力管理</h2>
                <div id="factionList" style="max-height: 120px; overflow-y: auto; margin-bottom: 10px;"></div>
                <div class="row">
                    <div class="field"><input type="text" id="newFactEn" placeholder="英文名"></div>
                    <div class="field"><input type="text" id="newFactCn" placeholder="中文名"></div>
                </div>
                <div class="row">
                    <div class="field"><input type="color" id="newFactColor" value="#ff0000" style="height:33px; padding:2px; cursor:pointer;"></div>
                    <div class="field" style="flex: 0.5;"><button class="btn" style="margin:0; height:33px;" onclick="addFaction()">添加</button></div>
                </div>
            </div>
        </div>
    </div>

    <script src="data.js"></script>
    <script src="map.js"></script>
    <script>
        const canvas = document.getElementById('editCanvas');
        const ctx = canvas.getContext('2d');
        const statusBar = document.getElementById('statusBar');
        
        let data = window.MAP_DATA; 
        let width, height;
        let mode = 'select';
        let draggedPlanet = null;
        let dragOffsetX = 0, dragOffsetY = 0;
        let selectedPlanetId = null;
        let supplyStart = null;
        let sectorBox = null;

        function resize() {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            width = canvas.width;
            height = canvas.height;
            draw();
        }
        window.addEventListener('resize', resize);

        function draw() {
            drawMap(ctx, width, height, data);

            if (selectedPlanetId) {
                const p = data.planets.find(x => x.id === selectedPlanetId);
                if (p) {
                    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                }
            }

            if (supplyStart) {
                ctx.beginPath(); ctx.arc(supplyStart.x, supplyStart.y, 16, 0, Math.PI * 2);
                ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 2; ctx.stroke();
            }

            if (sectorBox) {
                ctx.fillStyle = 'rgba(245, 197, 66, 0.1)';
                ctx.strokeStyle = 'rgba(245, 197, 66, 0.8)';
                ctx.lineWidth = 1;
                const x = Math.min(sectorBox.startX, sectorBox.endX);
                const y = Math.min(sectorBox.startY, sectorBox.endY);
                const w = Math.abs(sectorBox.endX - sectorBox.startX);
                const h = Math.abs(sectorBox.endY - sectorBox.startY);
                ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
            }
        }

        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function getPlanetAt(x, y) {
            for (let i = data.planets.length - 1; i >= 0; i--) {
                const p = data.planets[i];
                if (Math.hypot(p.x - x, p.y - y) <= 15) return p;
            }
            return null;
        }

        document.getElementById('modeSelect').addEventListener('change', (e) => {
            mode = e.target.value;
            supplyStart = null;
            sectorBox = null;
            statusBar.innerText = { select: '🖐️ 选择/拖拽模式', 'add-planet': '🪐 点击空白处放置星球', 'add-supply': '🔗 依次点击两颗星球', 'add-sector': '🔲 按住鼠标拖拽框选星区' }[mode];
            draw();
        });

        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            const target = getPlanetAt(pos.x, pos.y);

            // 优先处理拖拽逻辑：只要点到了星球，无论在什么模式，都可以拖拽
            if (target) {
                draggedPlanet = target;
                dragOffsetX = pos.x - target.x;
                dragOffsetY = pos.y - target.y;
                selectPlanet(target.id);
                
                // 如果在连线模式
                if (mode === 'add-supply') {
                    if (!supplyStart) {
                        supplyStart = target;
                    } else {
                        if (supplyStart.id !== target.id) {
                            const exists = data.supplies.some(s => 
                                (s.p1Id === supplyStart.id && s.p2Id === target.id) ||
                                (s.p1Id === target.id && s.p2Id === supplyStart.id)
                            );
                            if (!exists) {
                                data.supplies.push({ id: Date.now().toString(), p1Id: supplyStart.id, p2Id: target.id });
                                updateUI();
                            }
                        }
                        supplyStart = null;
                    }
                }
                return;
            }

            // 如果点到了空白处
            deselectPlanet();
            if (mode === 'add-planet') {
                const newP = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    x: pos.x, y: pos.y, 
                    nameEn: 'New Planet', nameCn: '新星球', 
                    factionId: 'super_earth'
                };
                data.planets.push(newP);
                selectPlanet(newP.id);
                updateUI();
            } 
            else if (mode === 'add-sector') {
                sectorBox = { startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
            }
            else if (mode === 'add-supply') {
                supplyStart = null;
            }
            draw();
        });

        canvas.addEventListener('mousemove', (e) => {
            const pos = getMousePos(e);
            if (draggedPlanet) {
                draggedPlanet.x = pos.x - dragOffsetX;
                draggedPlanet.y = pos.y - dragOffsetY;
                draw();
            }
            else if (mode === 'add-sector' && sectorBox) {
                sectorBox.endX = pos.x;
                sectorBox.endY = pos.y;
                draw();
            }
            else if (mode === 'add-supply' && supplyStart) {
                draw();
                ctx.beginPath(); ctx.moveTo(supplyStart.x, supplyStart.y); ctx.lineTo(pos.x, pos.y);
                ctx.strokeStyle = 'rgba(245, 197, 66, 0.5)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
            } else {
                canvas.style.cursor = getPlanetAt(pos.x, pos.y) ? 'pointer' : (mode === 'add-planet' ? 'crosshair' : 'default');
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (draggedPlanet) draggedPlanet = null;
            else if (mode === 'add-sector' && sectorBox) {
                const minX = Math.min(sectorBox.startX, sectorBox.endX);
                const maxX = Math.max(sectorBox.startX, sectorBox.endX);
                const minY = Math.min(sectorBox.startY, sectorBox.endY);
                const maxY = Math.max(sectorBox.startY, sectorBox.endY);

                const ids = data.planets.filter(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY).map(p => p.id);
                if (ids.length > 0) {
                    const name = prompt("星区名称:", "新星区");
                    if (name) {
                        data.sectors.push({ id: Date.now().toString(), name, planetIds: ids });
                        updateUI();
                    }
                }
                sectorBox = null;
                draw();
            }
        });

        document.addEventListener('mouseup', () => { draggedPlanet = null; });

        // --- 数据绑定 ---
        function selectPlanet(id) {
            selectedPlanetId = id;
            const p = data.planets.find(x => x.id === id);
            if (p) {
                document.getElementById('editPlanetPanel').style.display = 'block';
                document.getElementById('editNameEn').value = p.nameEn;
                document.getElementById('editNameCn').value = p.nameCn;
                document.getElementById('editFaction').value = p.factionId;
            }
            updateUI(); draw();
        }

        function deselectPlanet() {
            selectedPlanetId = null;
            document.getElementById('editPlanetPanel').style.display = 'none';
            updateUI(); draw();
        }

        function updatePlanetData() {
            if (!selectedPlanetId) return;
            const p = data.planets.find(x => x.id === selectedPlanetId);
            if (p) {
                p.nameEn = document.getElementById('editNameEn').value;
                p.nameCn = document.getElementById('editNameCn').value;
                p.factionId = document.getElementById('editFaction').value;
                updateUI(); draw();
            }
        }

        function addFaction() {
            const en = document.getElementById('newFactEn').value.trim();
            const cn = document.getElementById('newFactCn').value.trim();
            const color = document.getElementById('newFactColor').value;
            if (!en || !cn) return alert('请填写势力中英文名');
            
            data.factions.push({ id: 'fact_' + Date.now(), nameEn: en, nameCn: cn, color, fixed: false });
            document.getElementById('newFactEn').value = '';
            document.getElementById('newFactCn').value = '';
            updateUI(); draw();
        }

        function deleteFaction(id) {
            if (id === 'super_earth') return;
            data.planets.forEach(p => { if (p.factionId === id) p.factionId = 'super_earth'; });
            data.factions = data.factions.filter(f => f.id !== id);
            updateUI(); draw();
        }

        function deletePlanet(id) {
            data.planets = data.planets.filter(p => p.id !== id);
            data.supplies = data.supplies.filter(s => s.p1Id !== id && s.p2Id !== id);
            data.sectors.forEach(s => s.planetIds = s.planetIds.filter(pid => pid !== id));
            data.sectors = data.sectors.filter(s => s.planetIds.length > 0);
            if (selectedPlanetId === id) deselectPlanet();
            updateUI(); draw();
        }

        function deleteSector(id) { data.sectors = data.sectors.filter(s => s.id !== id); updateUI(); draw(); }
        function deleteSupply(id) { data.supplies = data.supplies.filter(s => s.id !== id); updateUI(); draw(); }

        function updateUI() {
            // 自动保存到浏览器
            localStorage.setItem('starMapData', JSON.stringify(data));

            const fList = document.getElementById('factionList');
            fList.innerHTML = '';
            data.factions.forEach(f => {
                fList.innerHTML += `<div class="list-item"><span class="name"><span class="color-dot" style="background:${f.color}"></span>${f.nameCn}</span>${f.fixed ? '' : `<span class="delete-btn" onclick="deleteFaction('${f.id}')">✕</span>`}</div>`;
            });

            const fSelect = document.getElementById('editFaction');
            fSelect.innerHTML = '';
            data.factions.forEach(f => { fSelect.innerHTML += `<option value="${f.id}">${f.nameCn} (${f.nameEn})</option>`; });

            const pList = document.getElementById('planetList');
            pList.innerHTML = '';
            data.planets.forEach(p => {
                const f = data.factions.find(x => x.id === p.factionId) || data.factions[0];
                pList.innerHTML += `<div class="list-item" ${p.id === selectedPlanetId ? 'style="border-color:var(--accent)"' : ''}><span class="name" onclick="selectPlanet('${p.id}')"><span class="color-dot" style="background:${f.color}"></span>${p.nameCn}</span><span class="delete-btn" onclick="deletePlanet('${p.id}')">✕</span></div>`;
            });

            const sList = document.getElementById('sectorList');
            sList.innerHTML = '';
            data.sectors.forEach(s => { sList.innerHTML += `<div class="list-item"><span class="name">🔲 ${s.name}</span><span class="delete-btn" onclick="deleteSector('${s.id}')">✕</span></div>`; });

            const supList = document.getElementById('supplyList');
            supList.innerHTML = '';
            data.supplies.forEach(s => {
                const p1 = data.planets.find(x => x.id === s.p1Id);
                const p2 = data.planets.find(x => x.id === s.p2Id);
                if (p1 && p2) supList.innerHTML += `<div class="list-item"><span class="name">🔗 ${p1.nameEn} ↔ ${p2.nameEn}</span><span class="delete-btn" onclick="deleteSupply('${s.id}')">✕</span></div>`;
            });

            if (selectedPlanetId) {
                const p = data.planets.find(x => x.id === selectedPlanetId);
                if (p) {
                    document.getElementById('editNameEn').value = p.nameEn;
                    document.getElementById('editNameCn').value = p.nameCn;
                    document.getElementById('editFaction').value = p.factionId;
                }
            }
        }

        resize();
        updateUI();
    </script>
</body>
</html>