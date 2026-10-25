// 计算凸包 (Andrew's monotone chain algorithm)
function getConvexHull(points) {
    if (points.length <= 2) return points;
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
    const mapRadius = 1600; // 星图最大边界

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（纯粹的领地几何切块，不连星球）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 计算该星区星球的外轮廓点（加一点留白）
            const hull = pts.length > 2 ? getConvexHull(pts) : pts;
            // 将点向外推移，让星区包围星球，但不直接穿过星球
            const paddedHull = hull.map(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const len = Math.hypot(dx, dy) || 1;
                const pad = 60; 
                return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
            });

            // 绘制星区多边形
            if (paddedHull.length > 2) {
                ctx.beginPath();
                ctx.moveTo(paddedHull[0].x, paddedHull[0].y);
                for (let i = 1; i < paddedHull.length; i++) {
                    ctx.lineTo(paddedHull[i].x, paddedHull[i].y);
                }
                ctx.closePath();
                
                // 星区底色（极淡）
                ctx.fillStyle = factionColor + '08';
                ctx.fill();
                
                // 星区边界线（实线，几何状）
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            } else if (paddedHull.length > 0) {
                // 单颗星球的星区画个圆
                ctx.beginPath();
                ctx.arc(paddedHull[0].x, paddedHull[0].y, 60, 0, Math.PI * 2);
                ctx.fillStyle = factionColor + '08';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 绘制星区名字
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, pts[0].x, minY - 40 * invScale);
        }
    });

    // 3. 画补给线（星球之间的连线，纯实线，双色）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.2 * invScale;
            // 不再使用虚线，像原图一样使用实线

            // 前半段颜色
            ctx.beginPath(); 
            ctx.moveTo(p1.x, p1.y); 
            ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color; 
            ctx.stroke();

            // 后半段颜色
            ctx.beginPath(); 
            ctx.moveTo(midX, midY); 
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color; 
            ctx.stroke();
        }
    });

    // 4. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        // 星球发光渐变
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 外圈轮廓
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + 'AA';
        ctx.lineWidth = 1.5 * invScale;
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#e0e4e8';
        ctx.font = `${10 * invScale}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + (12 * invScale), p.y - (2 * invScale));
        
        ctx.fillStyle = '#8a94a0';
        ctx.font = `${9 * invScale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(p.nameCn, p.x + (12 * invScale), p.y + (10 * invScale));
    });

    ctx.restore();
}