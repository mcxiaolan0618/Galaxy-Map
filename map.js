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

    // 1. 画星区（多边形领地）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') {
                    sectorFactionId = pts[i].factionId;
                    break;
                }
            }
            const factionColor = getFaction(sectorFactionId).color;

            if (pts.length === 1) {
                // 单颗星球星区
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, 40, 0, Math.PI * 2);
                ctx.fillStyle = factionColor + '15'; // 填充
                ctx.fill();
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5 * invScale;
                ctx.setLineDash([5 * invScale, 5 * invScale]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.fillStyle = factionColor;
                ctx.font = `bold ${12 * invScale}px "Courier New", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(sector.name, pts[0].x, pts[0].y - 50 * invScale);
            } else if (pts.length === 2) {
                // 两颗星球星区（画胶囊形状）
                const p1 = pts[0], p2 = pts[1];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const padding = 35;
                
                ctx.save();
                ctx.translate(p1.x, p1.y);
                ctx.rotate(angle);
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                
                ctx.beginPath();
                ctx.arc(0, 0, padding, Math.PI / 2, -Math.PI / 2);
                ctx.lineTo(dist, -padding);
                ctx.arc(dist, 0, padding, -Math.PI / 2, Math.PI / 2);
                ctx.closePath();
                
                ctx.fillStyle = factionColor + '15';
                ctx.fill();
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5 * invScale;
                ctx.stroke();
                ctx.restore();

                // 名字放在两颗星球中间上方
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx.fillStyle = factionColor;
                ctx.font = `bold ${12 * invScale}px "Courier New", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(sector.name, midX, midY - 50 * invScale);

            } else {
                // 多颗星球（凸包多边形）
                const hull = getConvexHull(pts);
                const centroid = getCentroid(hull);
                const padding = 35;

                // 将点向外推，形成领地边界
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

                ctx.beginPath();
                for (let i = 0; i < expandedHull.length; i++) {
                    if (i === 0) ctx.moveTo(expandedHull[i].x, expandedHull[i].y);
                    else ctx.lineTo(expandedHull[i].x, expandedHull[i].y);
                }
                ctx.closePath();

                ctx.fillStyle = factionColor + '12';
                ctx.fill();
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5 * invScale;
                ctx.stroke();

                // 名字放在质心上方
                let minY = Infinity;
                expandedHull.forEach(p => minY = Math.min(minY, p.y));
                ctx.fillStyle = factionColor;
                ctx.font = `bold ${12 * invScale}px "Courier New", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(sector.name, centroid.x, minY - 15 * invScale);
            }
        }
    });

    // 2. 画补给线
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

    // 3. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor;
        ctx.lineWidth = 1.5 * invScale;
        ctx.stroke();

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