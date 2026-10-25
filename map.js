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

    // 2. 画星区（披萨切割法 - 完美包裹版）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 获取所有星球的角度 (0 ~ 2PI) 和 最大半径
            let angles = [];
            let maxRadius = 0;
            
            pts.forEach(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const dist = Math.hypot(dx, dy);
                if (dist > maxRadius) maxRadius = dist;
                
                let angle = Math.atan2(dy, dx);
                angles.push(normalizeAngle(angle));
            });

            angles.sort((a, b) => a - b);

            // 核心算法：寻找最小的包含所有星球的扇形区域
            let minAngle = angles[0];
            let maxAngle = angles[angles.length - 1];
            let minGap = (angles[0] + Math.PI * 2) - angles[angles.length - 1];

            // 检查跨越 0 度的情况
            for (let i = 0; i < angles.length - 1; i++) {
                const gap = angles[i + 1] - angles[i];
                if (gap < minGap) {
                    minGap = gap;
                    maxAngle = angles[i];
                    minAngle = angles[i + 1];
                }
            }

            // 此时 minAngle > maxAngle 表示跨越了 0 度
            // 如果没有跨越 0 度，且 gap 不是跨 0 度的 gap，则恢复
            if (minGap === (angles[0] + Math.PI * 2) - angles[angles.length - 1]) {
                minAngle = angles[0];
                maxAngle = angles[angles.length - 1];
            } else if (minAngle < maxAngle) {
                // 处理跨 0 度的情况
                minAngle = angles[minGap === (angles[0] + Math.PI * 2) - angles[angles.length - 1] ? 0 : angles.indexOf(maxAngle) + 1] || angles[0];
            }

            // 更简单的判断：如果最大的间隔是在首尾，那么首尾就是我们的区间
            // 如果最大的间隔在中间，那么首尾是跨越的
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
            
            // 此时分离点找到了，包含所有星球的最小区间是从 splitIndex 到 splitIndex - 1
            minAngle = angles[splitIndex];
            maxAngle = angles[(splitIndex - 1 + angles.length) % angles.length];

            // 展平角度差异
            let angleDiff = maxAngle - minAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            // 如果星球非常密集，强制给一个最小展开角度，不然会变成细线
            if (angleDiff < 0.15) {
                let mid = minAngle + angleDiff / 2;
                minAngle = mid - 0.075;
                maxAngle = mid + 0.075;
                angleDiff = 0.15;
            }

            // 向内外部留白（强制扩展角度）
            const anglePadding = 0.08;
            minAngle -= anglePadding;
            maxAngle += anglePadding;
            angleDiff += anglePadding * 2;

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