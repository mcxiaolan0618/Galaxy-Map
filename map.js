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

// 将多边形向外扩的算法（保证形状贴合且不出圈）
function expandPolygon(points, padding, center, maxRadius) {
    if (points.length < 3) return points;
    const expanded = [];
    const len = points.length;
    
    for (let i = 0; i < len; i++) {
        const p0 = points[(i - 1 + len) % len];
        const p1 = points[i];
        const p2 = points[(i + 1) % len];
        
        // 计算两条边的法线（朝外）
        let n1 = { x: -(p1.y - p0.y), y: p1.x - p0.x };
        let n2 = { x: -(p2.y - p1.y), y: p2.x - p1.x };
        let l1 = Math.hypot(n1.x, n1.y) || 1;
        let l2 = Math.hypot(n2.x, n2.y) || 1;
        
        // 归一化法线
        n1 = { x: n1.x / l1, y: n1.y / l1 };
        n2 = { x: n2.x / l2, y: n2.y / l2 };
        
        // 计算角平分线法线
        let bisect = { x: n1.x + n2.x, y: n1.y + n2.y };
        let bl = Math.hypot(bisect.x, bisect.y) || 1;
        bisect = { x: bisect.x / bl, y: bisect.y / bl };
        
        // 计算向外扩张后的点
        let newP = {
            x: p1.x + bisect.x * padding,
            y: p1.y + bisect.y * padding
        };
        
        // 保证不出外圈
        const distToCenter = Math.hypot(newP.x - center.x, newP.y - center.y);
        if (distToCenter > maxRadius) {
            newP.x = center.x + (newP.x - center.x) / distToCenter * maxRadius;
            newP.y = center.y + (newP.y - center.y) / distToCenter * maxRadius;
        }
        
        expanded.push(newP);
    }
    return expanded;
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
    const innerRadius = 150; // 中心地球区域的半径

    // 1. 画最外层的圆形边界
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（整齐的领地边界，绝不和星球相连）
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
            
            if (hull.length >= 2) {
                // 核心：向外扩张 50 像素，完美包裹星球且不粘连
                hull = expandPolygon(hull, 50, mapCenter, mapRadius);

                ctx.beginPath();
                ctx.moveTo(hull[0].x, hull[0].y);
                for (let i = 1; i < hull.length; i++) {
                    ctx.lineTo(hull[i].x, hull[i].y);
                }
                ctx.closePath();
                
                // 填充极淡的底色
                ctx.fillStyle = factionColor + '06'; 
                ctx.fill();
                
                // 画出星区的边界线（白色实线，就像原图一样）
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 画星区名字
            let minY = Infinity;
            pts.forEach(p => minY = Math.min(minY, p.y));
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, pts[0].x, minY - 30 * invScale);
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
        
        // 发光渐变
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 外圈
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
    });

    ctx.restore();
}