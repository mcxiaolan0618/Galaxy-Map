// 通用绘制逻辑
function drawMap(ctx, width, height, data) {
    ctx.clearRect(0, 0, width, height);
    const { planets, sectors, supplies, factions } = data;

    const getFaction = (id) => factions.find(f => f.id === id) || factions[0];

    // 1. 画星区
    sectors.forEach(sector => {
        const pts = sector.planetIds.map(id => planets.find(p => p.id === id)).filter(p => p);
        if (pts.length > 0) {
            // 颜色逻辑
            let sectorFactionId = 'super_earth';
            for (let i = 0; i < pts.length; i++) {
                if (pts[i].factionId !== 'super_earth') {
                    sectorFactionId = pts[i].factionId;
                    break;
                }
            }
            const factionColor = getFaction(sectorFactionId).color;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            
            const pad = 35; 
            const r = 20;
            const x = minX - pad;
            const y = minY - pad;
            const w = (maxX - minX) + pad * 2;
            const h = (maxY - minY) + pad * 2;
            
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();

            ctx.fillStyle = factionColor + '15'; 
            ctx.fill();
            ctx.strokeStyle = factionColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = factionColor;
            ctx.font = '12px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sector.name, x + w / 2, y - 8);
        }
    });

    // 2. 画补给线（双色）
    supplies.forEach(supply => {
        const p1 = planets.find(p => p.id === supply.p1Id);
        const p2 = planets.find(p => p.id === supply.p2Id);
        if (p1 && p2) {
            const f1Color = getFaction(p1.factionId).color;
            const f2Color = getFaction(p2.factionId).color;
            
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);

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

        // 核心
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = fColor;
        ctx.fill();
        
        // 发光
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = fColor + '80';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 文本
        ctx.fillStyle = '#e0e4e8';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.nameEn, p.x + 14, p.y - 2);
        ctx.fillStyle = '#8a94a0';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText(p.nameCn, p.x + 14, p.y + 10);
    });
}