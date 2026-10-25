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

    // 2. 画星区（无重叠智能切割）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            let angles = [];
            let maxDist = 0;

            pts.forEach(p => {
                const dx = p.x - mapCenter.x;
                const dy = p.y - mapCenter.y;
                const dist = Math.hypot(dx, dy);
                if (dist > maxDist) maxDist = dist;

                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += Math.PI * 2;
                angles.push(angle);
            });

            angles.sort((a, b) => a - b);

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

            let minAngle = angles[splitIndex];
            let maxAngle = angles[(splitIndex - 1 + angles.length) % angles.length];
            let angleDiff = maxAngle - minAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            // 默认给一个宽度
            if (angleDiff < 0.15) {
                let mid = minAngle + angleDiff / 2;
                minAngle = mid - 0.075;
                maxAngle = mid + 0.075;
                angleDiff = 0.15;
            }

            const r_in = innerRadius;
            const r_out = mapRadius;

            // 绘制扇形色块
            ctx.beginPath();
            ctx.arc(mapCenter.x, mapCenter.y, r_in, minAngle, maxAngle);
            ctx.arc(mapCenter.x, mapCenter.y, r_out, maxAngle, minAngle, true);
            ctx.closePath();

            ctx.fillStyle = factionColor + '0A'; // 极淡底色
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1 * invScale;
            ctx.stroke();

            // 绘制星区名字
            const textAngle = minAngle + angleDiff / 2;
            const textR = maxDist + 50;
            const textX = mapCenter.x + Math.cos(textAngle) * textR;
            const textY = mapCenter.y + Math.sin(textAngle) * textR;
            
            ctx.fillStyle = factionColor;
            ctx.font = `bold ${12 * invScale}px "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, textX, textY);
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