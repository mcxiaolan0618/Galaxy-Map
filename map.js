// 计算凸包 (用于生成边缘)
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2 * invScale;
    ctx.stroke();

    // 2. 画星区（超级多边形，彻底隔绝内部连线，绝不重叠）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 计算多边形的凸包
            const hull = pts.length > 2 ? getConvexHull(pts) : pts;

            // 核心算法：把多边形的每一个点，像吹气球一样向外推开（防止穿模，也防止相邻星区粘连）
            let paddedHull = [];
            if (hull.length === 1) {
                // 单颗星球，画个足够大的圆
                const p = hull[0];
                const r = 80;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fillStyle = factionColor + '0A';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            } else if (hull.length === 2) {
                // 两颗星球，画个胶囊形
                const p1 = hull[0], p2 = hull[1];
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const padding = 80;
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                ctx.beginPath();
                // 简化版：直接画个包络
                const cx = (p1.x + p2.x)/2, cy = (p1.y + p2.y)/2;
                ctx.arc(p1.x, p1.y, padding, angle + Math.PI/2, angle - Math.PI/2);
                ctx.arc(p2.x, p2.y, padding, angle - Math.PI/2, angle + Math.PI/2);
                ctx.closePath();
                
                ctx.fillStyle = factionColor + '0A';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            } else {
                // 多颗星球，利用法线扩张算法生成外围轮廓
                for (let i = 0; i < hull.length; i++) {
                    const p0 = hull[(i - 1 + hull.length) % hull.length];
                    const p1 = hull[i];
                    const p2 = hull[(i + 1) % hull.length];

                    // 计算边向量和法向量
                    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
                    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
                    const len1 = Math.hypot(v1.x, v1.y) || 1;
                    const len2 = Math.hypot(v2.x, v2.y) || 1;
                    
                    const n1 = { x: -v1.y / len1, y: v1.x / len1 };
                    const n2 = { x: -v2.y / len2, y: v2.x / len2 };
                    
                    // 角平分线方向
                    let bisect = { x: n1.x + n2.x, y: n1.y + n2.y };
                    const bl = Math.hypot(bisect.x, bisect.y) || 1;
                    bisect = { x: bisect.x / bl, y: bisect.y / bl };

                    const padding = 60; // 外扩距离
                    paddedHull.push({
                        x: p1.x + bisect.x * padding,
                        y: p1.y + bisect.y * padding
                    });
                }

                // 绘制平滑外框
                ctx.beginPath();
                // 画平滑曲线连接外扩点（让边缘圆滑像边界）
                for (let i = 0; i < paddedHull.length; i++) {
                    const p1 = paddedHull[i];
                    const p2 = paddedHull[(i + 1) % paddedHull.length];
                    if (i === 0) ctx.moveTo(p1.x, p1.y);
                    else ctx.lineTo(p1.x, p1.y);
                }
                ctx.closePath();

                ctx.fillStyle = factionColor + '08'; // 极淡底色
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1 * invScale;
                ctx.stroke();
            }

            // 星区名字显示在星区上方
            let minY = Infinity;
            let sumX = 0;
            pts.forEach(p => { 
                if (p.y < minY) minY = p.y; 
                sumX += p.x;
            });
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, sumX / pts.length, minY - 50 * invScale);
        }
    });

    // 3. 画补给线（星球之间唯一的连线）
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