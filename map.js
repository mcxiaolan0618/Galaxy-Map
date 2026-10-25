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

// 射线与圆的交点
function getRayCircleIntersect(start, dir, center, radius) {
    const dx = dir.x - start.x;
    const dy = dir.y - start.y;
    const fx = start.x - center.x;
    const fy = start.y - center.y;
    
    const a = dx*dx + dy*dy;
    const b = 2 * (fx*dx + fy*dy);
    const c = fx*fx + fy*fy - radius*radius;
    
    let discriminant = b*b - 4*a*c;
    if (discriminant >= 0) {
        discriminant = Math.sqrt(discriminant);
        let t1 = (-b - discriminant) / (2*a);
        let t2 = (-b + discriminant) / (2*a);
        let t = Math.max(t1, t2);
        if (t < 0) t = Math.min(t1, t2);
        if (t > 0) {
            return { x: start.x + t * dx, y: start.y + t * dy };
        }
    }
    return null;
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
    const mapRadius = 1600; // 外围大圆

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            const hull = pts.length > 2 ? getConvexHull(pts) : pts;
            
            // 核心算法：安全外扩多边形
            // 我们计算一个重心，然后把凸包上的点沿着重心的方向，向外推移 150 像素，保证一定包裹住所有星球
            let centroid = { x: 0, y: 0 };
            pts.forEach(p => { centroid.x += p.x; centroid.y += p.y; });
            centroid.x /= pts.length;
            centroid.y /= pts.length;

            const safeHull = hull.map(p => {
                const dx = p.x - centroid.x;
                const dy = p.y - centroid.y;
                const len = Math.hypot(dx, dy) || 1;
                const pad = 120; // 强制外扩距离，如果觉得星区不够大，可以改这个数字
                return {
                    x: p.x + (dx / len) * pad,
                    y: p.y + (dy / len) * pad
                };
            });

            if (safeHull.length > 1) {
                ctx.beginPath();
                ctx.moveTo(safeHull[0].x, safeHull[0].y);
                for (let i = 1; i < safeHull.length; i++) {
                    ctx.lineTo(safeHull[i].x, safeHull[i].y);
                }
                ctx.closePath();
                
                // 填充领地色
                ctx.fillStyle = factionColor + '08';
                ctx.fill();
                
                // 画边界实线 (纯白色，像原图一样)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();

                // 将星区线延伸到最外圈大圆
                if (safeHull.length >= 2) {
                    safeHull.forEach(p => {
                        const intersect = getRayCircleIntersect(p, { x: p.x - mapCenter.x, y: p.y - mapCenter.y }, mapCenter, mapRadius);
                        if (intersect) {
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(intersect.x, intersect.y);
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                            ctx.lineWidth = 1 * invScale;
                            ctx.stroke();
                        }
                    });
                }
            }

            // 画星区名字
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, centroid.x, minY - 40 * invScale);
        }
    });

    // 3. 画补给线（星球之间唯一的连线，纯实线）
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