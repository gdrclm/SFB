# Speed Fall Ball

Browser-native prototype built with Babylon.js 9, strict TypeScript and Vite.

## Requirements

- Node.js with npm
- Browser with WebGL2

## Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

## PowerShell: команда `npm` не найдена

Если PowerShell сообщает, что имя `npm` не распознано, сначала установите
актуальную LTS-версию Node.js с [официального сайта](https://nodejs.org/en/download).
После установки полностью перезапустите PowerShell и проверьте окружение:

```powershell
node --version
npm.cmd --version
```

В PowerShell рекомендуется вызывать `npm.cmd`, поскольку выполнение `npm.ps1`
может блокироваться системной политикой:

```powershell
npm.cmd install
npm.cmd run dev
```

После запуска Vite откройте адрес, указанный в терминале. По умолчанию это
`http://localhost:5173/`.

### Временный portable Node.js

В текущем окружении Codex также может сохраняться временный Node.js. Пока он
не удалён при очистке `%TEMP%`, dev-сервер можно запустить напрямую:

```powershell
& "C:\Users\пк\AppData\Local\Temp\codex-node-v24.18.0\node-v24.18.0-win-x64\npm.cmd" run dev
```

Или добавить этот runtime в `PATH` только для текущего окна PowerShell:

```powershell
$nodeRuntime = "C:\Users\пк\AppData\Local\Temp\codex-node-v24.18.0\node-v24.18.0-win-x64"
$env:Path = "$nodeRuntime;$env:Path"
npm.cmd run dev
```

Этот путь является временным. Для постоянной разработки установите Node.js
LTS обычным способом.

WebGL2 is the default and required renderer. To request the additional WebGPU
mode in a supporting browser, open the application with `?renderer=webgpu`.
If WebGPU is unavailable, the application falls back to WebGL2.

## Current controls

Hold or drag the mouse/finger horizontally on the game canvas to guide the
falling ball. Releasing the pointer preserves a short horizontal inertia.
Press the large **BOOST** button to increase fall speed. The button shows its
one-second cooldown, current energy and the energy cost of the next boost.

## Run results

The game opens on a start screen and waits for **Начать забег**. Records are
available there, in the pause menu, and after game over. Exiting from pause
returns to the start screen.

Each run saves its date, maximum depth, collected coins, destroyed platforms,
and score in browser local storage. Score is one point per whole metre,
10 per coin, and 25 per destroyed platform. The table shows the top ten by
score, breaking ties by depth; interrupted runs are saved and labelled too.
Records are local to this browser and are removed when site data is cleared.
If storage is blocked or full, the game shows a message and keeps results for
the current page session.

An obstacle can remove only one life per appearance, even if the ball hits it
again after bouncing. A reused platform from the pool counts as a new obstacle.

## Boost and tutorial

Every successful boost multiplies current speed by 1.5 (10 → 15 → 22.5 →
33.75), with the existing one-second cooldown and speed-based energy cost.
Camera view height grows with the square root of the speed ratio on both
portrait and landscape screens. This expands the view while preserving a
visible increase in screen traversal speed. Each boost has a consistent ball
and button reaction, a speed-change message, and speed-dependent movement
streaks. Reduced-motion preferences disable streaks and button pulses.

The first run uses the staged contextual opening described below. A reference
guide remains available through **Как играть** in pause. Tutorial
platform illustrations reuse the same silhouette geometry as the game; hearts,
coins, energy, boost and slow-mode symbols accompany their explanations.

## Main menu and shop

Pause keeps the current run suspended. **Завершить забег → Главное меню**
ends it, saves its result, and credits collected coins to a persistent balance.
The results screen also has a main-menu button. The shop is available from
that menu, with energy upgrades, character/world skins, lantern decorations,
and atmospheric sparkles. Purchases and equipment apply to the next run.

Profile state is stored under `speed-fall-ball.profile.v1`. Historical run
coins are imported once by run ID; repeated menu visits or reloads do not
credit them again. Upgrade prices increase per level. Purchases and equipment
changes commit only after storage succeeds. With unavailable or corrupt
storage, shop transactions are blocked and an explanation is shown.

## Five-minute combo loop

Phase one now lasts 300 simulation seconds (slow mode stretches real time;
pause stops progression), with ten increasingly demanding stages. The HUD
shows an active-time clock and stage goals. A chain of 3/6/10/15 successful
platform breaks raises the hit multiplier to ×2/×3/×4/×5. A damaging bounce
resets the chain, preserving already earned points. Dodging and pauses do not
break it. Speed 20/35/55 adds ×1.25/×1.5/×2; breaking a platform whose strength
is at least 85% of current speed adds ×1.5. Each hit awards the floor of
25 × chain multiplier × speed multiplier × risk multiplier. Only the bonus
over the existing 25 base points is added to the run total. Best chain and
combo bonus persist with results; older records retain their original scores.
Combo points do not multiply spendable coins.

Only the nearest active platform intersecting the ball's current horizontal
lane reacts to speed. Breakable: faint glow; deficit ≤15%: amber tension;
moderate deficit: subdued orange; deficit over one third: strong rose outline.
This does not highlight safe routes in neighboring lanes. Platform strength
is an integer threshold shared by physics assessment, texture labels and HUD;
generated safe and boost routes account for this rounding. Pulses use game
time and become static with reduced-motion preferences.

Platform numbers also have neutral screen-space badges with a minimum readable
font size, so zooming out does not make strength values vanish. Only the one
platform intersecting the current lane receives a readiness-colored badge;
other lanes retain neutral numeric labels.

## Contextual first-run opening

The first run now starts gameplay immediately. Random platform and coin
production is disabled during the first 30 active simulation seconds. A simple
platform appears first, a coin at second 4, a boost gate at second 10, and a
real two-lane fork at second 18. Familiar platforms and coins at seconds
22/25/28 then provide practice and a natural first combo without new lecture
cards. Positions are placed ahead of the current ball,
so boosting does not reveal the whole lesson at once. The fork offers a safe
ordinary platform and a strong dark platform, without a free central corridor.
Each first appearance opens one short card with its matching illustration.
Physics, energy drain, cooldowns and game time freeze until Continue; Escape
also continues. A real first life loss explains lives; no damage is forced.
A first three-hit combo explains its multiplier. New special platforms after
staging are explained only once they are actually visible. UI controls appear
progressively as they are introduced.

At second 30, random generation restarts from the current ball position. This
avoids replaying rows from the original starting altitude. Completion is saved
under `speed-fall-ball.guided-opening.v1`; interrupted lessons can be retried.
**Обучающий забег** replays the opening from the main menu. Skip immediately
switches to random play and stops contextual prompts for the rest of the run.

## Haptics and independent feedback settings

Music, effects and vibration have independent persistent switches in the main
menu and pause menu. Existing sound-off preferences migrate only to the two
audio channels, leaving vibration independent. Media tagged
`data-audio-channel="music"` follows Music; other audio/video follows Effects,
including media added later. This adds channel controls, not new music assets.

Physical feedback uses the standard Vibration API, after a real user gesture
and only while the page is visible. Browsers without the API or which reject
it show an unavailable vibration switch. Hardware strength/amplitude cannot be
controlled by this API; actual feel depends on the device.

`HAPTIC_PATTERNS` defines short weak/normal/heavy/powerful breaks, blocked
impacts, bounces, BOOST/rejected attempts, sampled coins, rich-chain completion,
slow mode on/off, healing, life loss/final-life warning, stage/phase completion,
records and menu taps. A 20 ms window picks one highest-priority event. Lower
priority signals cannot interrupt an active impact; life loss can preempt it.
Life-loss and final-life patterns supersede the collision/bounce from the same
mistake. Coins are limited to one pulse per 450 ms. Rich trails celebrate only
when all of their spawned coins were collected, with no missed/recycled coins.

Unavailable BOOST uses an aria-disabled visual state while retaining actual
attempt events; only trusted rejected clicks request a 5 ms signal. Rendering
or polling button state emits nothing. Pause, teaching cards, page hiding,
blur and teardown cancel pending/active vibration. The physical event which
opened a teaching card can still deliver its single selected impact. Record
celebration waits 900 ms after game over so it does not stack with life loss,
and is cancelled when leaving/restarting. No score/coin credit is duplicated.


## Проверка обновлённой игры

Готовая сборка для GitHub Pages находится в `docs/`. Если Pages настроен на
ветку `main`, папку `/docs`, игра доступна по адресу:
https://gdrclm.github.io/SFB/

Для локальной проверки после получения изменений:

```bash
git pull origin main
npm ci
npm run dev
```

Откройте адрес Vite в браузере. На телефоне в той же сети запустите
`npm run dev -- --host 0.0.0.0` и откройте сетевой адрес, который выведет Vite.

Что проверить:

- Первый обучающий забег: простая платформа, монета, BOOST, развилка и
  контекстные карточки с изображениями. Пауза останавливает симуляцию.
- Жизни: одна активация платформы снимает не больше одной жизни.
- Последовательные BOOST, отдаление камеры, эффекты скорости и комбо.
- Подсветка прочности только ближайшей платформы под шаром.
- Цель из пяти разрушений без потери жизни с разовой наградой 25 монет.
- Именованные испытания через 20–40 секунд игрового времени после обучения,
  богатые дорожки с BOOST и более простой альтернативой.
- Подсказка BOOST после повторных ошибок, причина смерти и кнопка «Ещё раз».
  Повтор использует прежние Babylon, сцену и Havok, сбрасывая забег.
- Рекорды очков, глубины, максимальной скорости и этапа после перезагрузки.
- Отдельные главное меню и пауза, магазин, покупка и применение предметов.
- Независимые музыка, эффекты и вибрация. Вибрация требует поддерживаемого
  устройства и браузера; её физический отклик нужно проверять на телефоне.

Повторить обучение можно кнопкой «Обучающий забег». Сохранения привязаны к
браузеру и адресу сайта: локальный запуск и GitHub Pages имеют разные данные.
Для проверки самого первого запуска без удаления своих рекордов используйте
приватное окно браузера.

Проверки и обновление готовой сборки:

```bash
npm run lint
npm test -- --maxWorkers=2
npm run build
```

`npm run build` обновляет `docs/`; при публикации её следует отправлять вместе
с исходниками. Сгенерированные файлы сборки исключены из проверки ESLint.
