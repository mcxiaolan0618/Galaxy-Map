// 计算角度并规范化到 0 ~ 2PI
function normalizeAngle(a) {
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    return a;
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
    const mapRadius = 1600; // 最外圈大圆
    const innerRadius = 200; // 中间内圈（地球所在地）

    // 1. 画边界圆
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

    // 2. 画星区（无缝扇形切分）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 计算所有星球的角度和最大半径
            let angles = [];
            let maxRadius = innerRadius;

            pts.forEach(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const dist = Math.hypot(dx, dy);
                if (dist > maxRadius) maxRadius = dist;
                angles.push(normalizeAngle(Math.atan2(dy, dx)));
            });

            angles.sort((a, b) => a - b);

            // 寻找跨越 0 度边界的最小扇形包含区
            let minAngle = angles[0];
            let maxAngle = angles[angles.length - 1];
            let maxGap = -1;
            let splitIndex = 0;

            // 找最大的空隙（这个空隙就是星区不包含的部分）
            for (let i = 0; i < angles.length; i++) {
                const next = (i + 1) % angles.length;
                let gap = angles[next] - angles[i];
                if (gap <= 0) gap += Math.PI * 2;
                if (gap > maxGap) {
                    maxGap = gap;
                    splitIndex = next;
                }
            }

            // 确定扇形的起始角和结束角
            minAngle = angles[splitIndex];
            maxAngle = angles[(splitIndex - 1 + angles.length) % angles.length];

            let angleDiff = maxAngle - minAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            // 强制给一个最小宽度，防止单颗星球变成一条细线
            if (angleDiff < 0.2) {
                const mid = minAngle + angleDiff / 2;
                minAngle = mid - 0.1;
                maxAngle = mid + 0.1;
                angleDiff = 0.2;
            }

            // 边缘留白（防止贴边）
            const anglePadding = 0.06;
            minAngle -= anglePadding;
            maxAngle += anglePadding;

            // 核心视觉：内圈半径（设置一段强制安全距离，但保留切分感）
            const r_in = innerRadius; 
            const r_out = mapRadius; 

            // 画星区区块
            ctx.beginPath();
            // 1. 内圈弧线
            ctx.arc(mapCenter.x, mapCenter.y, r_in, minAngle, maxAngle);
            // 2. 右侧切割线
            ctx.lineTo(Math.cos(maxAngle) * r_out, Math.sin(maxAngle) * r_out);
            // 3. 外圈大弧线（反向）
            ctx.arc(mapCenter.x, mapCenter.y, r_out, maxAngle, minAngle, true);
            // 4. 闭合多边形
            ctx.closePath();

            ctx.fillStyle = factionColor + '0A'; // 极淡的底色
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // 整齐的白色边界线
            ctx.lineWidth = 1 * invScale;
            ctx.stroke();

            // 绘制星区名字（放在中间角度，靠近最远的星球）
            const midAngle = minAngle + angleDiff / 2;
            const textR = maxRadius + 50;
            const textX = mapCenter.x + Math.cos(midAngle) * textR;
            const textY = mapCenter.y + Math.sin(midAngle) * textR;

            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, textX, textY);
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