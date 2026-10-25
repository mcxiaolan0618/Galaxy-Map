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
    const innerRadius = 150; // 中心地球圈

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

    // 2. 计算每个星区的归属范围（极坐标转化为网格划分）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 提取所有星球的极角和极径
            let angles = [];
            let maxDist = 0;

            pts.forEach(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                maxDist = Math.max(maxDist, Math.hypot(dx, dy));
                let a = Math.atan2(dy, dx);
                if (a < 0) a += Math.PI * 2;
                angles.push(a);
            });

            angles.sort((a, b) => a - b);

            // 寻找最小包围角度区间
            let maxGap = -1;
            let splitIndex = 0;
            for (let i = 0; i < angles.length; i++) {
                const next = (i + 1) % angles.length;
                let gap = angles[next] - angles[i];
                if (gap <= 0) gap += Math.PI * 2;
                if (gap > maxGap) {
                    maxGap = gap;
                    splitIndex = next;
                }
            }

            let startAngle = angles[splitIndex];
            let endAngle = angles[(splitIndex - 1 + angles.length) % angles.length];
            let angleDiff = endAngle - startAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            // 强制最小宽度，避免变成细线
            if (angleDiff < 0.25) {
                let mid = startAngle + angleDiff / 2;
                startAngle = mid - 0.125;
                endAngle = mid + 0.125;
                angleDiff = 0.25;
            }

            // 两侧增加一点间隙，形成折线切分效果
            startAngle -= 0.04;
            endAngle += 0.04;

            // 计算内外圈半径
            // 内圈：在最大星球半径外扩 30 像素，防止线切到星球
            const r_in = Math.max(innerRadius, maxDist + 30);
            const r_out = mapRadius;

            // 绘制星区领地（多边形折线切分，绝不重叠）
            // 这是因为相邻星区的角度区间是由分割间隙决定的
            ctx.beginPath();
            // 内圈
            ctx.arc(mapCenter.x, mapCenter.y, r_in, startAngle, endAngle);
            // 右侧切线
            ctx.lineTo(Math.cos(endAngle) * r_out, Math.sin(endAngle) * r_out);
            // 外圈
            ctx.arc(mapCenter.x, mapCenter.y, r_out, endAngle, startAngle, true);
            // 左侧切线
            ctx.closePath();

            ctx.fillStyle = factionColor + '0B'; // 极淡底色
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 白色实线
            ctx.lineWidth = 1.2 * invScale;
            ctx.stroke();

            // 绘制星区名称
            const textAngle = startAngle + (endAngle - startAngle) / 2;
            const textR = maxDist + 40;
            const textX = mapCenter.x + Math.cos(textAngle) * textR;
            const textY = mapCenter.y + Math.sin(textAngle) * textR;
            
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, textX, textY);
        }
    });

    // 3. 画补给线（星球与星球之间的连线，原图效果）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // 细实线
            ctx.lineWidth = 1.2 * invScale;
            ctx.beginPath(); 
            ctx.moveTo(p1.x, p1.y); 
            ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color; 
            ctx.stroke();

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
        
        // 星球质感高光
        const gradient = ctx.createRadialGradient(p.x - 2*invScale, p.y - 2*invScale, 1, p.x, p.y, 6*invScale);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, fColor);
        gradient.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 外发光边
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7 * invScale, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + 'AA';
        ctx.lineWidth = 1.5 * invScale;
        ctx.stroke();

        // 星球文本（紧贴星球右侧，与原图一致）
        ctx.fillStyle = '#e0e4e8';
        ctx.font = `${9 * invScale}px "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + (12 * invScale), p.y - (2 * invScale));
    });

    ctx.restore();
}