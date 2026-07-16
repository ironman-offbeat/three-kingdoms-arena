import { FACTIONS, CARD_POOL, RARITY, draftOptions } from './cards.js';
import {
  createBattle,
  playCard,
  attack,
  endTurn,
  heroPower,
  aiTurn,
  validTargets,
  validCardTargets,
  validHeroPowerTargets,
  chooseDiscoveredCard,
} from './game.js';

const app = document.querySelector('#app');

let screen = 'title';
let faction = null;
let draft = [];
let options = [];
let battle = null;
let drag = null;
let message = '';
let pendingAction = null;

const enemyFaction = () => {
  const candidates = ['wei', 'shu', 'wu'].filter((candidate) => candidate !== faction);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

function render() {
  if (screen === 'title') renderTitle();
  else if (screen === 'draft') renderDraft();
  else renderBattle();
}

function renderTitle() {
  app.innerHTML = `
    <main class="title-screen">
      <div class="title-crest">城</div>
      <p class="eyebrow">THREE KINGDOMS CARD ARENA</p>
      <h1>삼국지<br><span>성채 투기장</span></h1>
      <p class="lead">세 장 중 하나를 골라 30장 덱을 완성하고 적 성을 무너뜨리십시오.</p>
      <div class="factions">
        ${['wei', 'shu', 'wu'].map((entry) => `
          <button class="faction-card ${entry}" data-f="${entry}">
            <b>${FACTIONS[entry].name}</b>
            <strong>${entry === 'wei' ? '⚔️' : entry === 'shu' ? '🛡️' : '🔥'}</strong>
            <span>${FACTIONS[entry].identity}</span>
            <small>군령 · ${FACTIONS[entry].power}</small>
          </button>
        `).join('')}
      </div>
      <div class="catalog">초기 카드 세트 <b>${CARD_POOL.length}</b>종 · 싱글플레이 투기장</div>
    </main>
  `;

  app.querySelectorAll('[data-f]').forEach((button) => {
    button.addEventListener('click', () => startDraft(button.dataset.f));
  });
}

function startDraft(selectedFaction) {
  faction = selectedFaction;
  draft = [];
  pendingAction = null;
  screen = 'draft';
  nextDraft();
}

function nextDraft() {
  options = draftOptions(faction);
  render();
}

function pick(index) {
  draft.push(options[index]);
  if (draft.length >= 30) {
    battle = createBattle(faction, draft, enemyFaction());
    screen = 'battle';
    message = '투기장 개전';
    render();
    if (battle.turn === 'enemy') setTimeout(runAi, 700);
  } else {
    nextDraft();
  }
}

function cardMarkup(card, options = {}) {
  const disabled = options.disabled ? ' disabled' : '';
  const selected = options.selected ? ' selected' : '';
  const typeName = card.type === 'unit' ? '부대' : card.type === 'spell' ? '계략' : card.type === 'equipment' ? '무기' : '탈것';
  const stats = card.type === 'unit'
    ? `<div class="attack">${card.attack}</div><div class="health">${card.health}</div>`
    : card.type === 'equipment'
      ? `<div class="attack">${card.attack}</div><div class="health">${card.durability}</div>`
      : '';

  return `
    <article
      class="card rarity-${card.rarity} faction-${card.faction}${disabled}${selected}"
      data-card-index="${options.index ?? ''}"
      draggable="${options.draggable ? 'true' : 'false'}"
    >
      <div class="mana">${card.cost}</div>
      <div class="card-art">${card.type === 'unit' ? '👤' : card.type === 'spell' ? '📜' : card.type === 'equipment' ? '🗡️' : '🐎'}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-type">${typeName} · ${RARITY[card.rarity] || card.rarity}</div>
      <div class="card-text">${(card.keywords || []).map((keyword) => `<b>${keyword}</b>`).join(' ')} ${card.text || ''}</div>
      ${stats}
    </article>
  `;
}

function renderDraft() {
  app.innerHTML = `
    <main class="draft-screen">
      <header>
        <div>
          <p class="eyebrow">${FACTIONS[faction].name}군 투기장 징집</p>
          <h2>세 장 중 한 장을 선택하십시오</h2>
        </div>
        <div class="draft-count"><b>${draft.length}</b><span>/ 30</span></div>
      </header>
      <div class="draft-progress"><i style="width:${(draft.length / 30) * 100}%"></i></div>
      <section class="draft-options">
        ${options.map((card, index) => `<button class="draft-pick" data-pick="${index}">${cardMarkup(card)}</button>`).join('')}
      </section>
      <aside class="curve">
        <b>현재 덱 ${draft.length}장</b>
        <div>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((cost) => `
            <span>${cost}<em>${draft.filter((card) => Math.min(10, card.cost) === cost).length}</em></span>
          `).join('')}
        </div>
      </aside>
    </main>
  `;

  app.querySelectorAll('[data-pick]').forEach((button) => {
    button.addEventListener('click', () => pick(Number(button.dataset.pick)));
  });
}

function targetMatches(candidate, target) {
  return candidate.side === target.side
    && candidate.type === target.type
    && candidate.index === target.index;
}

function isPendingTarget(target) {
  return pendingAction?.targets?.some((candidate) => targetMatches(candidate, target));
}

function fortress(who) {
  const player = battle[who];
  const name = who === 'player'
    ? `${FACTIONS[battle.playerFaction].name}군 성채`
    : `${FACTIONS[battle.enemyFaction].name}군 성채`;
  const target = { side: who, type: 'fortress', index: undefined };
  const targetable = isPendingTarget(target) ? ' targetable' : '';

  return `
    <div class="fortress ${who}${targetable}" data-target-side="${who}" data-target-type="fortress">
      <div class="castle">${player.fortress <= 10 ? '🔥' : '🏯'}</div>
      <div><b>${name}</b><span>내구도 ${Math.max(0, player.fortress)} / 30</span></div>
      <div class="fortress-hp"><i style="width:${(Math.max(0, player.fortress) / 30) * 100}%"></i></div>
    </div>
  `;
}

function unitMarkup(unit, side, index) {
  const attackValue = unit.attack + (unit.equipment?.attack || 0);
  const target = { side, index, type: 'unit' };
  const targetable = isPendingTarget(target) ? ' targetable' : '';

  return `
    <div
      class="unit ${unit.canAttack && side === 'player' ? 'ready' : ''} ${unit.keywords?.includes('도발') ? 'taunt' : ''} ${unit.stealth ? 'stealth' : ''}${targetable}"
      data-unit-side="${side}"
      data-unit-index="${index}"
      data-target-side="${side}"
      data-target-index="${index}"
      data-target-type="unit"
    >
      <div class="unit-art">${unit.shield ? '🛡️' : unit.stealth ? '🌫️' : '⚔️'}</div>
      <b>${unit.name}</b>
      <small>${(unit.keywords || []).join(' · ')}</small>
      ${unit.equipment ? `<em>${unit.equipment.name} ${unit.equipment.durability}</em>` : ''}
      <span class="unit-atk">${attackValue}</span>
      <span class="unit-hp">${unit.health}</span>
    </div>
  `;
}

function discoverMarkup() {
  if (!battle.pendingDiscover || battle.pendingDiscover.who !== 'player') return '';
  return `
    <div class="discover-overlay">
      <section class="discover-panel">
        <h2>발견</h2>
        <p>가져올 계략 카드 한 장을 선택하십시오.</p>
        <div class="discover-options">
          ${battle.pendingDiscover.options.map((card, index) => `
            <button data-discover="${index}">${cardMarkup(card)}</button>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderBattle() {
  const player = battle.player;
  const enemy = battle.enemy;
  const selectedCardIndex = pendingAction?.kind === 'card' ? pendingAction.index : null;

  app.innerHTML = `
    <main class="battle-screen faction-bg-${faction}">
      <header class="battle-top">
        <div>적 손패 ${enemy.hand.length} · 덱 ${enemy.deck.length}</div>
        <div class="turn-label">${battle.turn === 'player' ? '나의 턴' : '적의 턴'} · ${battle.round}턴</div>
        <button class="small" id="newGame">새 게임</button>
      </header>
      ${fortress('enemy')}
      <section class="board enemy-board">
        ${enemy.board.map((unit, index) => unitMarkup(unit, 'enemy', index)).join('') || '<div class="empty-board">적 전장</div>'}
      </section>
      <div class="battle-line"><span>⚔ 전선 ⚔</span></div>
      <section class="board player-board">
        ${player.board.map((unit, index) => unitMarkup(unit, 'player', index)).join('') || '<div class="empty-board">카드를 이곳으로 끌어 소환</div>'}
      </section>
      ${fortress('player')}
      <section class="hand-wrap">
        <div class="hand">
          ${player.hand.map((card, index) => cardMarkup(card, {
            index,
            draggable: battle.turn === 'player' && !battle.pendingDiscover,
            disabled: card.cost > player.mana,
            selected: index === selectedCardIndex,
          })).join('')}
        </div>
        <aside class="command">
          <div class="mana-orbs"><b>${player.mana}</b><span>/ ${player.maxMana}</span></div>
          <button id="power" ${player.powerUsed || player.mana < 2 || battle.turn !== 'player' || battle.pendingDiscover ? 'disabled' : ''}>
            군령 2<br><small>${FACTIONS[faction].power}</small>
          </button>
          <button id="endTurn" ${battle.turn !== 'player' || battle.pendingDiscover ? 'disabled' : ''}>턴 종료</button>
        </aside>
      </section>
      <div class="combat-log">${battle.log.slice(0, 5).map((entry) => `<span>${entry}</span>`).join('')}</div>
      ${message ? `<div class="toast">${message}</div>` : ''}
      ${battle.winner ? `
        <div class="result">
          <h2>${battle.winner === 'player' ? '승리' : '패배'}</h2>
          <p>${battle.winner === 'player' ? '적 성채를 함락했습니다.' : '아군 성채가 무너졌습니다.'}</p>
          <button id="restart">다시 시작</button>
        </div>
      ` : ''}
      ${discoverMarkup()}
    </main>
  `;

  wireBattle();
}

function elementTarget(element) {
  return {
    side: element.dataset.targetSide,
    type: element.dataset.targetType,
    index: element.dataset.targetIndex === undefined ? undefined : Number(element.dataset.targetIndex),
  };
}

function wireBattle() {
  document.querySelector('#newGame')?.addEventListener('click', () => {
    screen = 'title';
    battle = null;
    pendingAction = null;
    render();
  });

  document.querySelector('#restart')?.addEventListener('click', () => {
    screen = 'title';
    battle = null;
    pendingAction = null;
    render();
  });

  document.querySelector('#endTurn')?.addEventListener('click', () => {
    pendingAction = null;
    endTurn(battle, 'player');
    message = '적군 행동 중';
    render();
    setTimeout(runAi, 650);
  });

  document.querySelector('#power')?.addEventListener('click', () => selectHeroPower());

  document.querySelectorAll('[data-discover]').forEach((button) => {
    button.addEventListener('click', () => {
      const result = chooseDiscoveredCard(battle, 'player', Number(button.dataset.discover));
      message = result.ok ? `${result.card.name} 획득` : result.error;
      pendingAction = null;
      render();
    });
  });

  document.querySelectorAll('.card[draggable="true"]').forEach((element) => {
    element.addEventListener('dragstart', (event) => {
      drag = { kind: 'card', index: Number(element.dataset.cardIndex) };
      event.dataTransfer.setData('text/plain', 'card');
    });
    element.addEventListener('click', () => selectCard(Number(element.dataset.cardIndex)));
  });

  document.querySelectorAll('[data-target-side]').forEach((element) => {
    const target = elementTarget(element);
    if (isPendingTarget(target)) {
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        resolvePendingAction(target);
      });
    }

    element.addEventListener('dragover', (event) => event.preventDefault());
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      dropOn(element);
    });
  });

  document.querySelector('.player-board')?.addEventListener('dragover', (event) => event.preventDefault());
  document.querySelector('.player-board')?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropOn(event.currentTarget);
  });

  document.querySelectorAll('.unit[data-unit-side="player"]').forEach((element) => {
    if (!element.classList.contains('targetable')) {
      element.draggable = true;
      element.addEventListener('dragstart', (event) => {
        drag = { kind: 'unit', index: Number(element.dataset.unitIndex) };
        event.dataTransfer.setData('text/plain', 'unit');
      });
      element.addEventListener('click', () => selectAttacker(Number(element.dataset.unitIndex)));
    }
  });
}

function selectCard(index) {
  const card = battle.player.hand[index];
  if (!card || card.cost > battle.player.mana || battle.turn !== 'player') return;

  const targets = validCardTargets(battle, 'player', card);
  if (card.target && card.target !== 'none') {
    if (!targets.length) {
      message = '사용할 수 있는 대상이 없습니다.';
      pendingAction = null;
    } else {
      pendingAction = { kind: 'card', index, targets };
      message = `${card.name} 대상 선택`;
    }
    render();
    return;
  }

  playSelectedCard(index, null);
}

function selectHeroPower() {
  const targets = validHeroPowerTargets(battle, 'player');
  if (!targets.length) {
    message = '군령을 사용할 대상이 없습니다.';
    pendingAction = null;
  } else {
    pendingAction = { kind: 'power', targets };
    message = '군령 대상 선택';
  }
  render();
}

function selectAttacker(index) {
  const unit = battle.player.board[index];
  if (!unit?.canAttack) return;
  const targets = validTargets(battle, 'player', index);
  if (!targets.length) {
    message = '공격할 수 있는 대상이 없습니다.';
    pendingAction = null;
  } else {
    pendingAction = { kind: 'attack', index, targets };
    message = `${unit.name} 공격 대상 선택`;
  }
  render();
}

function resolvePendingAction(target) {
  const action = pendingAction;
  pendingAction = null;
  if (!action) return;

  if (action.kind === 'card') playSelectedCard(action.index, target);
  else if (action.kind === 'power') {
    const result = heroPower(battle, 'player', target);
    message = result.ok ? '군령 발동' : result.error;
    render();
  } else if (action.kind === 'attack') {
    performAttack(action.index, target);
  }
}

function playSelectedCard(index, target) {
  const card = battle.player.hand[index];
  const result = playCard(battle, 'player', index, target);
  message = result.ok ? `${card.name} 사용` : result.error;
  render();
}

function dropOn(element) {
  if (!drag) return;

  const target = element.dataset.targetSide ? elementTarget(element) : null;
  if (drag.kind === 'card') {
    const card = battle.player.hand[drag.index];
    const result = playCard(battle, 'player', drag.index, target);
    message = result.ok ? `${card.name} 사용` : result.error;
  } else if (target) {
    performAttack(drag.index, target, false);
  }

  drag = null;
  pendingAction = null;
  render();
}

function performAttack(index, target, rerender = true) {
  const attacker = battle.player.board[index];
  const result = attack(battle, 'player', index, target);
  message = result.ok ? `${attacker?.name || '부대'} 공격!` : result.error;
  if (result.ok) impact(target);
  if (rerender) render();
}

function impact(target) {
  setTimeout(() => {
    const selector = target.type === 'fortress'
      ? `.fortress.${target.side}`
      : `[data-unit-side="${target.side}"][data-unit-index="${target.index}"]`;
    const element = document.querySelector(selector);
    element?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(10px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 240 },
    );
  }, 20);
}

function runAi() {
  if (!battle || battle.winner) return;
  aiTurn(battle);
  message = '나의 턴';
  pendingAction = null;
  render();
}

render();
