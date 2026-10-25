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
    const mapRadius = 1600; 
    const innerRadius = 200; 

    // 1. 画最外层和中心圆圈
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

            // 1. 计算凸包
            let hull = pts.length > 2 ? getConvexHull(pts) : pts;
            
            // 2. 以中心点将边界向外推移，形成安全内圈（包裹星球）
            const expandedHull = hull.map(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const len = Math.hypot(dx, dy) || 1;
                const padding = 120; // 领地内圈的留白
                return { x: p.x + (dx / len) * padding, y: p.y + (dy / len) * padding };
            });

            // 3. 将内部边界点向外延伸，直到与大圆相交，形成切割射线
            const outHull = expandedHull.map(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const len = Math.hypot(dx, dy) || 1;
                return { 
                    x: mapCenter.x + (dx / len) * mapRadius, 
                    y: mapCenter.y + (dy / len) * mapRadius 
                };
            });

            // 4. 绘制多边形领地
            ctx.beginPath();
            // 从内圈起始
            ctx.moveTo(expandedHull[0].x, expandedHull[0].y);
            
            // 画内圈包边（依次连接内部边界点）
            for (let i = 1; i < expandedHull.length; i++) {
                ctx.lineTo(expandedHull[i].x, expandedHull[i].y);
            }
            
            // 画外圈切分线（从最后一个内部点连到外部大圆，再沿着大圆边缘连到第一个点对应的外部大圆）
            ctx.lineTo(outHull[outHull.length - 1].x, outHull[outHull.length - 1].y);
            
            // 沿着外圆画一段弧线闭合（为了美观，用直线连接内外点也可以）
            ctx.lineTo(outHull[0].x, outHull[0].y);
            
            ctx.closePath();

            ctx.fillStyle = factionColor + '0A'; // 极淡底色
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 白色边界
            ctx.lineWidth = 1 * invScale;
            ctx.stroke();

            // 5. 额外绘制那些向外延伸的边界切割线
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // 更淡的延伸线
            ctx.beginPath();
            for (let i = 0; i < expandedHull.length; i++) {
                ctx.moveTo(expandedHull[i].x, expandedHull[i].y);
                ctx.lineTo(outHull[i].x, outHull[i].y);
            }
            ctx.stroke();

            // 绘制星区名字
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, pts[0].x, minY - 40 * invScale);
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