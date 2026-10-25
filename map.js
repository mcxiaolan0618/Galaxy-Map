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

// 射线与圆的交点算法（用于把星区线延伸到圆形边界）
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
        // 取射线方向上的正数交点
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

    // 定义星图中心和最大半径（固定在 (0,0)，半径为 2000 的巨圆，包裹所有星球）
    const mapCenter = { x: 0, y: 0 }; 
    const mapRadius = 2000;

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（线段发散切割圆）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 1. 计算凸包，获取外围顶点
            const hull = pts.length > 2 ? getConvexHull(pts) : pts;
            const centroid = getCentroid(hull);

            // 2. 将这些顶点向远离中心的方向延伸，与圆形边界相交
            const extendedPts = hull.map(p => {
                const intersect = getRayCircleIntersect(p, { x: p.x - centroid.x, y: p.y - centroid.y }, mapCenter, mapRadius);
                return intersect || p;
            });

            // 3. 绘制多边形色块
            if (extendedPts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(extendedPts[0].x, extendedPts[0].y);
                for (let i = 1; i < extendedPts.length; i++) {
                    ctx.lineTo(extendedPts[i].x, extendedPts[i].y);
                }
                // 如果星球较少，用圆弧连接返回的边界，这里简单用直线闭合
                ctx.closePath();
                
                // 填充颜色
                ctx.fillStyle = factionColor + '08'; // 非常淡的背景色
                ctx.fill();
            }

            // 4. 绘制内部星球之间的细线（像星座一样连接）
            if (pts.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                if (pts.length > 2) ctx.closePath();
                ctx.strokeStyle = factionColor + '80'; // 半透明连线
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 5. 绘制延伸出去的边界射线
            ctx.strokeStyle = factionColor + '60';
            ctx.setLineDash([4 * invScale, 4 * invScale]);
            extendedPts.forEach(p => {
                // 找出对应凸包上的原点，画一条虚线出去
                const originPt = hull.find(h => getRayCircleIntersect(h, { x: h.x - centroid.x, y: h.y - centroid.y }, mapCenter, mapRadius) === p);
                if (originPt) {
                    ctx.beginPath();
                    ctx.moveTo(originPt.x, originPt.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                }
            });
            ctx.setLineDash([]);

            // 6. 星区名字
            let minY = Infinity;
            hull.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, centroid.x, minY - 30 * invScale);
        }
    });

    // 3. 画补给线
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.5 * invScale;
            ctx.setLineDash([5 * invScale, 5 * invScale]);

            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color; ctx.stroke();

            ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color; ctx.stroke();
            ctx.setLineDash([]); 
        }
    });

    // 4. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        // 发光球体渐变
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 星球外圈
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor;
        ctx.lineWidth = 1.5 * invScale;
        ctx.stroke();

        // 文本
        ctx.fillStyle = '#e0e4e8';
        ctx.font = `${11 * invScale}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + (14 * invScale), p.y - (2 * invScale));
        
        ctx.fillStyle = '#8a94a0';
        ctx.font = `${10 * invScale}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(p.nameCn, p.x + (14 * invScale), p.y + (10 * invScale));
    });

    ctx.restore();
}