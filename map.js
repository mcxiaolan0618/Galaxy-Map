// 将角度标准化到 [0, 2*PI]
function normalizeAngle(a) {
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    return a;
}

function drawMap(ctx, width, height, data, view) {
    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    if (view) {
        ctx.translate(view.x, view.y);
        ctx.scale(view.scale, view.scale);
    }

    const { planets, sectors, supplies, factions } = data;
    const getFaction = (id) => factions.find(f => f.id === id) || factions[0];
    const invScale = 1 / (view ? view.scale : 1);

    const mapCenter = { x: 0, y: 0 }; 
    const mapRadius = 1600; // 边界大圆
    const innerRadius = 120; // 中心地球的空白区

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 画内层大圆
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // --- 核心新增：星区防重叠角度计算 ---
    // 先提取所有星区的初始角度区间
    let sectorData = [];
    sectors.forEach((sector, index) => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length === 0) return;

        let angles = [];
        let maxRadius = 0;
        
        pts.forEach(p => {
            const dx = p.x - mapCenter.x;
            const dy = p.y - mapCenter.y;
            const dist = Math.hypot(dx, dy);
            if (dist > maxRadius) maxRadius = dist;
            angles.push(normalizeAngle(Math.atan2(dy, dx)));
        });

        angles.sort((a, b) => a - b);

        let maxGapVal = -1;
        let splitIndex = -1;
        for (let i = 0; i < angles.length; i++) {
            const next = (i + 1) % angles.length;
            let gap = angles[next] - angles[i];
            if (gap < 0) gap += Math.PI * 2;
            if (gap > maxGapVal) {
                maxGapVal = gap;
                splitIndex = next;
            }
        }
        
        let minAngle = angles[splitIndex];
        let maxAngle = angles[(splitIndex - 1 + angles.length) % angles.length];

        let angleDiff = maxAngle - minAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // 保底展开角度
        if (angleDiff < 0.15) {
            let mid = minAngle + angleDiff / 2;
            minAngle = mid - 0.075;
            maxAngle = mid + 0.075;
            angleDiff = 0.15;
        }

        // 给一点基础留白
        minAngle -= 0.02;
        maxAngle += 0.02;

        sectorData.push({
            sector, pts, maxRadius, minAngle, maxAngle
        });
    });

    // 按起始角度排序，解决重叠
    sectorData.sort((a, b) => {
        // 处理跨越0度的问题，统一转成连续角度排序
        let aStart = a.minAngle < 0 ? a.minAngle + Math.PI * 2 : a.minAngle;
        let bStart = b.minAngle < 0 ? b.minAngle + Math.PI * 2 : b.minAngle;
        return aStart - bStart;
    });

    // 强制推开相邻重叠的星区
    for (let i = 0; i < sectorData.length; i++) {
        let current = sectorData[i];
        let next = sectorData[(i + 1) % sectorData.length];
        
        let currentMax = current.maxAngle;
        let nextMin = next.minAngle;

        // 处理跨越 0 度的情况
        if (currentMax < current.minAngle) currentMax += Math.PI * 2; 
        if (nextMin < next.minAngle) nextMin += Math.PI * 2; 

        // 如果当前星区的末尾大于下一个星区的开头，说明重叠了
        if (currentMax > nextMin && i !== sectorData.length - 1) {
            // 计算重叠了多少，各退一步
            let overlap = currentMax - nextMin;
            current.maxAngle -= overlap / 2;
            next.minAngle += overlap / 2;
        }
    }

    // 2. 画星区
    sectorData.forEach(data => {
        let { sector, pts, maxRadius, minAngle, maxAngle } = data;

        let sectorFactionId = 'super_earth';
        for (let i = 0; i < pts.length; i++) {
            if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
        }
        const factionColor = getFaction(sectorFactionId).color;

        // 重新计算确保角度正确
        let angleDiff = maxAngle - minAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // 内圈半径：最大星球距离 + 120 像素留白，确保绝对包裹所有星球
        const r_in = Math.max(innerRadius, maxRadius + 120);
        const r_out = mapRadius; 

        // 绘制扇形色块
        ctx.beginPath();
        ctx.arc(mapCenter.x, mapCenter.y, r_in, minAngle, maxAngle);
        ctx.arc(mapCenter.x, mapCenter.y, r_out, maxAngle, minAngle, true);
        ctx.closePath();

        ctx.fillStyle = factionColor + '0A'; // 极淡底色
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 白色边界
        ctx.lineWidth = 1 * invScale;
        ctx.stroke();

        // 绘制星区名字
        const textAngle = minAngle + angleDiff / 2;
        const textR = maxRadius + 40; 
        const textX = mapCenter.x + Math.cos(textAngle) * textR;
        const textY = mapCenter.y + Math.sin(textAngle) * textR;
        
        ctx.fillStyle = factionColor;
        ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(sector.name, textX, textY);
    });

    // 3. 画补给线（实线，双色）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.2 * invScale;

            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color; ctx.stroke();

            ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color; ctx.stroke();
        }
    });

    // 4. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + 'AA';
        ctx.lineWidth = 1.5 * invScale;
        ctx.stroke();

        ctx.fillStyle = '#e0e4e8';
        ctx.font = `${10 * invScale}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + (12 * invScale), p.y - (2 * invScale));
    });

    ctx.restore();
}