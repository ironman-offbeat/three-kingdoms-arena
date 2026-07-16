import { CARD_POOL, aiDeck } from './cards.js';

const clone = (value) => structuredClone(value);
const otherSide = (who) => (who === 'player' ? 'enemy' : 'player');

const shuffle = (items, rng = Math.random) => {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
};

const side = () => ({
  fortress: 30,
  maxFortress: 30,
  mana: 0,
  maxMana: 0,
  deck: [],
  hand: [],
  board: [],
  grave: [],
  fatigue: 0,
  secret: null,
  powerUsed: false,
  spellPower: 0,
});

export function createBattle(playerFaction, deck, enemyFaction, rng = Math.random) {
  const first = rng() < 0.5 ? 'player' : 'enemy';
  const state = {
    playerFaction,
    enemyFaction,
    turn: first,
    round: 0,
    winner: null,
    log: [],
    pendingDiscover: null,
    player: side(),
    enemy: side(),
  };

  state.player.deck = shuffle(deck, rng);
  state.enemy.deck = shuffle(aiDeck(enemyFaction, rng), rng);

  for (let index = 0; index < (first === 'player' ? 3 : 4); index += 1) draw(state, 'player');
  for (let index = 0; index < (first === 'enemy' ? 3 : 4); index += 1) draw(state, 'enemy');

  const coin = {
    id: first === 'enemy' ? 'coin' : 'coin-ai',
    name: '동전',
    type: 'spell',
    cost: 0,
    rarity: 'common',
    faction: 'neutral',
    text: '이번 턴에만 마나 +1',
    effect: 'coin',
    target: 'none',
  };
  state[first === 'enemy' ? 'player' : 'enemy'].hand.push(coin);

  startTurn(state, first);
  return state;
}

export function draw(state, who) {
  const player = state[who];

  if (!player.deck.length) {
    player.fatigue += 1;
    damageFortress(state, who, player.fatigue);
    log(state, `피로 피해 ${player.fatigue}`);
    return;
  }

  const card = player.deck.shift();
  if (player.hand.length >= 10) {
    log(state, `${who === 'player' ? '내' : '적'} 손패가 가득 차 카드가 소멸했습니다.`);
    return;
  }

  player.hand.push(card);
}

export function startTurn(state, who) {
  if (state.winner) return;

  state.turn = who;
  state.round += 1;
  const player = state[who];
  player.maxMana = Math.min(10, player.maxMana + 1);
  player.mana = player.maxMana;
  player.powerUsed = false;
  player.spellPower = 0;

  player.board.forEach((unit) => {
    unit.canAttack = true;
    unit.attacksLeft = unit.keywords?.includes('질풍') ? 2 : 1;
    unit.rushRestricted = false;
    unit.frozen = false;
  });

  draw(state, who);
  log(state, `${who === 'player' ? '아군' : '적군'} 턴 시작 · 마나 ${player.mana}`);
}

export function endTurn(state, who) {
  if (state.turn !== who || state.winner || state.pendingDiscover) return false;
  startTurn(state, otherSide(who));
  return true;
}

function resolveUnit(state, target) {
  if (!target?.side || !Number.isInteger(target.index)) return null;
  return state[target.side]?.board[target.index] || null;
}

function isValidTarget(state, who, card, target) {
  if (!card.target || card.target === 'none') return true;
  return validCardTargets(state, who, card).some((candidate) => (
    candidate.side === target?.side
    && candidate.type === target?.type
    && candidate.index === target?.index
  ));
}

export function validCardTargets(state, who, card) {
  const enemy = otherSide(who);
  const friendlyUnits = state[who].board.map((_, index) => ({ side: who, index, type: 'unit' }));
  const enemyUnits = state[enemy].board.map((unit, index) => ({ side: enemy, index, type: 'unit', unit }))
    .filter(({ unit }) => !unit.stealth)
    .map(({ side, index, type }) => ({ side, index, type }));

  switch (card.target) {
    case 'friendlyUnit':
      return friendlyUnits;
    case 'enemyUnit':
      return enemyUnits;
    case 'enemyUnitOrFortress':
      return [...enemyUnits, { side: enemy, type: 'fortress' }];
    case 'friendlyUnitOrOwnFortress':
      return [...friendlyUnits, { side: who, type: 'fortress' }];
    default:
      return [];
  }
}

export function playCard(state, who, handIndex, target = null, rng = Math.random) {
  if (state.turn !== who || state.winner) return { ok: false, error: '내 턴이 아닙니다.' };
  if (state.pendingDiscover) return { ok: false, error: '발견할 카드를 먼저 선택하세요.' };

  const player = state[who];
  const card = player.hand[handIndex];
  if (!card) return { ok: false, error: '카드가 없습니다.' };
  if (card.cost > player.mana) return { ok: false, error: '마나가 부족합니다.' };
  if (card.type === 'unit' && player.board.length >= 7) return { ok: false, error: '전장이 가득 찼습니다.' };
  if (!isValidTarget(state, who, card, target)) return { ok: false, error: '올바른 대상을 선택하세요.' };

  player.mana -= card.cost;
  player.hand.splice(handIndex, 1);

  if (card.type === 'unit') {
    const hasCharge = card.keywords?.includes('돌진');
    const hasRush = card.keywords?.includes('속공');
    const unit = {
      ...clone(card),
      maxHealth: card.health,
      canAttack: hasCharge || hasRush,
      attacksLeft: card.keywords?.includes('질풍') ? 2 : 1,
      rushRestricted: hasRush && !hasCharge,
      shield: card.keywords?.includes('철갑'),
      stealth: card.keywords?.includes('은신'),
      equipment: null,
    };
    player.board.push(unit);
    return { ok: true, kind: 'summon', unit };
  }

  if (card.type === 'equipment') {
    const unit = resolveUnit(state, target);
    unit.equipment = {
      name: card.name,
      attack: card.attack,
      durability: card.durability,
      text: card.text,
      effect: card.effect,
      attacksMade: 0,
    };
    if (card.effect === 'drawOnEquip') draw(state, who);
    return { ok: true, kind: 'equipment', unit };
  }

  if (card.type === 'mount') {
    const unit = resolveUnit(state, target);
    unit.health = Math.min(unit.maxHealth, unit.health + card.heal);
    unit.keywords = [...new Set([...(unit.keywords || []), card.keyword])];
    if (card.keyword === '철갑') unit.shield = true;
    if (card.keyword === '은신') unit.stealth = true;
    if (card.keyword === '돌진') {
      unit.canAttack = true;
      unit.rushRestricted = false;
      unit.attacksLeft = Math.max(unit.attacksLeft || 0, unit.keywords.includes('질풍') ? 2 : 1);
    }
    if (card.keyword === '속공') {
      unit.canAttack = true;
      unit.rushRestricted = true;
      unit.attacksLeft = Math.max(unit.attacksLeft || 0, unit.keywords.includes('질풍') ? 2 : 1);
    }
    return { ok: true, kind: 'mount', unit };
  }

  const spellResult = applySpell(state, who, card, target, rng);
  cleanup(state);
  return { ok: true, kind: 'spell', ...spellResult };
}

function applySpell(state, who, card, target, rng) {
  const me = state[who];
  const enemySide = otherSide(who);
  const enemy = state[enemySide];
  const friendly = target?.side === who ? resolveUnit(state, target) : null;
  const enemyUnit = target?.side === enemySide ? resolveUnit(state, target) : null;
  const amount = (value) => value + (me.spellPower || 0);

  switch (card.effect) {
    case 'coin':
      me.mana += 1;
      break;
    case 'damageFortress':
      damageFortress(state, enemySide, amount(2));
      break;
    case 'damage2':
      if (enemyUnit) damageUnit(state, enemySide, target.index, amount(2));
      else damageFortress(state, enemySide, amount(2));
      break;
    case 'damage4':
      if (enemyUnit) damageUnit(state, enemySide, target.index, amount(4));
      else damageFortress(state, enemySide, amount(4));
      break;
    case 'heal5':
      me.fortress = Math.min(me.maxFortress, me.fortress + 5);
      break;
    case 'heal4':
      friendly.health = Math.min(friendly.maxHealth, friendly.health + 4);
      break;
    case 'draw1':
      draw(state, who);
      break;
    case 'draw2':
      draw(state, who);
      draw(state, who);
      break;
    case 'draw2SelfDamage1':
      draw(state, who);
      draw(state, who);
      damageFortress(state, who, 1);
      break;
    case 'allAttack':
      me.board.forEach((unit) => { unit.attack += 2; });
      break;
    case 'allShield':
      me.board.forEach((unit) => { unit.shield = true; });
      break;
    case 'aoe2':
      enemy.board.forEach((_, index) => damageUnit(state, enemySide, index, amount(2), { defer: true }));
      break;
    case 'aoe3':
      enemy.board.forEach((_, index) => damageUnit(state, enemySide, index, amount(3), { defer: true }));
      break;
    case 'weiBuff':
      friendly.attack += 2;
      friendly.canAttack = true;
      friendly.rushRestricted = true;
      friendly.attacksLeft = Math.max(friendly.attacksLeft || 0, friendly.keywords?.includes('질풍') ? 2 : 1);
      break;
    case 'shuPower':
      if (friendly) {
        friendly.health += 2;
        friendly.maxHealth += 2;
      } else {
        me.fortress = Math.min(me.maxFortress, me.fortress + 2);
      }
      break;
    case 'spellPower':
      me.spellPower += 2;
      break;
    case 'summonGuards':
      for (let index = 0; index < 2 && me.board.length < 7; index += 1) me.board.push(token('의병', 1, 2, ['도발']));
      break;
    case 'summon2':
      for (let index = 0; index < 2 && me.board.length < 7; index += 1) me.board.push(token('병사', 2, 2, []));
      break;
    case 'secretAmbush':
      me.secret = 'ambush';
      break;
    case 'windfury':
      friendly.canAttack = true;
      friendly.attacksLeft = Math.max(friendly.attacksLeft || 0, 2);
      break;
    case 'tripleBuff':
      me.board.slice(0, 3).forEach((unit) => {
        unit.attack += 2;
        unit.health += 2;
        unit.maxHealth += 2;
      });
      break;
    case 'returnDead': {
      if (!me.grave.length || me.hand.length >= 10) break;
      const returned = me.grave.pop();
      me.hand.push(toCard(returned));
      break;
    }
    case 'split2': {
      const first = enemyUnit;
      const second = enemy.board.find((unit) => unit !== first && !unit.stealth);
      if (first) damageUnitByReference(state, enemySide, first, amount(2), { defer: true });
      if (second) damageUnitByReference(state, enemySide, second, amount(2), { defer: true });
      break;
    }
    case 'discoverSpell': {
      const pool = CARD_POOL.filter((candidate) => candidate.type === 'spell' && (candidate.faction === whoFaction(state, who) || candidate.faction === 'neutral'));
      const options = sampleUnique(pool, 3, rng).map(clone);
      state.pendingDiscover = { who, options };
      return { discoverOptions: options };
    }
    case 'bounceFriendly': {
      if (me.hand.length >= 10) break;
      const index = me.board.indexOf(friendly);
      if (index >= 0) {
        const [returned] = me.board.splice(index, 1);
        me.hand.push(toCard(returned));
      }
      break;
    }
    default:
      throw new Error(`구현되지 않은 카드 효과: ${card.effect}`);
  }

  return {};
}

export function chooseDiscoveredCard(state, who, optionIndex) {
  const pending = state.pendingDiscover;
  if (!pending || pending.who !== who) return { ok: false, error: '선택할 발견 카드가 없습니다.' };
  const card = pending.options[optionIndex];
  if (!card) return { ok: false, error: '잘못된 카드 선택입니다.' };
  if (state[who].hand.length < 10) state[who].hand.push(clone(card));
  state.pendingDiscover = null;
  return { ok: true, card };
}

const sampleUnique = (pool, count, rng) => {
  const candidates = [...pool];
  const output = [];
  while (output.length < count && candidates.length) {
    const index = Math.floor(rng() * candidates.length);
    output.push(candidates.splice(index, 1)[0]);
  }
  return output;
};

const toCard = (unit) => {
  const card = clone(unit);
  card.health = card.maxHealth ?? card.health;
  delete card.maxHealth;
  delete card.canAttack;
  delete card.attacksLeft;
  delete card.rushRestricted;
  delete card.shield;
  delete card.stealth;
  delete card.equipment;
  delete card.frozen;
  return card;
};

const token = (name, attack, health, keywords) => ({
  id: `token-${name}-${Math.random()}`,
  name,
  type: 'unit',
  faction: 'neutral',
  cost: 0,
  rarity: 'common',
  attack,
  health,
  maxHealth: health,
  keywords,
  canAttack: false,
  attacksLeft: 1,
  rushRestricted: false,
  shield: keywords.includes('철갑'),
  stealth: false,
  equipment: null,
});

const whoFaction = (state, who) => (who === 'player' ? state.playerFaction : state.enemyFaction);

export function validHeroPowerTargets(state, who) {
  const faction = whoFaction(state, who);
  const enemy = otherSide(who);
  const friendlyUnits = state[who].board.map((_, index) => ({ side: who, index, type: 'unit' }));
  const enemyUnits = state[enemy].board.map((unit, index) => ({ unit, side: enemy, index, type: 'unit' }))
    .filter(({ unit }) => !unit.stealth)
    .map(({ side, index, type }) => ({ side, index, type }));

  if (faction === 'wei') return [...friendlyUnits, { side: enemy, type: 'fortress' }];
  if (faction === 'shu') return [...friendlyUnits, { side: who, type: 'fortress' }];
  return [...enemyUnits, { side: enemy, type: 'fortress' }];
}

export function heroPower(state, who, target = null) {
  if (state.turn !== who) return { ok: false, error: '내 턴이 아닙니다.' };
  if (state.pendingDiscover) return { ok: false, error: '발견할 카드를 먼저 선택하세요.' };

  const player = state[who];
  if (player.powerUsed || player.mana < 2) return { ok: false, error: '군령을 사용할 수 없습니다.' };

  const valid = validHeroPowerTargets(state, who);
  const targetIsValid = valid.some((candidate) => (
    candidate.side === target?.side
    && candidate.type === target?.type
    && candidate.index === target?.index
  ));
  if (!targetIsValid) return { ok: false, error: '군령 대상을 선택하세요.' };

  player.mana -= 2;
  player.powerUsed = true;
  const faction = whoFaction(state, who);

  if (faction === 'wei') {
    if (target.type === 'unit') {
      const unit = resolveUnit(state, target);
      unit.attack += 2;
      unit.canAttack = true;
      unit.rushRestricted = true;
      unit.attacksLeft = Math.max(unit.attacksLeft || 0, unit.keywords?.includes('질풍') ? 2 : 1);
    } else {
      damageFortress(state, otherSide(who), 1);
    }
  } else if (faction === 'shu') {
    if (target.type === 'unit') {
      const unit = resolveUnit(state, target);
      unit.health += 2;
      unit.maxHealth += 2;
    } else {
      player.fortress = Math.min(player.maxFortress, player.fortress + 2);
    }
  } else {
    if (target.type === 'unit') damageUnit(state, target.side, target.index, 1);
    else damageFortress(state, otherSide(who), 1);
    draw(state, who);
  }

  cleanup(state);
  return { ok: true };
}

export function validTargets(state, who, attackerIndex) {
  const enemy = otherSide(who);
  const attacker = state[who].board[attackerIndex];
  if (!attacker) return [];

  const canAttackStealth = attacker.equipment?.effect === 'attackStealth';
  const visible = state[enemy].board
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => !unit.stealth || canAttackStealth);
  const taunts = visible.filter(({ unit }) => unit.keywords?.includes('도발'));

  if (taunts.length) return taunts.map(({ index }) => ({ side: enemy, index, type: 'unit' }));

  const unitTargets = visible.map(({ index }) => ({ side: enemy, index, type: 'unit' }));
  if (attacker.rushRestricted) return unitTargets;
  return [...unitTargets, { side: enemy, type: 'fortress' }];
}

export function attack(state, who, attackerIndex, target) {
  if (state.turn !== who || state.winner || state.pendingDiscover) return { ok: false, error: '공격할 수 없습니다.' };

  const enemy = otherSide(who);
  const attacker = state[who].board[attackerIndex];
  if (!attacker || !attacker.canAttack || attacker.attacksLeft <= 0) return { ok: false, error: '아직 공격할 수 없습니다.' };

  const allowed = validTargets(state, who, attackerIndex);
  if (!allowed.some((candidate) => (
    candidate.side === target.side
    && candidate.type === target.type
    && candidate.index === target.index
  ))) return { ok: false, error: '공격할 수 없는 대상입니다.' };

  attacker.stealth = false;
  const attackValue = totalAttack(attacker);
  const equipment = attacker.equipment;
  const equipmentEffect = equipment?.effect;
  let dealtDamage = 0;
  let killedTarget = false;
  let targetUnit = null;
  let adjacentUnits = [];

  if (target.type === 'fortress') {
    if (state[enemy].secret === 'ambush') {
      state[enemy].secret = null;
      damageUnitByReference(state, who, attacker, 3);
      if (!state[who].board.includes(attacker)) {
        cleanup(state);
        return { ok: true, damage: 0 };
      }
    }

    dealtDamage = damageFortress(state, enemy, attackValue);
  } else {
    targetUnit = state[enemy].board[target.index];
    const targetIndex = state[enemy].board.indexOf(targetUnit);
    if (equipmentEffect === 'adjacentOnFirstAttack' && equipment.attacksMade === 0) {
      adjacentUnits = [state[enemy].board[targetIndex - 1], state[enemy].board[targetIndex + 1]].filter(Boolean);
    }

    const defenderAttack = totalAttack(targetUnit);
    dealtDamage = damageUnitByReference(state, enemy, targetUnit, attackValue, { bypassShield: equipmentEffect === 'ignoreShield' });
    damageUnitByReference(state, who, attacker, defenderAttack);
    killedTarget = !state[enemy].board.includes(targetUnit);

    for (const adjacent of adjacentUnits) damageUnitByReference(state, enemy, adjacent, 1);
  }

  if (attacker.keywords?.includes('생명력 흡수') && dealtDamage > 0) {
    state[who].fortress = Math.min(state[who].maxFortress, state[who].fortress + dealtDamage);
  }

  if (state[who].board.includes(attacker)) {
    attacker.attacksLeft -= 1;
    if (attacker.attacksLeft <= 0) attacker.canAttack = false;

    if (equipment) {
      equipment.attacksMade += 1;
      if (equipmentEffect === 'refreshOnKill' && killedTarget) {
        attacker.canAttack = true;
        attacker.attacksLeft = Math.max(attacker.attacksLeft, 1);
      }
      if (equipmentEffect === 'damageOtherAfterAttack') {
        const another = state[enemy].board.find((unit) => unit !== targetUnit && !unit.stealth);
        if (another) damageUnitByReference(state, enemy, another, 3);
      }
      equipment.durability -= 1;
      if (equipment.durability <= 0) attacker.equipment = null;
    }
  }

  cleanup(state);
  return { ok: true, damage: dealtDamage };
}

const totalAttack = (unit) => unit.attack + (unit.equipment?.attack || 0);

export function damageUnit(state, who, index, amount, options = {}) {
  const unit = state[who].board[index];
  return damageUnitByReference(state, who, unit, amount, options);
}

function damageUnitByReference(state, who, unit, amount, options = {}) {
  if (!unit || !state[who].board.includes(unit)) return 0;
  if (unit.shield && !options.bypassShield) {
    unit.shield = false;
    return 0;
  }

  const before = Math.max(0, unit.health);
  unit.health -= amount;
  const dealt = Math.min(before, amount);
  if (!options.defer && unit.health <= 0) killByReference(state, who, unit);
  return dealt;
}

function killByReference(state, who, unit) {
  const index = state[who].board.indexOf(unit);
  if (index < 0) return;
  const [dead] = state[who].board.splice(index, 1);
  state[who].grave.push(dead);
}

function cleanup(state) {
  for (const who of ['player', 'enemy']) {
    for (let index = state[who].board.length - 1; index >= 0; index -= 1) {
      if (state[who].board[index].health <= 0) killByReference(state, who, state[who].board[index]);
    }
  }
  checkWinner(state);
}

function damageFortress(state, who, amount) {
  const before = Math.max(0, state[who].fortress);
  state[who].fortress -= amount;
  checkWinner(state);
  return Math.min(before, amount);
}

function checkWinner(state) {
  if (state.enemy.fortress <= 0) state.winner = 'player';
  if (state.player.fortress <= 0) state.winner = 'enemy';
}

function log(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
}

export function aiTurn(state, rng = Math.random) {
  if (state.turn !== 'enemy' || state.winner) return [];

  const events = [];
  let safety = 30;

  while (safety > 0) {
    safety -= 1;
    const player = state.enemy;
    const playable = player.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.cost <= player.mana && (card.type !== 'unit' || player.board.length < 7))
      .sort((left, right) => right.card.cost - left.card.cost);

    let played = false;
    for (const candidate of playable) {
      const target = chooseTarget(state, 'enemy', candidate.card, rng);
      if (candidate.card.target !== 'none' && !target) continue;
      const result = playCard(state, 'enemy', candidate.index, target, rng);
      if (!result.ok) continue;
      events.push({ type: 'play', card: candidate.card });
      played = true;
      if (state.pendingDiscover) {
        chooseDiscoveredCard(state, 'enemy', Math.floor(rng() * state.pendingDiscover.options.length));
      }
      break;
    }

    if (!played) break;
  }

  for (let index = 0; index < state.enemy.board.length; index += 1) {
    const unit = state.enemy.board[index];
    while (unit && state.enemy.board.includes(unit) && unit.canAttack && unit.attacksLeft > 0) {
      const currentIndex = state.enemy.board.indexOf(unit);
      const targets = validTargets(state, 'enemy', currentIndex);
      const target = targets.find((candidate) => candidate.type === 'unit') || targets.at(-1);
      if (!target) break;
      attack(state, 'enemy', currentIndex, target);
      events.push({ type: 'attack', name: unit.name, target });
      if (state.winner) break;
    }
    if (state.winner) break;
  }

  if (!state.winner && state.enemy.mana >= 2 && !state.enemy.powerUsed) {
    const targets = validHeroPowerTargets(state, 'enemy');
    const target = targets.find((candidate) => candidate.type === 'unit') || targets.at(-1);
    if (target && heroPower(state, 'enemy', target).ok) events.push({ type: 'power' });
  }

  if (!state.winner) endTurn(state, 'enemy');
  return events;
}

function chooseTarget(state, who, card, rng) {
  const targets = validCardTargets(state, who, card);
  if (!targets.length) return card.target === 'none' ? null : null;
  return targets[Math.floor(rng() * targets.length)];
}
