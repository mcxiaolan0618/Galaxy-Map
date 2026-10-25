let data = JSON.parse(JSON.stringify(window.MAP_DATA)); // 深拷贝
const canvas = document.getElementById('editCanvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('statusBar');

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

    // 绘制编辑器特有的视觉效果
    // 选中的高亮
    if (selectedPlanetId) {
        const p = data.planets.find(x => x.id === selectedPlanetId);
        if (p) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // 连线的临时高亮
    if (supplyStart) {
        ctx.beginPath();
        ctx.arc(supplyStart.x, supplyStart.y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = '#f5c542';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // 星区框选
    if (sectorBox) {
        ctx.fillStyle = 'rgba(245, 197, 66, 0.1)';
        ctx.strokeStyle = 'rgba(245, 197, 66, 0.8)';
        ctx.lineWidth = 1;
        const x = Math.min(sectorBox.startX, sectorBox.endX);
        const y = Math.min(sectorBox.startY, sectorBox.endY);
        const w = Math.abs(sectorBox.endX - sectorBox.startX);
        const h = Math.abs(sectorBox.endY - sectorBox.startY);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    }
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getPlanetAt(x, y) {
    for (let i = data.planets.length - 1; i >= 0; i--) {
        const p = data.planets[i];
        if (Math.hypot(p.x - x, p.y - y) <= 12) return p;
    }
    return null;
}

document.getElementById('modeSelect').addEventListener('change', (e) => {
    mode = e.target.value;
    supplyStart = null;
    sectorBox = null;
    const tips = { select: '🖐️ 选择/拖拽', 'add-planet': '🪐 点击添加星球', 'add-supply': '🔗 点击两星连线', 'add-sector': '🔲 框选星区' };
    statusBar.innerText = tips[mode];
    draw();
});

canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    const target = getPlanetAt(pos.x, pos.y);

    if (mode === 'select') {
        if (target) {
            draggedPlanet = target;
            dragOffsetX = pos.x - target.x;
            dragOffsetY = pos.y - target.y;
            selectPlanet(target.id);
        } else {
            deselectPlanet();
        }
    } 
    else if (mode === 'add-planet') {
        const en = prompt("英文名:", "New Planet");
        if (en === null) return;
        const cn = prompt("中文名:", "新星球");
        if (cn === null) return;
        data.planets.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            x: pos.x, y: pos.y, nameEn: en, nameCn: cn, factionId: 'super_earth'
        });
        updateUI(); draw();
    }
    else if (mode === 'add-supply') {
        if (target) {
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
        } else supplyStart = null;
        draw();
    }
    else if (mode === 'add-sector') {
        sectorBox = { startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
    }
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    if (mode === 'select' && draggedPlanet) {
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
        ctx.beginPath();
        ctx.moveTo(supplyStart.x, supplyStart.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = 'rgba(245, 197, 66, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    } else {
        canvas.style.cursor = getPlanetAt(pos.x, pos.y) ? 'pointer' : 'crosshair';
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (mode === 'select' && draggedPlanet) draggedPlanet = null;
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

document.addEventListener('mouseup', () => { if (mode === 'select') draggedPlanet = null; });

// --- 数据绑定与UI ---
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
    if (!en || !cn) return alert('请填写势力名');
    
    data.factions.push({ id: 'fact_' + Date.now(), nameEn: en, nameCn: cn, color, fixed: false });
    document.getElementById('newFactEn').value = '';
    document.getElementById('newFactCn').value = '';
    updateUI(); draw();
}

function deleteFaction(id) {
    if (id === 'super_earth') return;
    const pCount = data.planets.filter(p => p.factionId === id).length;
    if (pCount > 0 && !confirm(`该势力下有 ${pCount} 颗星球，将收归超级地球，确定删除？`)) return;
    
    data.planets.forEach(p => { if (p.factionId === id) p.factionId = 'super_earth'; });
    data.factions = data.factions.filter(f => f.id !== id);
    updateUI(); draw();
}

function deletePlanet(id) {
    if (!confirm("删除星球及关联数据？")) return;
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
    // 势力列表
    const fList = document.getElementById('factionList');
    fList.innerHTML = '';
    data.factions.forEach(f => {
        fList.innerHTML += `<div class="list-item">
            <span class="name"><span class="color-dot" style="background:${f.color}"></span>${f.nameCn}</span>
            ${f.fixed ? '' : `<span class="delete-btn" onclick="deleteFaction('${f.id}')">✕</span>`}
        </div>`;
    });

    // 势力下拉框
    const fSelect = document.getElementById('editFaction');
    fSelect.innerHTML = '';
    data.factions.forEach(f => {
        fSelect.innerHTML += `<option value="${f.id}">${f.nameCn} (${f.nameEn})</option>`;
    });

    // 星球
    const pList = document.getElementById('planetList');
    pList.innerHTML = '';
    data.planets.forEach(p => {
        const f = data.factions.find(x => x.id === p.factionId) || data.factions[0];
        pList.innerHTML += `<div class="list-item" ${p.id === selectedPlanetId ? 'style="border-color:var(--accent)"' : ''}>
            <span class="name" onclick="selectPlanet('${p.id}')"><span class="color-dot" style="background:${f.color}"></span>${p.nameCn} (${p.nameEn})</span>
            <span class="delete-btn" onclick="deletePlanet('${p.id}')">✕</span>
        </div>`;
    });

    // 星区
    const sList = document.getElementById('sectorList');
    sList.innerHTML = '';
    data.sectors.forEach(s => {
        sList.innerHTML += `<div class="list-item">
            <span class="name">🔲 ${s.name}</span>
            <span class="delete-btn" onclick="deleteSector('${s.id}')">✕</span>
        </div>`;
    });

    // 补给线
    const supList = document.getElementById('supplyList');
    supList.innerHTML = '';
    data.supplies.forEach(s => {
        const p1 = data.planets.find(x => x.id === s.p1Id);
        const p2 = data.planets.find(x => x.id === s.p2Id);
        if (p1 && p2) {
            supList.innerHTML += `<div class="list-item">
                <span class="name">🔗 ${p1.nameEn} ↔ ${p2.nameEn}</span>
                <span class="delete-btn" onclick="deleteSupply('${s.id}')">✕</span>
            </div>`;
        }
    });

    // 保持输入框数据同步
    if (selectedPlanetId) {
        const p = data.planets.find(x => x.id === selectedPlanetId);
        if (p) {
            document.getElementById('editNameEn').value = p.nameEn;
            document.getElementById('editNameCn').value = p.nameCn;
            document.getElementById('editFaction').value = p.factionId;
        }
    }
}

// --- 存储逻辑 ---
function saveToDataJS() {
    const jsContent = `window.MAP_DATA = ${JSON.stringify(data, null, 4)};`;
    const blob = new Blob([jsContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    a.click();
    URL.revokeObjectURL(url);
    alert('已下载新的 data.js！\n\n请用它替换你网站文件夹里的原有 data.js 文件，刷新 index.html 即可看到更新后的地图！');
}

function importData(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            data = imported;
            deselectPlanet();
            updateUI(); draw();
            alert('导入成功！别忘了点“保存并应用到网站”下载 data.js。');
        } catch (err) {
            alert('导入失败，文件格式错误。');
        }
    };
    reader.readAsText(input.files[0]);
}

// 启动初始化
resize();
updateUI();