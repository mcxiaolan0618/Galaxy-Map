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

// 计算重心
function getCentroid(points) {
    let x = 0, y = 0;
    points.forEach(p => { x += p.x; y += p.y; });
    return { x: x / points.length, y: y / points.length };
}

// 射线与外围大圆的交点
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
        if (t > 0) return { x: start.x + t * dx, y: start.y + t * dy };
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
    const mapRadius = 1600; // 大圆边界
    const innerRadius = 120; // 内圈空白

    // 1. 画外圈和内圈
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, innerRadius, 0, Math.PI * 2);
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

            // 计算凸包
            let hull = pts.length > 2 ? getConvexHull(pts) : pts;
            const centroid = getCentroid(pts);

            // 核心 1：强行向外扩张 100 像素，确保所有星球在框内
            const expandedHull = hull.map(p => {
                const dx = p.x - centroid.x;
                const dy = p.y - centroid.y;
                const len = Math.hypot(dx, dy) || 1;
                return { 
                    x: p.x + (dx / len) * 100, 
                    y: p.y + (dy / len) * 100 
                };
            });

            // 绘制星区内部色块
            if (expandedHull.length >= 3) {
                ctx.beginPath();
                ctx.moveTo(expandedHull[0].x, expandedHull[0].y);
                for (let i = 1; i < expandedHull.length; i++) {
                    ctx.lineTo(expandedHull[i].x, expandedHull[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = factionColor + '0A';
                ctx.fill();
            } else if (expandedHull.length === 2) {
                // 如果只有两颗星，画个圆角矩形
                const p1 = expandedHull[0], p2 = expandedHull[1];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                ctx.save();
                ctx.translate(p1.x, p1.y);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.arc(0, 0, 80, Math.PI/2, -Math.PI/2);
                ctx.lineTo(dist, -80);
                ctx.arc(dist, 0, 80, -Math.PI/2, Math.PI/2);
                ctx.closePath();
                ctx.fillStyle = factionColor + '0A';
                ctx.fill();
                ctx.restore();
            }

            // 核心 2：将星区顶点向外发射到无穷远（大圆边界），形成整齐切割
            expandedHull.forEach(p => {
                const intersect = getRayCircleIntersect(p, { x: p.x - centroid.x, y: p.y - centroid.y }, mapCenter, mapRadius);
                if (intersect) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(intersect.x, intersect.y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 1 * invScale;
                    ctx.stroke();
                }
            });

            // 画出星区本体的边线
            ctx.beginPath();
            if (expandedHull.length >= 3) {
                ctx.moveTo(expandedHull[0].x, expandedHull[0].y);
                for (let i = 1; i < expandedHull.length; i++) ctx.lineTo(expandedHull[i].x, expandedHull[i].y);
                ctx.closePath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 绘制星区名称
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillText(sector.name, centroid.x, minY - 30 * invScale);
        }
    });

    // 3. 画补给线（星球相连，双色实线）
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