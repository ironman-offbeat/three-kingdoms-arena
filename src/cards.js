export const FACTIONS = {
  wei: { name: '위', identity: '속공·직접 피해·무기', color: '#315d92', power: '급습 명령' },
  shu: { name: '촉', identity: '도발·회복·반격', color: '#2e7d4f', power: '인덕의 수호' },
  wu: { name: '오', identity: '계략·화공·드로우', color: '#9b3030', power: '강동의 지략' },
  neutral: { name: '중립', identity: '범용 병력과 장비', color: '#6c6253' },
};

export const RARITY = {
  common: '보통',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
};

const troops = {
  wei: ['허창 창병', '관도 궁기병', '업성 철기병', '합비 선봉대', '하후가 친위대', '오환 기병', '청주병', '호표기'],
  shu: ['백이 의병', '서촉 방패병', '한중 산악병', '형주 수비대', '파서 창병', '익주 철벽대', '무당비군', '백제성 수비병'],
  wu: ['강동 수군', '단양 정병', '건업 화궁병', '수춘 수병', '여강 정찰대', '장강 노병', '파구 수채병', '무창 강노병'],
  neutral: ['황건 잔병', '서량 기병', '유주 궁수', '형주 민병', '하북 창병', '산월 전사', '남만 전사', '교주 투창병'],
};

const names = {
  wei: ['조조', '사마의', '전위', '하후돈', '가후', '장료', '조인', '허저', '곽가', '하후연'],
  shu: ['유비', '관우', '장비', '제갈량', '조운', '마초', '황충', '방통', '위연', '강유'],
  wu: ['손권', '주유', '육손', '손책', '감녕', '태사자', '여몽', '황개', '노숙', '대교'],
  neutral: ['여포', '동탁', '초선', '원소', '공손찬', '맹획', '축융', '화타', '진궁', '장각'],
};

const weapons = [
  ['청룡언월도', 5, 4, 2, 'epic', '적을 처치하면 다시 공격할 수 있습니다.', 'refreshOnKill'],
  ['장팔사모', 4, 3, 3, 'epic', '첫 공격 때 대상 양옆의 적에게도 피해를 1 줍니다.', 'adjacentOnFirstAttack'],
  ['의천검', 4, 3, 2, 'epic', '장착 시 카드를 1장 뽑습니다.', 'drawOnEquip'],
  ['청강검', 3, 2, 3, 'epic', '철갑을 무시합니다.', 'ignoreShield'],
  ['방천화극', 7, 6, 2, 'legendary', '공격 후 다른 적 부대 하나에게 피해를 3 줍니다.', 'damageOtherAfterAttack'],
  ['고정도', 3, 2, 2, 'epic', '은신한 적도 공격할 수 있습니다.', 'attackStealth'],
];

const mounts = [
  ['적토마', 4, 4, '돌진'],
  ['적로', 3, 3, '철갑'],
  ['절영', 3, 3, '은신'],
  ['조황비전', 2, 2, '속공'],
];

const id = (faction, name, suffix) => `${faction}-${suffix}-${name}`;

const unit = (faction, name, cost, attack, health, rarity = 'common', keywords = [], text = '') => ({
  id: id(faction, name, `${cost}-${attack}-${health}`),
  faction,
  name,
  type: 'unit',
  cost,
  attack,
  health,
  rarity,
  keywords,
  text,
});

const spell = (faction, name, cost, rarity, text, effect, target = 'none') => ({
  id: id(faction, name, cost),
  faction,
  name,
  type: 'spell',
  cost,
  rarity,
  text,
  effect,
  target,
});

const equipment = (name, cost, attack, durability, rarity, text, effect) => ({
  id: id('neutral', name, cost),
  faction: 'neutral',
  name,
  type: 'equipment',
  cost,
  attack,
  durability,
  rarity,
  text,
  effect,
  target: 'friendlyUnit',
});

const mount = (name, cost, heal, keyword) => ({
  id: id('neutral', name, cost),
  faction: 'neutral',
  name,
  type: 'mount',
  cost,
  rarity: 'rare',
  text: `아군 부대 하나를 ${heal} 회복하고 ${keyword}을 부여합니다.`,
  heal,
  keyword,
  target: 'friendlyUnit',
});

function generatedTroops(faction) {
  const count = faction === 'neutral' ? 24 : 34;
  const output = [];

  for (let index = 0; index < count; index += 1) {
    const base = troops[faction][index % troops[faction].length];
    const cost = 1 + (index % 7);
    const attack = Math.max(1, Math.ceil(cost * 0.72) + (faction === 'wei' ? 1 : 0));
    const health = Math.max(1, cost + 1 + (faction === 'shu' ? 1 : 0) - (faction === 'wei' ? 1 : 0));
    const keywords = [];

    if (faction === 'wei' && index % 4 === 0) keywords.push(index % 8 === 0 ? '돌진' : '속공');
    if (faction === 'shu' && index % 3 === 0) keywords.push(index % 6 === 0 ? '철갑' : '도발');
    if (faction === 'wu' && index % 5 === 0) keywords.push('은신');
    if (faction === 'neutral' && index % 6 === 0) keywords.push('도발');

    output.push(unit(
      faction,
      `${base} ${Math.floor(index / troops[faction].length) + 1}`,
      cost,
      attack,
      health,
      index > 23 ? 'rare' : 'common',
      keywords,
    ));
  }

  return output;
}

function factionSpells(faction) {
  const definitions = {
    wei: [
      ['선봉 돌격', 1, '적 성에 피해를 2 줍니다.', 'damageFortress', 'none'],
      ['기습 명령', 2, '아군 하나에게 공격력 +2와 속공을 부여합니다.', 'weiBuff', 'friendlyUnit'],
      ['군량 약탈', 2, '카드를 2장 뽑고 내 성에 피해를 1 줍니다.', 'draw2SelfDamage1', 'none'],
      ['전군 돌격', 5, '모든 아군에게 공격력 +2를 부여합니다.', 'allAttack', 'none'],
      ['낙석', 3, '적 하나에게 피해를 4 줍니다.', 'damage4', 'enemyUnitOrFortress'],
      ['추격전', 4, '이번 턴 아군 하나가 두 번 공격할 수 있습니다.', 'windfury', 'friendlyUnit'],
    ],
    shu: [
      ['의병 소집', 1, '1/2 도발 의병을 둘 소환합니다.', 'summonGuards', 'none'],
      ['인덕의 수호', 2, '아군 하나의 생명력을 +2 합니다. 대상이 없으면 성을 2 회복합니다.', 'shuPower', 'friendlyUnitOrOwnFortress'],
      ['백성 구휼', 2, '내 성을 5 회복합니다.', 'heal5', 'none'],
      ['철벽 진형', 4, '모든 아군에게 철갑을 부여합니다.', 'allShield', 'none'],
      ['도원결의', 5, '아군 셋에게 +2/+2를 부여합니다.', 'tripleBuff', 'none'],
      ['재정비', 3, '가장 최근에 죽은 아군 하나를 손으로 되돌립니다.', 'returnDead', 'none'],
    ],
    wu: [
      ['화계', 1, '적 하나에게 피해를 2 줍니다.', 'damage2', 'enemyUnitOrFortress'],
      ['연환계', 2, '선택한 적과 다른 적 하나에게 피해를 2 줍니다.', 'split2', 'enemyUnit'],
      ['강동의 지략', 2, '계략 카드 하나를 발견합니다.', 'discoverSpell', 'none'],
      ['적벽 화공', 5, '모든 적에게 피해를 3 줍니다.', 'aoe3', 'none'],
      ['수군 보급', 3, '카드를 2장 뽑습니다.', 'draw2', 'none'],
      ['동남풍', 4, '이번 턴 계략 피해가 +2 증가합니다.', 'spellPower', 'none'],
    ],
    neutral: [
      ['응급 치료', 2, '아군 하나를 4 회복합니다.', 'heal4', 'friendlyUnit'],
      ['징병', 2, '2/2 병사를 둘 소환합니다.', 'summon2', 'none'],
      ['매복', 2, '비밀: 적이 성을 공격하면 공격자에게 피해를 3 줍니다.', 'secretAmbush', 'none'],
      ['군량 확보', 1, '카드를 1장 뽑습니다.', 'draw1', 'none'],
      ['화살 세례', 4, '모든 적에게 피해를 2 줍니다.', 'aoe2', 'none'],
      ['퇴각 명령', 2, '아군 하나를 손으로 되돌립니다.', 'bounceFriendly', 'friendlyUnit'],
    ],
  };

  return definitions[faction].map((definition, index) => spell(
    faction,
    definition[0],
    definition[1],
    index > 3 ? 'epic' : 'rare',
    definition[2],
    definition[3],
    definition[4],
  ));
}

function heroes(faction) {
  return names[faction].map((name, index) => {
    const legendary = index < 6;
    const cost = 5 + (index % 4);
    const keywords = [];

    if (faction === 'wei' && index % 2 === 0) keywords.push('속공');
    if (faction === 'shu' && index % 2 === 0) keywords.push('도발');
    if (faction === 'wu' && index % 3 === 0) keywords.push('은신');
    if (name === '여포') keywords.push('돌진', '질풍');
    if (name === '화타') keywords.push('생명력 흡수');

    return unit(
      faction,
      name,
      cost,
      3 + (index % 6),
      5 + (index % 5),
      legendary ? 'legendary' : 'epic',
      keywords,
      `${name}의 성향을 반영한 장수입니다.`,
    );
  });
}

export const CARD_POOL = [
  ...['wei', 'shu', 'wu', 'neutral'].flatMap((faction) => [
    ...generatedTroops(faction),
    ...factionSpells(faction),
    ...heroes(faction),
  ]),
  ...weapons.map((weapon) => equipment(...weapon)),
  ...mounts.map((entry) => mount(...entry)),
];

export function legalCards(faction) {
  return CARD_POOL.filter((card) => card.faction === 'neutral' || card.faction === faction);
}

export function draftOptions(faction, rng = Math.random) {
  const pool = legalCards(faction);
  const used = new Set();
  const output = [];

  while (output.length < 3) {
    const roll = rng() * 100;
    const rarity = roll < 68 ? 'common' : roll < 91 ? 'rare' : roll < 98 ? 'epic' : 'legendary';
    let candidates = pool.filter((card) => card.rarity === rarity && !used.has(card.id));
    if (!candidates.length) candidates = pool.filter((card) => !used.has(card.id));
    const card = candidates[Math.floor(rng() * candidates.length)];
    used.add(card.id);
    output.push(structuredClone(card));
  }

  return output;
}

export function aiDeck(faction, rng = Math.random) {
  const pool = legalCards(faction);
  const deck = [];
  const curve = [1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10];

  while (deck.length < 30) {
    const desired = curve[deck.length % curve.length];
    const candidates = pool.filter((card) => Math.abs(card.cost - desired) <= 1);
    const card = candidates[Math.floor(rng() * candidates.length)] || pool[Math.floor(rng() * pool.length)];
    deck.push(structuredClone(card));
  }

  return deck;
}

const validEffects = new Set([
  'damageFortress', 'weiBuff', 'draw2SelfDamage1', 'allAttack', 'damage4', 'windfury',
  'summonGuards', 'shuPower', 'heal5', 'allShield', 'tripleBuff', 'returnDead',
  'damage2', 'split2', 'discoverSpell', 'aoe3', 'draw2', 'spellPower',
  'heal4', 'summon2', 'secretAmbush', 'draw1', 'aoe2', 'bounceFriendly',
]);

export function validateCardPool() {
  if (CARD_POOL.length !== 200) throw new Error(`카드 수 오류: ${CARD_POOL.length}`);

  const counts = Object.fromEntries(['wei', 'shu', 'wu', 'neutral'].map((faction) => [
    faction,
    CARD_POOL.filter((card) => card.faction === faction).length,
  ]));

  for (const [faction, count] of Object.entries(counts)) {
    if (count !== 50) throw new Error(`${faction} 카드 수 오류: ${count}`);
  }

  const ids = new Set();
  for (const card of CARD_POOL) {
    if (ids.has(card.id)) throw new Error(`중복 카드 ID: ${card.id}`);
    ids.add(card.id);
    if (!RARITY[card.rarity]) throw new Error(`잘못된 희귀도: ${card.name}`);
    if (card.type === 'spell' && !validEffects.has(card.effect)) throw new Error(`미등록 계략 효과: ${card.effect}`);
    if (card.type === 'equipment' && (!card.text || !card.effect)) throw new Error(`무기 데이터 오류: ${card.name}`);
  }

  return counts;
}

validateCardPool();
