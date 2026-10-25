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

    // 1. 画最外层大圆
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（纯领地边界，绝对不连内部）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            if (pts.length === 1) {
                // 单颗星球画圆
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, 60, 0, Math.PI * 2);
                ctx.fillStyle = factionColor + '08';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            } else {
                // 多颗星球计算凸包，并向四周推离 60 像素作为安全区
                const hull = getConvexHull(pts);
                let padded = [];
                
                // 计算凸包的中心点
                let cx = 0, cy = 0;
                hull.forEach(p => { cx += p.x; cy += p.y; });
                cx /= hull.length;
                cy /= hull.length;

                // 将凸包的每个点向外推
                hull.forEach(p => {
                    const dx = p.x - cx;
                    const dy = p.y - cy;
                    const len = Math.hypot(dx, dy) || 1;
                    const pad = 60; // 安全内圈距离
                    padded.push({ x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad });
                });

                // 绘制多边形领地
                ctx.beginPath();
                ctx.moveTo(padded[0].x, padded[0].y);
                for (let i = 1; i < padded.length; i++) {
                    ctx.lineTo(padded[i].x, padded[i].y);
                }
                ctx.closePath();

                ctx.fillStyle = factionColor + '08'; // 极淡的填充底色
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 边界线
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();

                // 可选：如果你希望领地像原图一样向外延伸切割，可以取消下面这段注释
                // 这会在领地边缘画出放射线，像切披萨一样连到外围
                /*
                padded.forEach(p => {
                    const dx = p.x - mapCenter.x;
                    const dy = p.y - mapCenter.y;
                    const len = Math.hypot(dx, dy) || 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mapCenter.x + (dx / len) * mapRadius, mapCenter.y + (dy / len) * mapRadius);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; // 极淡的延伸线
                    ctx.lineWidth = 1 * invScale;
                    ctx.stroke();
                });
                */
            }

            // 绘制星区名字
            let minY = Infinity;
            let sumX = 0;
            pts.forEach(p => {
                if (p.y < minY) minY = p.y;
                sumX += p.x;
            });
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, sumX / pts.length, minY - 40 * invScale);
        }
    });

    // 3. 画补给线（星球之间唯一的实线）
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