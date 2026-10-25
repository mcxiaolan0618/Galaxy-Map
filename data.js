window.MAP_DATA = {
    factions: [
        { id: 'super_earth', nameEn: 'Super Earth', nameCn: '超级地球', color: '#87CEEB', fixed: true },
        { id: 'fact_demo1', nameEn: 'Automaton', nameCn: '自动人', color: '#ff3333', fixed: false },
        { id: 'fact_demo2', nameEn: 'Terminid', nameCn: '终结虫', color: '#ff9900', fixed: false }
    ],
    planets: [
        { id: '1', x: 400, y: 300, nameEn: 'Terra', nameCn: '泰拉', factionId: 'super_earth' },
        { id: '2', x: 600, y: 200, nameEn: 'Mars', nameCn: '玛尔斯', factionId: 'super_earth' },
        { id: '3', x: 700, y: 400, nameEn: 'Cyberstan', nameCn: '赛博斯坦', factionId: 'fact_demo1' }
    ],
    sectors: [
        { id: 's1', name: '太阳系', planetIds: ['1', '2'] }
    ],
    supplies: [
        { id: 'sup1', p1Id: '1', p2Id: '2' },
        { id: 'sup2', p1Id: '2', p2Id: '3' }
    ]
};