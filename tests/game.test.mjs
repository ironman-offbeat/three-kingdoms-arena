import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CARD_POOL, draftOptions, aiDeck, validateCardPool } from '../src/cards.js';
import {
  createBattle,
  playCard,
  attack,
  validTargets,
  draw,
  heroPower,
  validHeroPowerTargets,
  chooseDiscoveredCard,
} from '../src/game.js';

const rng = () => 0.25;
const card = (name) => structuredClone(CARD_POOL.find((entry) => entry.name === name));

function battleState(playerFaction = 'wei', enemyFaction = 'shu') {
  const battle = createBattle(playerFaction, aiDeck(playerFaction, rng), enemyFaction, rng);
  battle.turn = 'player';
  battle.winner = null;
  battle.pendingDiscover = null;
  battle.player.mana = 10;
  battle.player.maxMana = 10;
  battle.player.hand = [];
  battle.player.board = [];
  battle.player.grave = [];
  battle.enemy.board = [];
  return battle;
}

function unit(name, attackValue, health, keywords = [], extra = {}) {
  return {
    id: `test-${name}`,
    name,
    type: 'unit',
    faction: 'neutral',
    rarity: 'common',
    cost: 1,
    attack: attackValue,
    health,
    maxHealth: health,
    keywords,
    canAttack: true,
    attacksLeft: 1,
    rushRestricted: false,
    shield: keywords.includes('철갑'),
    stealth: keywords.includes('은신'),
    equipment: null,
    ...extra,
  };
}

test('card catalog has exactly 200 cards and 50 per faction', () => {
  assert.deepEqual(validateCardPool(), { wei: 50, shu: 50, wu: 50, neutral: 50 });
});

test('all four mount cards remain in the catalog', () => {
  assert.deepEqual(
    ['적토마', '적로', '절영', '조황비전'].map((name) => CARD_POOL.some((entry) => entry.name === name)),
    [true, true, true, true],
  );
});

test('weapon rarity and text metadata are valid', () => {
  for (const name of ['청룡언월도', '장팔사모', '의천검', '청강검', '방천화극', '고정도']) {
    const weapon = card(name);
    assert.ok(['common', 'rare', 'epic', 'legendary'].includes(weapon.rarity));
    assert.ok(weapon.text.length > 0);
    assert.ok(weapon.effect.length > 0);
  }
});

test('draft presents three cards', () => assert.equal(draftOptions('wei', rng).length, 3));
test('AI deck has thirty cards', () => assert.equal(aiDeck('shu', rng).length, 30));

test('index.html references files that exist', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /src\/style\.css/);
  assert.match(html, /src\/main\.js/);
  await access(new URL('../src/style.css', import.meta.url));
  await access(new URL('../src/main.js', import.meta.url));
});

test('taunt limits attack targets', () => {
  const battle = battleState();
  battle.player.board = [unit('공격자', 3, 3)];
  battle.enemy.board = [unit('도발', 1, 3, ['도발']), unit('일반', 1, 2)];
  const targets = validTargets(battle, 'player', 0);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].index, 0);
});

test('rush can attack units but cannot attack fortress on the summoned turn', () => {
  const battle = battleState();
  battle.player.hand = [card('관도 궁기병 1')];
  battle.player.hand[0].keywords = ['속공'];
  battle.enemy.board = [unit('수비병', 1, 2)];
  assert.equal(playCard(battle, 'player', 0).ok, true);
  const targets = validTargets(battle, 'player', 0);
  assert.equal(targets.some((target) => target.type === 'unit'), true);
  assert.equal(targets.some((target) => target.type === 'fortress'), false);
});

test('charge can attack fortress on the summoned turn', () => {
  const battle = battleState();
  battle.player.hand = [card('적토마')];
  battle.player.board = [unit('기병', 3, 3, [], { canAttack: false, attacksLeft: 0 })];
  assert.equal(playCard(battle, 'player', 0, { side: 'player', type: 'unit', index: 0 }).ok, true);
  assert.equal(validTargets(battle, 'player', 0).some((target) => target.type === 'fortress'), true);
});

test('windfury unit starts with two attacks', () => {
  const battle = battleState();
  battle.player.hand = [card('여포')];
  assert.equal(playCard(battle, 'player', 0).ok, true);
  assert.equal(battle.player.board[0].attacksLeft, 2);
});

test('fatigue damage occurs even when hand is full', () => {
  const battle = battleState();
  battle.player.deck = [];
  battle.player.hand = Array.from({ length: 10 }, (_, index) => ({ id: `hand-${index}` }));
  battle.player.fortress = 30;
  draw(battle, 'player');
  assert.equal(battle.player.fortress, 29);
  assert.equal(battle.player.fatigue, 1);
});

test('ambush-killed attacker does not damage fortress when another unit shifts into its index', () => {
  const battle = battleState();
  battle.player.board = [unit('죽을 공격자', 5, 2), unit('후속 부대', 1, 3)];
  battle.enemy.secret = 'ambush';
  battle.enemy.fortress = 30;
  const result = attack(battle, 'player', 0, { side: 'enemy', type: 'fortress' });
  assert.equal(result.ok, true);
  assert.equal(battle.enemy.fortress, 30);
  assert.equal(battle.player.board[0].name, '후속 부대');
});

test('군량 약탈 draws two cards and damages own fortress by one', () => {
  const battle = battleState();
  battle.player.hand = [card('군량 약탈')];
  battle.player.deck = [card('군량 확보'), card('화계')];
  battle.player.fortress = 30;
  assert.equal(playCard(battle, 'player', 0).ok, true);
  assert.equal(battle.player.hand.length, 2);
  assert.equal(battle.player.fortress, 29);
});

test('추격전 grants two attacks this turn', () => {
  const battle = battleState();
  battle.player.hand = [card('추격전')];
  battle.player.board = [unit('대상', 2, 3, [], { canAttack: false, attacksLeft: 0 })];
  const result = playCard(battle, 'player', 0, { side: 'player', type: 'unit', index: 0 });
  assert.equal(result.ok, true);
  assert.equal(battle.player.board[0].canAttack, true);
  assert.equal(battle.player.board[0].attacksLeft, 2);
});

test('도원결의 buffs no more than three friendly units', () => {
  const battle = battleState('shu', 'wei');
  battle.player.hand = [card('도원결의')];
  battle.player.board = [unit('1', 1, 1), unit('2', 1, 1), unit('3', 1, 1), unit('4', 1, 1)];
  assert.equal(playCard(battle, 'player', 0).ok, true);
  assert.deepEqual(battle.player.board.map((entry) => [entry.attack, entry.health]), [[3, 3], [3, 3], [3, 3], [1, 1]]);
});

test('재정비 returns the most recently dead unit to hand', () => {
  const battle = battleState('shu', 'wei');
  const dead = unit('전사한 부대', 4, 0, ['도발']);
  battle.player.grave = [dead];
  battle.player.hand = [card('재정비')];
  assert.equal(playCard(battle, 'player', 0).ok, true);
  assert.equal(battle.player.grave.length, 0);
  assert.equal(battle.player.hand[0].name, '전사한 부대');
  assert.equal(battle.player.hand[0].health, dead.maxHealth);
});

test('연환계 damages the selected enemy and one additional enemy', () => {
  const battle = battleState('wu', 'wei');
  battle.player.hand = [card('연환계')];
  battle.enemy.board = [unit('첫 적', 1, 5), unit('둘째 적', 1, 5), unit('셋째 적', 1, 5)];
  assert.equal(playCard(battle, 'player', 0, { side: 'enemy', type: 'unit', index: 1 }).ok, true);
  assert.deepEqual(battle.enemy.board.map((entry) => entry.health), [3, 3, 5]);
});

test('강동의 지략 creates three discover options and selected card enters hand', () => {
  const battle = battleState('wu', 'wei');
  battle.player.hand = [card('강동의 지략')];
  const result = playCard(battle, 'player', 0, null, rng);
  assert.equal(result.ok, true);
  assert.equal(battle.pendingDiscover.options.length, 3);
  assert.equal(chooseDiscoveredCard(battle, 'player', 1).ok, true);
  assert.equal(battle.pendingDiscover, null);
  assert.equal(battle.player.hand.length, 1);
  assert.equal(battle.player.hand[0].type, 'spell');
});

test('퇴각 명령 returns selected friendly unit to hand', () => {
  const battle = battleState();
  battle.player.hand = [card('퇴각 명령')];
  battle.player.board = [unit('복귀 대상', 3, 2)];
  assert.equal(playCard(battle, 'player', 0, { side: 'player', type: 'unit', index: 0 }).ok, true);
  assert.equal(battle.player.board.length, 0);
  assert.equal(battle.player.hand[0].name, '복귀 대상');
});

test('청강검 ignores shield', () => {
  const battle = battleState();
  battle.player.hand = [card('청강검')];
  battle.player.board = [unit('검 사용자', 2, 5)];
  battle.enemy.board = [unit('철갑 적', 1, 5, ['철갑'])];
  playCard(battle, 'player', 0, { side: 'player', type: 'unit', index: 0 });
  attack(battle, 'player', 0, { side: 'enemy', type: 'unit', index: 0 });
  assert.equal(battle.enemy.board[0].health, 1);
  assert.equal(battle.enemy.board[0].shield, true);
});

test('청룡언월도 refreshes attack after killing an enemy', () => {
  const battle = battleState();
  battle.player.hand = [card('청룡언월도')];
  battle.player.board = [unit('검 사용자', 1, 5)];
  battle.enemy.board = [unit('약한 적', 0, 2)];
  playCard(battle, 'player', 0, { side: 'player', type: 'unit', index: 0 });
  attack(battle, 'player', 0, { side: 'enemy', type: 'unit', index: 0 });
  assert.equal(battle.player.board[0].canAttack, true);
  assert.equal(battle.player.board[0].attacksLeft, 1);
});

test('lifesteal heals fortress by damage dealt', () => {
  const battle = battleState();
  battle.player.fortress = 20;
  battle.player.board = [unit('흡혈 부대', 4, 5, ['생명력 흡수'])];
  battle.enemy.fortress = 30;
  attack(battle, 'player', 0, { side: 'enemy', type: 'fortress' });
  assert.equal(battle.player.fortress, 24);
});

test('hero power requires and applies a valid target', () => {
  const battle = battleState('wei', 'shu');
  battle.player.board = [unit('군령 대상', 2, 3, [], { canAttack: false, attacksLeft: 0 })];
  battle.player.mana = 2;
  const targets = validHeroPowerTargets(battle, 'player');
  assert.equal(targets.some((target) => target.side === 'player' && target.type === 'unit'), true);
  assert.equal(heroPower(battle, 'player').ok, false);
  assert.equal(heroPower(battle, 'player', { side: 'player', type: 'unit', index: 0 }).ok, true);
  assert.equal(battle.player.board[0].attack, 4);
});
