// 生成随机种子数据
function generateTestData() {
    const factions = [
        { id: 'super_earth', nameEn: 'Super Earth', nameCn: '超级地球', color: '#87CEEB', fixed: true },
        { id: 'fact_auto', nameEn: 'Automaton', nameCn: '自动人', color: '#ff3333', fixed: false },
        { id: 'fact_bug', nameEn: 'Terminid', nameCn: '终结虫', color: '#ff9900', fixed: false }
    ];

    const planets = [];
    const sectors = [];
    const supplies = [];

    // 1. 生成太阳系（地球）
    const earthId = 'p_earth';
    planets.push({
        id: earthId,
        x: 0, y: 0,
        nameEn: 'Earth',
        nameCn: '地球',
        factionId: 'super_earth'
    });
    sectors.push({
        id: 's_solar',
        name: '太阳系',
        planetIds: [earthId]
    });

    // 2. 生成其余 99 颗星球
    const numPlanets = 99;
    const namesEn = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];
    const namesCn = ['阿尔法', '贝塔', '伽马', '德尔塔', '艾普西龙', '泽塔', '伊塔', '西塔', '约塔', '卡帕', '兰姆达', '缪', '纽', '克西', '奥密克戎', '派', '柔', '西格玛', '陶', '宇普西龙', '斐', '卡伊', '普西', '欧米伽'];
    const suffixesEn = ['I', 'II', 'III', 'IV', 'V', 'Prime', 'Major', 'Minor', 'Secundus'];
    const suffixesCn = ['一', '二', '三', '四', '五', '主星', '大星', '小星', '次星'];

    let currentFactionId = 'super_earth';

    for (let i = 0; i < numPlanets; i++) {
        // 随机坐标 (极坐标生成圆盘分布)
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 1500; // 避开中心的地球
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        // 随机名字
        const baseNameIdx = Math.floor(Math.random() * namesEn.length);
        const suffixIdx = Math.floor(Math.random() * suffixesEn.length);
        const pNameEn = namesEn[baseNameIdx] + ' ' + suffixesEn[suffixIdx] + ' ' + (i + 1);
        const pNameCn = namesCn[baseNameIdx] + suffixesCn[suffixIdx] + (i + 1);

        // 随机势力 (60% 超级地球，20% 自动人，20% 终结虫)
        const randFact = Math.random();
        if (randFact < 0.6) currentFactionId = 'super_earth';
        else if (randFact < 0.8) currentFactionId = 'fact_auto';
        else currentFactionId = 'fact_bug';

        planets.push({
            id: 'p_' + i,
            x: x, y: y,
            nameEn: pNameEn,
            nameCn: pNameCn,
            factionId: currentFactionId
        });
    }

    // 3. 划分星区（每个星区 3~7 颗星球）
    let currentSectorPlanets = [];
    let sectorCount = 1;

    for (let i = 0; i < numPlanets; i++) {
        currentSectorPlanets.push(planets[i + 1].id); // +1 跳过地球

        // 达到随机数量，或者到了最后一个星球，就结算星区
        if (currentSectorPlanets.length >= Math.floor(Math.random() * 5) + 3 || i === numPlanets - 1) {
            sectors.push({
                id: 'sector_' + sectorCount,
                name: '星区 ' + sectorCount,
                planetIds: [...currentSectorPlanets]
            });
            currentSectorPlanets = [];
            sectorCount++;
        }
    }

    // 4. 生成一些补给线 (随机连接30条线)
    for (let i = 0; i < 30; i++) {
        const p1 = planets[Math.floor(Math.random() * planets.length)];
        const p2 = planets[Math.floor(Math.random() * planets.length)];
        
        if (p1.id !== p2.id) {
            const exists = supplies.some(s => 
                (s.p1Id === p1.id && s.p2Id === p2.id) || 
                (s.p1Id === p2.id && s.p2Id === p1.id)
            );
            if (!exists) {
                supplies.push({
                    id: 'sup_' + i,
                    p1Id: p1.id,
                    p2Id: p2.id
                });
            }
        }
    }

    return { factions, planets, sectors, supplies };
}

// 检查本地是否有存档，如果没有则使用生成的测试数据
let savedData = localStorage.getItem('starMapData');
if (!savedData) {
    window.MAP_DATA = generateTestData();
} else {
    window.MAP_DATA = JSON.parse(savedData);
}