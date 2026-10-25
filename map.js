// 计算弧度
function getAngle(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

// 将角度标准化到 [-PI, PI]
function normalizeAngle(a) {
    while (a <= -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
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
    const innerRadius = 120; // 中间地球的空白区

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 画内层大圆（可选，为了美观）
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（披萨切割法）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 计算所有星球的极角和极径
            let minAngle = Math.PI * 2;
            let maxAngle = -Math.PI * 2;
            let maxRadius = 0;

            pts.forEach(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const dist = Math.hypot(dx, dy);
                if (dist > maxRadius) maxRadius = dist;

                let angle = Math.atan2(dy, dx);
                // 处理跨越 -PI 和 PI 边界的情况 (比如在正左方)
                if (angle < 0 && maxAngle > Math.PI / 2) angle += Math.PI * 2;
                if (angle > 0 && minAngle < -Math.PI / 2) angle -= Math.PI * 2;

                if (angle < minAngle) minAngle = angle;
                if (angle > maxAngle) maxAngle = angle;
            });

            // 如果只跨越了一个很小的区域（或者只有1颗星球），给个默认角度展开
            if (maxAngle - minAngle < 0.2) {
                const mid = (minAngle + maxAngle) / 2;
                minAngle = mid - 0.2;
                maxAngle = mid + 0.2;
            }

            // 强制外扩角度（不贴边）
            minAngle -= 0.1;
            maxAngle += 0.1;

            // 计算边界坐标点
            const r_in = Math.max(innerRadius, maxRadius - 100); // 内部切割点
            const r_out = mapRadius; // 外部大圆

            const p1_in = { x: Math.cos(minAngle) * r_in, y: Math.sin(minAngle) * r_in };
            const p2_in = { x: Math.cos(maxAngle) * r_in, y: Math.sin(maxAngle) * r_in };
            const p1_out = { x: Math.cos(minAngle) * r_out, y: Math.sin(minAngle) * r_out };
            const p2_out = { x: Math.cos(maxAngle) * r_out, y: Math.sin(maxAngle) * r_out };

            // 绘制多边形色块
            ctx.beginPath();
            // 内圈弧线
            ctx.arc(mapCenter.x, mapCenter.y, r_in, minAngle, maxAngle);
            // 向外射线
            ctx.lineTo(p2_out.x, p2_out.y);
            // 外圈大弧线 (可选，如果直接连直线就是直线，这里沿外圈画弧线)
            ctx.arc(mapCenter.x, mapCenter.y, r_out, maxAngle, minAngle, true);
            ctx.closePath();

            ctx.fillStyle = factionColor + '0A'; // 极淡的底色
            ctx.fill();
            
            // 边界线（白色实线）
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1 * invScale;
            ctx.stroke();

            // 绘制星区名字 (放在中心角度，最远距离稍外的位置)
            const midAngle = (minAngle + maxAngle) / 2;
            const textR = maxRadius + 40;
            const textX = Math.cos(midAngle) * textR;
            const textY = Math.sin(midAngle) * textR;
            
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, textX, textY);
        }
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