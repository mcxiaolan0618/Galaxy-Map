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

// 射线与圆的交点算法
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

    // 星图中心和最大半径
    const mapCenter = { x: 0, y: 0 }; 
    const mapRadius = 1600;

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（只画边界多边形，不包含星球之间的连线）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 计算凸包并向外扩散，形成领地边界
            const hull = pts.length > 2 ? getConvexHull(pts) : pts;
            const centroid = { x: 0, y: 0 }; // 以宇宙中心作为发散点，方便切割圆圈
            // 或者以星区自身重心：这里采用宇宙中心，线才会像披萨一样切分出去
            
            const extendedPts = hull.map(p => {
                const intersect = getRayCircleIntersect(p, { x: p.x - centroid.x, y: p.y - centroid.y }, mapCenter, mapRadius);
                return intersect || p;
            });

            if (extendedPts.length > 1) {
                ctx.beginPath();
                ctx.moveTo(extendedPts[0].x, extendedPts[0].y);
                for (let i = 1; i < extendedPts.length; i++) {
                    ctx.lineTo(extendedPts[i].x, extendedPts[i].y);
                }
                ctx.closePath();
                
                // 填充底色
                ctx.fillStyle = factionColor + '0A'; 
                ctx.fill();
                
                // 星区边界线（实线）
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 星区名字放在该星区星球的最上方
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, pts[0].x, minY - 30 * invScale);
        }
    });

    // 3. 画补给线（唯一的星球连线，双色虚线）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.2 * invScale;
            ctx.setLineDash([4 * invScale, 4 * invScale]);

            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color; ctx.stroke();

            ctx.beginPath(); ctx.moveTo(midX, midY); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color; ctx.stroke();
            ctx.setLineDash([]); 
        }
    });

    // 4. 画星球（干净、发光）
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 7 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + 'AA';
        ctx.lineWidth = 1 * invScale;
        ctx.stroke();

        // 文本（可选，如果星球太多可以注释掉）
        ctx.fillStyle = '#e0e4e8';
        ctx.font = `${10 * invScale}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + (12 * invScale), p.y - (2 * invScale));
    });

    ctx.restore();
}