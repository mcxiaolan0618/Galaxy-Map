// 计算凸包 (Andrew's monotone chain algorithm)
function getConvexHull(points) {
    if (points.length <= 3) return points;
    let sorted = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    let lower = [];
    for (let i = 0; i < sorted.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) lower.pop();
        lower.push(sorted[i]);
    }
    let upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop();
        upper.push(sorted[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

// 计算多边形重心（用于把点向外推）
function getCentroid(points) {
    let x = 0, y = 0;
    points.forEach(p => { x += p.x; y += p.y; });
    return { x: x / points.length, y: y / points.length };
}

function drawMap(ctx, width, height, data) {
    ctx.clearRect(0, 0, width, height);
    const { planets, sectors, supplies, factions } = data;
    const getFaction = (id) => factions.find(f => f.id === id) || factions[0];

    // 1. 画星区（多边形凸包）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            // 颜色逻辑：只要有一个非超级地球，就取第一个非超级地球的颜色
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') {
                    sectorFactionId = pts[i].factionId;
                    break;
                }
            }
            const factionColor = getFaction(sectorFactionId).color;

            if (pts.length === 1) {
                // 如果只有一个星球，画个圆
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, 40, 0, Math.PI * 2);
                ctx.fillStyle = factionColor + '15';
                ctx.fill();
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                ctx.fillStyle = factionColor;
                ctx.font = '12px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(sector.name, pts[0].x, pts[0].y - 50);
            } else {
                // 多颗星球，计算凸包
                const hull = getConvexHull(pts);
                const centroid = getCentroid(hull);
                const padding = 35; // 向外扩张的距离，决定星区线离星球有多远

                // 将凸包上的点向外推，形成外轮廓
                const expandedHull = hull.map(p => {
                    const dx = p.x - centroid.x;
                    const dy = p.y - centroid.y;
                    const len = Math.hypot(dx, dy);
                    if (len === 0) return { x: p.x, y: p.y };
                    return {
                        x: p.x + (dx / len) * padding,
                        y: p.y + (dy / len) * padding
                    };
                });

                // 绘制多边形（带圆角）
                ctx.beginPath();
                const r = 15; // 圆角半径
                for (let i = 0; i < expandedHull.length; i++) {
                    const p1 = expandedHull[i];
                    const p2 = expandedHull[(i + 1) % expandedHull.length];
                    const p0 = expandedHull[(i - 1 + expandedHull.length) % expandedHull.length];

                    // 计算当前角和下一个角的圆角点
                    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
                    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
                    const len1 = Math.hypot(v1.x, v1.y);
                    const len2 = Math.hypot(v2.x, v2.y);
                    
                    // 归一化向量
                    const n1 = { x: v1.x / len1, y: v1.y / len1 };
                    const n2 = { x: v2.x / len2, y: v2.y / len2 };
                    
                    // 计算切点（限制圆角半径不超过线段长度的一半）
                    const actualR = Math.min(r, len1 / 2, len2 / 2);
                    const startPt = { x: p1.x - n1.x * actualR, y: p1.y - n1.y * actualR };
                    const endPt = { x: p1.x + n2.x * actualR, y: p1.y + n2.y * actualR };

                    if (i === 0) ctx.moveTo(startPt.x, startPt.y);
                    else ctx.lineTo(startPt.x, startPt.y);
                    
                    ctx.arcTo(p1.x, p1.y, endPt.x, endPt.y, actualR);
                }
                ctx.closePath();

                // 填充和描边
                ctx.fillStyle = factionColor + '15'; // 极淡的填充
                ctx.fill();
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 星区名称：放在质心正上方
                let minY = Infinity;
                expandedHull.forEach(p => minY = Math.min(minY, p.y));
                
                ctx.fillStyle = factionColor;
                ctx.font = '12px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(sector.name, centroid.x, minY - 10);
            }
        }
    });

    // 2. 画补给线（双色逻辑）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);

            // 前半段
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color;
            ctx.stroke();

            // 后半段
            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color;
            ctx.stroke();

            ctx.setLineDash([]); 
        }
    });

    // 3. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = fColor;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + '80';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#e0e4e8';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + 14, p.y - 2);
        ctx.fillStyle = '#8a94a0';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText(p.nameCn, p.x + 14, p.y + 10);
    });
}