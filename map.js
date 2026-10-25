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

    // 1. 画星区（直接连接内部星球形成的线）
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') { sectorFactionId = pts[i].factionId; break; }
            }
            const factionColor = getFaction(sectorFactionId).color;

            // 如果星区里只有1颗星球，画个虚线圈
            if (pts.length === 1) {
                ctx.beginPath();
                ctx.arc(pts[0].x, pts[0].y, 20, 0, Math.PI * 2);
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5 * invScale;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // 如果有多颗星球，直接按顺序连线
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                // 闭合星区线
                ctx.lineTo(pts[0].x, pts[0].y);
                
                ctx.strokeStyle = factionColor;
                ctx.lineWidth = 1.5 * invScale;
                ctx.stroke();
            }

            // 星区名字显示在第一颗星球上方
            ctx.fillStyle = factionColor;
            ctx.font = `${12 * invScale}px "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, pts[0].x, pts[0].y - (25 * invScale));
        }
    });

    // 2. 画补给线（一半A色，一半B色）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.5 * invScale;
            ctx.setLineDash([6 * invScale, 4 * invScale]);

            // 前半段
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(midX, midY);
            ctx.strokeStyle = f1Color;
            ctx.stroke();

            // 后半段
            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = f2Color;
            ctx.stroke();
            ctx.setLineDash([]); 
        }
    });

    // 3. 画星球
    planets.forEach(p => {
        const fColor = getFaction(p.factionId).color;
        
        // 星球本体
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = fColor;
        ctx.fill();
        
        // 发光
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + '80';
        ctx.lineWidth = 2 * invScale;
        ctx.stroke();

        // 文字
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