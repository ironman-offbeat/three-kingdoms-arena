# Three Kingdoms: Fortress Arena

삼국지 세계관의 싱글 플레이 투기장형 카드 전략 게임입니다.

## 현재 구현

- 위·촉·오 진영 선택
- 30회 투기장 드래프트
- 총 200종 카드
  - 위 50장
  - 촉 50장
  - 오 50장
  - 중립 50장
- 부대, 계략, 무기, 탈것 카드
- 도발, 철갑, 은신, 속공, 돌진, 질풍, 생명력 흡수
- 진영별 군령
- 카드 대상 선택 및 부대 공격 대상 선택
- 싱글 플레이 AI 전투
- 손패 10장, 전장 7칸, 누적 탈진 피해

## 기본 규칙

- 성채 내구도 30
- 마나 1부터 시작하며 턴마다 최대 마나가 1 증가
- 최대 마나 10
- 후공은 동전 지급
- 턴 시작 시 카드 1장 드로우
- 덱이 비면 누적 탈진 피해

## 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 검사

```bash
npm test
npm run build
```

## Vercel

저장소를 Vercel에서 Import하면 `vercel.json` 설정에 따라 정적 빌드됩니다.

- Build command: `npm run build`
- Output directory: `dist`

## 실행 소스

```text
index.html
src/cards.js
src/game.js
src/main.js
src/style.css
```
