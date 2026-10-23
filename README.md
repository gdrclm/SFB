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
Earn one **BOOST** with six consecutive platform breaks, then press the button
for +50% fall speed. Its ring and counter show charge progress. Coins and waiting
do not refill it. An error resets an unfinished charge; a full charge is banked
until used. Only one charge can be held, with no saved overflow hits.

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
and button reaction, a short air impulse, and speed-dependent movement
streaks. Zoom starts 180 ms after BOOST so the initial acceleration reads first. Reduced-motion preferences disable streaks and button pulses.

The first run uses the staged contextual opening described below. A reference
guide remains available through **Как играть** in pause. Tutorial
platform illustrations use the same sprite atlas as the game; hearts,
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
pause stops progression), with ten increasingly demanding stages. The play HUD shows one speed value, hearts, coins, depth and a small progress
track; score and hit accounting live in results. A chain of 3/6/10/15 successful
platform breaks raises the hit multiplier to ×2/×3/×4/×5. A damaging bounce
resets the chain, preserving already earned points. Dodging and pauses do not
break it. Speed 20/35/55 adds ×1.25/×1.5/×2; breaking a platform whose strength
is at least 85% of current speed adds ×1.5. Each hit awards the floor of
25 × chain multiplier × speed multiplier × risk multiplier. Only the bonus
over the existing 25 base points is added to the run total. Best chain and
combo bonus persist with results; older records retain their original scores.
Combo points do not multiply spendable coins.

Only the nearest obstacle in the current horizontal lane gets a readiness cue:
turquoise contour and the surface cracks for a break now; amber ϟ only when a
currently available BOOST suffices. Distant surfaces that still need speed stay
neutral. Red ! appears only within 0.7 real seconds of an unsafe impact.
Assessment is limited to a 1.6-second approach window. Energy, cooldown and gameplay state use the actual boost
controller. The platform and BOOST glow share the same pulse when boost is useful.
Other lanes are not ranked. Straddling two platforms in one row conservatively
warns about the stronger obstacle. Base materials and silhouettes remain intact.

Numeric strength is optional via **Настройки → Числа прочности** in pause and persists between
sessions. The integer threshold remains shared by the actual physics and the
optional numeric badges. Players do not need numbers for the default cues.

## Contextual first-run opening

The first run now starts gameplay immediately. Random platform and coin
production is disabled during the first 30 active simulation seconds. A simple
platform appears first, then practice at seconds 2/5/7/9/11 and the first
coin at second 4. The boost gate appears at second 16, only when BOOST has
actually been earned and is available. Otherwise practice continues and the
remaining sequence waits. A two-lane fork follows seven simulation seconds
after the gate. Familiar platforms at seconds 26/28 complete the lesson. Positions are placed ahead of the current ball,
so boosting does not reveal the whole lesson at once. The fork offers a safe
ordinary platform and a strong dark platform, without a free central corridor.
Only three short arrows appear: «Веди пальцем», «Собирай», «Ускорься!».
They point at the ball, first world coin and BOOST. Gameplay keeps running;
there is no modal, Continue action or reading stop. Dragging, collecting the
coin and successfully boosting dismiss the matching hint. Ignored hints time
out. The fork uses the actual platform cues; lives animate on loss and combo
shows its multiplier, without extra teaching text. Full rules remain in pause.

Slow platforms are suppressed until the first successful BOOST. Once introduced,
a ready BOOST can exit manual or forced slow mode and immediately accelerate;
rejected attempts do not cancel slow mode or consume energy.

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
including media added later. Synthesized event audio follows Effects independently
of Music and Vibration; no music files are added.

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
  короткие стрелки без остановок на чтение. Пауза останавливает симуляцию.
- Жизни: одна активация платформы снимает не больше одной жизни.
- Последовательные BOOST, отдаление камеры, эффекты скорости и комбо.
- Подсветка прочности только ближайшей платформы под шаром.
- Цепочка заданий: разрушения без потери жизни, монеты, BOOST, платформы и
  комбо. Каждое выполнение даёт 10 монет и сразу открывает следующую цель.
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

## Compact tutorial, shop and combo feedback

Contextual first-run hints are short arrows dismissed by actual actions. The pause reference uses short pages; navigation stays
in one row. The store uses compact rows with a small preview, ownership/level,
price and action. Upgrade effects stay visible; cosmetic descriptions are
available as tooltips. All categories and reference pages were checked without
vertical scrolling at 320×568, 390×844 and 844×390.

Combo is a brief count/multiplier badge near the top, without progress bars,
risk arithmetic or bonus text. It appears only on a hit for 0.75 active real seconds (1.1 on a new multiplier),
freezes in pause and hides on error/reset. The stage challenge has no text banner. The technical hit journal is not visible.

## Selected missions and repeatable rewards

Mission progress briefly appears for 1.2
active seconds, then collapses; in the opening lesson only the reward is shown. Completion
credits 10 shop coins, marks the goal complete and clears its selection in a single transaction.
A gold flash and +10 ★ last two active real seconds. Choose another objective
from the main-menu list; only the selected goal appears in pause and advances. Each set offers clean breaks, coins,
successful BOOST uses, platform breaks and combo, with bounded target increases
on subsequent cycles. Only actions after activation count toward a new mission.

Progress persists between runs and reloads. Life loss and a new run reset clean
break/combo progress; cumulative coin, BOOST and platform goals retain theirs.
Rejected BOOST attempts do not count. Mission rewards are separate from collected
run coins, so finishing or replaying a run cannot credit them twice. Legacy users
who already earned the original first-success reward continue at mission two,
keeping their old balance and purchases without another first-goal payout.


## Arcade feedback and a repeat playtest

BOOST has a short squash/stretch, widening trail, air sweep sound, speed lines,
ring impulse and delayed camera zoom. Breaks have a 30–50 ms contact stop, four
large fragments, short camera kick, ring/sparks and a synthesized low/crunch hit.
Coins flash, arc to the counter and play ascending bounded notes in a chain.
Errors have red feedback and a dull hit; healing has a green heart pulse and
its own chime. Audio starts only after a trusted gesture, follows Effects,
stops on pause/blur/hidden pages, and degrades silently without Web Audio.
Transient effects are bounded and cleaned between runs. Reduced-motion mode
avoids decorative travel/streaks and hit stop.

Для живого плейтеста без пояснений:

1. Открыть игру в приватном окне на телефоне и нажать «Начать забег».
2. Не объяснять управление и не подсказывать первые 30 секунд.
3. Записать время первого движения, монеты и успешного BOOST; отметить ошибки
   чтения бирюзового контура / янтарной ϟ / нейтральной поверхности / красного ! и касания неготовой кнопки.
4. Спросить, что было приятно и что мешало, без перечисления механик заранее.

Автоматические проверки подтверждают ввод, состояния, эффекты и сохранения.
Понимание новым человеком и удовольствие от игры нужно оценивать живым плейтестом.

### Итоги и рекорды

Экран завершения выделяет очки и новый личный рекорд, четыре компактных
показателя и немедленный повтор. Причина поражения видна одной строкой;
расчёт столкновения раскрывается отдельно. Кнопка «Рекорды» в главном меню,
паузе и итогах открывает общий экран: лучшие глубина, скорость и этап,
призовые места и десять лучших забегов. Данные по-прежнему локальны;
прерванные забеги сохраняются и участвуют в рейтинге.

### Поле решений и ощущения

Камера ставит шар примерно на 38% свободной области между сердцами и
нижними кнопками. Эта гипотеза настраивается при изменении размера экрана;
снизу остаётся больше места для развилок. Энергия BOOST и замедления — общая
шкала между кнопками с точным остатком. Заполнение относительно максимального
запаса за текущий забег, без ограничения накопления энергии. Цена BOOST видна
при росте стоимости или малом остатке; при обычной цене 1 и достаточном запасе
она скрыта. Число скорости меняет оттенок без дополнительных подписей.

BOOST сначала читается движением и следом, затем через 180 мс камера расширяет
обзор; дополнительный импульс масштаба возвращается за 850 мс. Разрушение
занимает 380 мс, дальность крупных фрагментов и короткий толчок камеры зависят
от соотношения скорости и прочности. Повторные удары не накапливают смещение
камеры. Монета летит к счётчику за 320 мс. Декоративные конфетти убраны из фона,
чтобы не конкурировать с монетами и обломками.

Обязательный следующий шаг для оценки ощущений — живой телефонный тест:
несколько последовательных BOOST, 5–10 ударов, монетная цепочка, ошибка и
восстановление жизни. Оценить различимость событий со звуком и без, вибрацию,
обзор ближайшей развилки и понимание сигналов без сравнения чисел. Эмуляция
размеров экрана не заменяет проверку физического телефона.

### Компактная пауза и локации по расстоянию

Пауза показывает только глубину и монеты одной строкой, затем «Продолжить»,
«Заново» и «В главное меню». Настройки, справка и рекорды доступны отдельными
кнопками. Музыка, эффекты, вибрация, интерфейс и числа прочности находятся
в отдельном окне настроек. Закрытие этого окна, рекордов или справки
не возобновляет забег. Старые три фиксированные миссии и статистический
журнал из паузы убраны; награждаемая цепочка целей продолжает работать.

Окружение меняется через каждые 500 м максимальной глубины: небо → кристальные
пещеры → лавовые глубины → неоновая бездна, затем цикл повторяется. Шаг задан
в `src/scene/DepthLocations.ts`. Смена зависит от расстояния, а не от времени
или этапа; отскок не возвращает прежнюю локацию. Переход занимает 2 секунды
активного реального времени, с остановкой в паузе. При уменьшении движения
в настройках ОС фон сменяется сразу. Поля платформ и физика сохраняются.

Фоны различаются палитрой и силуэтами; окружение вписывается в обе оси
экрана, в том числе при высокой скорости. Скин мира задаёт начальное небо и оттенок следующих локаций;
купленные фонарики сохраняются в новых локациях. Во время перехода существуют
не более двух фоновых плоскостей; старые материалы и текстуры освобождаются.
Перезапуск начинает новый цикл, сохраняя Babylon/Havok.

### Неоновое комбо и след скорости

Каждый успешный удар заново запускает короткое увеличение цифр и расходящийся
неоновый ореол комбо. Новый множитель даёт более сильную вспышку; оттенок
свечения зависит от уровня серии. В паузе анимации останавливаются; при
уменьшении движения в ОС остаётся статичная подсветка без вспышки.

След использует 18 сегментов вместо 12, усиливается по ширине и плотности
на каждом удвоении скорости от 10 до 320 и дополнительно реагирует на BOOST.
На высокой скорости визуальная сила ограничена, чтобы след не закрывал
препятствия; при сбросе скорости след плавно возвращается к тонкому.

### Графический UI по референсу

HUD использует компактные глянцевые синие панели с бирюзовой окантовкой,
SVG-монету со звездой и графические сердца. Пустой кошелёк показывает серебряную
монету; получение монеты кратко подсвечивает счётчик золотом. BOOST выделяет
панель скорости; её красное состояние означает реальную опасность ближайшего
столкновения, а не просто большую скорость. Сердце при потере становится
тёмным и треснувшим, восстановление выделяется зелёным свечением и плюсом.

Комбо снова отображается только неоновыми цифрами и множителем со вспышкой,
без фоновой панели, шкалы и звезды. Всплывающая цель имеет три графических состояния прогресса
(начало, половина, завершение), награда подсвечивается золотом. Эти элементы
сохраняют прежние короткие сроки показа. Постоянные текстовые описания
состояний из листа референса в игровой интерфейс не добавляются.

### Главное меню, настройки и рекорды

Все три экрана используют общий глянцевый синий фон, бирюзовый светящийся
контур, объёмные кнопки и золотые акценты наград. Главное меню показывает
баланс и компактные действия; настройки открываются в общем отдельном окне
как из меню, так и из паузы. Переключатель игрового HUD доступен во время
забега. В рекордах сохранены компактные показатели, призовые медали и топ-10.
В альбомной ориентации главное меню и настройки используют две колонки.

### Иллюстрация второй локации

На 500–999 м в каждом цикле используется тёмный неоновый каньон по референсу:
парящие скалы, сине-фиолетовые облака и свободный тёмный центр. Ассет
`src/assets/worlds/neon-crystal.webp` занимает около 141 КБ, предварительно
загружается и вписывается с сохранением пропорций. Переход ждёт готовности
текстуры; при ошибке загрузки остаётся тёмный запасной фон. Остальные локации,
плавная смена и освобождение ресурсов сохраняются. Оттенок скина мира
и купленные фонарики применяются и ко второй локации.

### Иллюстрация первой локации

Первая локация использует `src/assets/worlds/sky-islands.webp`: голубое небо,
белые облака и зелёные парящие острова по краям, со свободным центром для шара
и платформ. Иллюстрация сохраняет пропорции при смене ориентации экрана.
Общий загрузчик иллюстрированных фонов сохраняет оттенки купленных скинов
и фонарики, а при ошибке загрузки оставляет голубой запасной фон.
Переход в кристальную локацию по-прежнему происходит на глубине 500 м;
повторный забег начинается с небесной локации без пересоздания движка.

### Выбор задания в отдельном окне

Кнопка «Задания» в главном меню открывает отдельное окно в стиле настроек.
Список из пяти заданий показывает прогресс и награду (+10 монет). Выделено
только одно выбранное задание; в паузе закрепляется оно же. Прогресс остальных
заданий не растёт. После выполнения награда и отметка сохраняются атомарно,
выделение снимается, а блок задания исчезает из паузы. Следующее задание игрок
выбирает в окне заданий; частичный прогресс сохраняется при смене выбора.
Выполненные задания остаются в списке без выделения и недоступны для повторной
награды. После пяти выполнений доступен следующий набор. Старый последовательный
прогресс переносится при загрузке профиля. Во время падения остаются только
короткие уведомления о прогрессе и награде. Плавная смена фонов длится 2 секунды
активного игрового времени (при уменьшении движения — мгновенно).

### Спрайтовые платформы и обломки

`src/assets/platforms/neon-rocks.webp` — прозрачный атлас из предоставленного
набора, подготовленный без подписей и фоновых плашек. Основная поверхность,
двенадцатикадровое idle-движение, лечебные знаки, кольца замедления и крупные обломки
используют растровую графику атласа. В обучении показаны те же изображения.
Старая процедурная каменная текстура и объёмные коробки-обломки убраны.

У каждой платформы отдельный невидимый коллайдер прежних размеров и дочерний
спрайт. Края модулей сохраняются, середина повторяется по ширине дорожки;
анимация меняет UV-координаты без перезагрузки изображений или загрузки canvas
в GPU. Платформы делят одну idle-текстуру и материал; обломки используют отдельный
общий атлас. Оба загружаются до старта забега.
Ближайшая обычная платформа становится янтарной только при достаточном
доступном BOOST, красной — перед непробиваемым столкновением. Зелёные и голубые
платформы сохраняют знаки типа и отдельный символ предупреждения. Цвет не меняет
правила урона: красный сигнал не означает новую мгновенную смерть.
Пауза останавливает анимации. Уменьшение движения снижает частоту смены FX до 6 кадров/с, сохраняя искры, пламя и кольца.

Перед стартом забега атлас должен загрузиться: ошибка оставляет игрока
в главном меню с возможностью повторить запуск, без невидимых препятствий.

### BOOST за серию и рост давления

В начале каждого забега BOOST пуст. Шесть пробитий без ошибки дают один заряд;
использование тратит заряд и прежнюю энергию. Ошибка обнуляет только частичное
накопление. Заработанный заряд сохраняется до использования, максимум — один.
Пробития при полном заряде не запасаются на следующий. Перезарядка по времени
не заменяет новую серию. Оценка ближайшей платформы учитывает и этот заряд.

Магазин предлагает «Заряд BOOST»: два уровня за 100 и 200 игровых монет,
снижающие требование до 5 и 4 пробитий. Улучшение применяется в следующем забеге,
не выдаёт бесплатного заряда и не отменяет сброс ошибки. После первых трёх
испытаний интервалы уменьшаются с 20–40 до 20–30 секунд, после шести — до
20–25 секунд игрового времени. Предсказуемые цвета платформ и безопасная
альтернатива в генераторе сохраняются. Реальные платежи не подключены;
текущий магазин использует внутриигровые монеты.

### Idle платформ: 12 кадров

`src/assets/platforms/neon-idle-12.webp` содержит пять рядов по 12 кадров,
подготовленных по новому референсу: искры обычных платформ, оранжевый жар,
красное пламя, лечебные плюсы и голубые кольца. Один цикл занимает секунду
реального времени (12 кадров/с), независимо от SLOW и пауз при ударе. Фазы
платформ различаются, поэтому весь ряд не мигает одновременно. Пауза и скрытая
вкладка сохраняют текущий кадр. При уменьшении движения цикл занимает две секунды
(6 кадров/с), эффекты не отключаются полностью. Мягкие края FX рисуются с
альфа-смешиванием без отсечения слабого свечения. Физика остаётся прежней.

Между соседними кадрами атласа GPU смешивает изображения на каждом кадре
отрисовки, в том числе на стыке 12 → 1. Темп остаётся прежним: 12 ключевых
кадров за секунду, без ускорения цикла. Прозрачные FX смешиваются с учётом
альфы, чтобы не появлялись тёмные ореолы. Дополнительные меши, материалы
или текстуры для перехода не создаются. Поддерживаются WebGL и WebGPU.

Во время idle меняются UV в существующем буфере и коэффициент смешивания. Геометрия создаётся
при активации или смене ширины, её вершины и верхняя грань коллайдера не
двигаются от кадра к кадру. Убрано прежнее переключение трёх собранных
изображений и мигание прозрачности всей платформы при приближении.

## Музыкальный эскиз Freefall

[Послушать 30-секундный эскиз](https://gdrclm.github.io/SFB/music-demo/) · [Замысел, аккорды и повторный рендер](music/freefall/CONCEPT.md).

MP3, OGG и MIDI находятся в `public/music-demo/`. Трек зациклен в меню и забеге, запускается после первого действия игрока и управляется отдельным переключателем «Музыка». При скрытии вкладки воспроизведение приостанавливается.

### Сброс данных

В настройках есть «Сбросить данные» с отдельным подтверждением. Сбрасываются рекорды, монеты, покупки, экипировка, улучшения, задания, обучение и настройки SFB. Текущий забег завершается перед очисткой, затем страница перезагружается, чтобы очистить профиль в памяти. Ключи других приложений на том же origin сохраняются.

### Платформы кристальной локации

При входе в кристальную локацию платформы и обломки получают неоновую цветокоррекцию: более светлые фиолетовые грани и усиленный контур. Янтарный BOOST, красная опасность, зелёное лечение и голубое замедление сохраняют различимость. Цветокоррекция использует тот же двухсекундный переход и готовность текстуры, что и фон; при выходе из локации плавно возвращается исходный вид. Смешивание idle-кадров, физика и общие атласы сохраняются.

### Разрушение платформ: 12 кадров

`neon-destroy-12.webp` — отдельный прозрачный атлас пяти типов, подготовленный по референсу разрушения. После пробития коллизия отключается сразу, а платформа проигрывает 12 кадров раскола, разлёта осколков и затухания за 0,48 с. Соседние кадры смешиваются тем же GPU-переходом, что и idle; последний кадр исчезает без зацикливания. Цветокоррекция кристальной локации применяется и к разрушению.

Эффект использует существующий спрайт и общий материал: дополнительные меши обломков на каждый удар не создаются. Платформа возвращается в пул только после завершения эффекта; при следующем появлении восстанавливаются idle-материал, геометрия и видимость. Оба анимационных атласа загружаются до начала забега.

### Объёмный мультяшный персонаж

Шар использует сферическую 3D-геометрию с toon-шейдингом по нормалям: три светотеневые зоны, блик сверху слева и холодный свет по краю. Глаза, зрачки, блики, брови и рот — объёмные меши. При боковом движении персонаж плавно наклоняется и переводит взгляд.

`BallVisualController` управляет сжатием, растяжением, возвратом формы, скоростным следом и геометрическими FX реакции. Масштабы X/Z компенсируют масштаб Y; радиус sweep-коллизии и управление не меняются. Старые эффекты ударов больше не перезаписывают масштаб персонажа поверх этого контроллера.

Мимика связана с BOOST, разрушением, монетами, лечением, SLOW, опасностью, потерей жизни и завершением забега. Важные реакции имеют приоритет над монетами; временные эмоции возвращаются к спокойному или сосредоточенному выражению. Лицо и FX используют заранее созданные ресурсы, новые меши на каждое событие не создаются.

### Персонаж по референсу

Жемчужно-белый корпус получил цельную синюю нижнюю часть с волнистым швом, голубой контур и верхнюю синюю кнопку. Синяя панель рассчитывается в локальных координатах сферы и поворачивается вместе с 3D-моделью. Глаза стали узкими овальными; обычное лицо не показывает напряжённые брови. Монета включает звёздочки в глазах и открытую улыбку, рост комбо — радостную мимику, опасность — испуг, SLOW — спокойные закрытые глаза.

BOOST разделён на видимое сжатие перед рывком и вытягивание при разгоне. Боковое управление сильнее наклоняет персонажа. Объём сохраняется не только в целевых позах, но и на каждом промежуточном шаге деформации. Радиус коллизий остаётся прежним.

### Объёмные FX вокруг персонажа

`BallDynamicsFX` создаёт светящиеся ленты с мягкими прозрачными краями: дуги поворота и подготовки BOOST, сужающуюся струю рывка, тонкие линии падения и орбиту SLOW с вращающимися точками. Опасность добавляет капли испуга; награды и комбо — четырёхлучевые звёзды; контакт — короткую вспышку и объёмные осколки. Замедление сохраняет орбиту на всё время действия способности.

FX находятся в отдельной системе координат: не сплющиваются вместе с телом, звёзды награды следуют за персонажем, осколки разлетаются от точки контакта. Первое состояние выставляется прямо при событии, поэтому hit-stop не показывает частицы в начале координат. Два пула по 12 звёзд/осколков, ленты, точки и капли создаются один раз и освобождаются при завершении забега. В паузе FX замирают. При уменьшении движения отключаются быстрые линии и вращение, уменьшается количество и разлёт частиц.

Растяжение нарастает с задержкой: при скорости 20/40/80/160/320 корпус вытягивается примерно в 1,02/1,12/1,33/1,69/2,2 раза с сохранением объёма. Ранний BOOST даёт короткую умеренную деформацию. Три объёмные ленты формируют струю возле шара, ещё 12 — локальный поток. Отдельные экранные полосы по обоим краям передают ветер независимо от масштаба камеры: с ростом скорости увеличиваются количество, длина, ширина и яркость. Центр с ближайшей развилкой остаётся свободным. Полосы замирают на паузе и отключаются при уменьшении движения.

`BallCometFX` рисует новый след одним аддитивным шейдером: пять острых лучей с белыми сердцевинами, голубыми оболочками и мягкой синей аурой у шара. Геометрия привязана к персонажу, учитывает его наклон и текущую деформацию; высота и интенсивность растут со скоростью, BOOST кратковременно усиливает струю. Границы ауры плавно затухают по всем сторонам. Отдельный экранный ветер получил светящиеся узлы на полосах. Эффект не требует полноэкранного bloom, текстур или выделения новых частиц каждый кадр; SLOW и уменьшение движения подавляют струю.

### Производительность на телефонах

`AdaptiveQuality` ограничивает размер framebuffer: High — до 1,5 млн пикселей и DPR 1,5; Medium — до 0,9 млн и DPR 1,15; Low — до 0,5 млн и DPR 0,85. Небольшой объём памяти/малое число ядер выбирают более лёгкий старт. Устойчивые медленные кадры понижают качество; 20 секунд стабильной работы возвращают одну ступень. Одиночные задержки, загрузка и фоновые вкладки не считаются просадкой. Разрешение меняется без пересоздания сцены и физики.

Основной неоновый след и сигналы платформ сохраняются. В Low меньше вторичных частиц, линий и орбитальных точек; убраны дополнительные CSS-фильтры. HUD обновляется до 15 раз в секунду, подписи/обучающие стрелки — до 30, физика сохраняет прежний шаг, позиция от указателя обновляется сразу. Неизменившаяся валюта кешируется; содержимое паузы строится при её открытии, а статичная сцена под ней рисуется реже. Скрытая вкладка прекращает отрисовку, возврат сбрасывает отсчёт кадра. Перезапуски проверяются на постоянство количества ресурсов.

В Chromium с экраном 390×844, DPR 3 и эмуляцией 2 ГБ/4 ядер: framebuffer уменьшился с 1170×2532 до 331×717 (примерно на 92% меньше пикселей); повторные DOM-изменения панели паузы исчезли. Это проверка в эмуляции, а не замер FPS на физическом телефоне. Свободную память устройства браузер напрямую не сообщает: адаптация к текущей нагрузке использует время кадров.

### Контакт, пробитие и отскок

Контакт меняет настоящую траекторию управляемого шара: успешный удар фиксирует центр над поверхностью, удерживает его на 25–60 мс в зависимости от сопротивления и восстанавливает движение вниз за 120 мс. Текущая потеря скорости за пробитие сохраняется. Неудачный удар даёт зависящий от входящей скорости импульс вверх, затем ускорение вниз; в конце восстановления вертикальная скорость совпадает с обычным падением. Дуга рассчитывается аналитически и не требует новых физических тел или частиц. Горизонтальное управление остаётся доступным.

Сжатие включается прямо в кадре контакта, опирается на нижнюю точку шара и сохраняет объём; в полёте шар вытягивается по фазе импульса. Камера отстаёт при отскоке и сохраняет масштаб, чтобы подъём был виден относительно платформ. Струя падения при подъёме отключена. Платформа упруго прогибается и затухает; её коллайдер остаётся стабильным. Повторный удар о ту же активацию целой платформы снова отбрасывает шар, не списывая ещё одну жизнь.

### Сетевой режим

Добавлены имя и анонимный ID игрока, рейтинговое демо на 120 секунд с равными характеристиками, общий TOP 20 и очередь отправки при потере сети. Поддержаны временный Node.js/SQLite API и Supabase через единый клиентский интерфейс. Без подключённого API свободная игра и локальные рекорды работают как прежде; общий рейтинг явно показывает отсутствие подключения.

Запуск сервера, публикация временного API, конфигурация Pages и миграция Supabase: [documentation/ONLINE.md](documentation/ONLINE.md).

### Улучшения и слот способности

В магазине «Инерционный корпус» стоит 150/300/450 монет и сохраняет 25/50/75% скорости сверх стартовой после неудачного удара; потеря жизни и отскок сохраняются. «Сканер опасностей» за 250 монет подсвечивает непробиваемые сейчас поверхности в пределах 3 м.

В категории «Способности» покупается и выбирается ровно одна способность для кнопки слева внизу вместо замедления. BOOST справа не меняется. Базовое замедление бесплатно. Аннигиляция за 1500 монет даёт 4 заряда на забег: короткое нажатие тратит один, очищает текущий экран и притягивает видимые монеты с немедленной прибавкой скорости. Удержание 2 секунды при наличии всех четырёх зарядов тратит их на сферу радиусом 200 м; зона учитывает подгружаемые объекты без создания огромной сцены. После мини-взрыва доступны оставшиеся мини-активации. Отмена жеста, пауза и уход со страницы не тратят заряд. Плазменный разгон за 2500 монет даёт ускорение до минимум 180 ед/с и неуязвимость на 30 активных секунд, с вращающейся сферой и орбитами. Плазма доступна один раз за забег; аннигиляция — один полный или четыре мини-взрыва. Повторная покупка не требуется. Пауза останавливает таймер, новый забег восстанавливает активацию. В рейтинговом демо покупки не дают преимуществ: используется базовое замедление, пассивные улучшения отключены.


### Переход локаций и прямое управление

Локации выталкивают друг друга вверх за 2 активные секунды. Системное уменьшение движения больше не отменяет этот переход, а только ослабляет параллакс. Пауза останавливает сдвиг; один длинный кадр после возврата во вкладку не завершает всю анимацию сразу.

На сенсорном экране новый свайп начинается от текущей позиции шара, независимо от точки касания. Движение относительное, без скачка к пальцу, дрейфа после отпускания и мёртвой зоны после разворота у края. Мышь работает при наведении без удержания кнопки: положение обновляется прямо при вводе, без ускорения и сглаживания, и пересчитывается с учётом камеры. При высокой частоте отрисовки позиция обновляется и между физическими тиками; исходная точка swept-коллизии сохраняется. Кнопки способностей и BOOST остаются отдельными элементами управления.

В настройках доступен «Режим разработчика»: он открывает поле стартовой глубины в главном меню (0–1 000 000 м). Шар, платформы и монеты стартуют вместе на выбранной глубине; фон сразу соответствует локации. Для проверки переходов можно выбрать 490, 1490 или 3990 м. Повтор сохраняет стартовую глубину. В тестовых забегах отключены обучение, общий рейтинг, сохранение рекордов, монет и прогресса заданий. Отключение режима возвращает обычный старт с 0 м.

Управление на ПК: BOOST — правая кнопка мыши; выбранная способность — пробел. Для аннигиляции короткий пробел расходует один заряд, удержание 2 секунды запускает полный взрыв за четыре заряда. На паузе и в окнах меню эти команды не действуют. Боковой параллакс зависит от камеры, а не положения шара; анимация платформ использует плавную фильтрацию кадров без изменения скорости цикла и переход цвета за 0,18 с.

В режиме разработчика магазин использует отдельный временный инвентарь с нулевым балансом: платные предметы становятся бесплатными, покупка выбирает косметический предмет, повторный клик кнопки отменяет её. Способности покупаются отдельно: выбор одной для левого слота в забеге выполняется кликом по её карточке. В режиме разработчика повторный клик по выбранной карточке отменяет покупку и возвращает замедление. Улучшения включаются на максимальном уровне и отключаются повторным кликом. Настоящие покупки, выбранное снаряжение, монеты и задания не перезаписываются. Выключение режима возвращает настоящий профиль; новое включение и обновление страницы очищают тестовый набор. Переключать режим можно в главном меню.

При потере жизни камера получает сильный затухающий удар; на последнем сердце включаются тёмная виньетка и красный градиент сверху. При нуле жизней физика и управление останавливаются: шар показывает глаза-крестики и высунутый язык две видимые секунды, после чего появляются результаты. Восстановление жизни, повтор и выход очищают соответствующие эффекты; reduced motion отключает сильную тряску.

Быстрый запуск: рендерер, Havok и общие атласы подготавливаются в фоне главного меню и используются повторно после перезапуска и выхода в меню. Забег пересоздаёт только своё состояние и объекты; выбор магазина и стартовой глубины применяется заново. Монеты используют общие материалы, одну текстуру и две геометрии на весь пул. Изображения локаций сохраняют один GPU-ресурс на файл; неактивные платформы получают физическое тело только при появлении. При закрытии страницы или ошибке подготовки общая сцена освобождается. Проверки охватывают повторные запуски, отсутствие накопления тел/ресурсов и восстановление после ошибки.

Боковой поток скорости работает на мобильных устройствах и ПК: по мере разгона одновременно растут число, длина, толщина, яркость и скорость лучей; BOOST даёт короткий отдельный всплеск. Лучи рисуются отдельным Canvas 2D поверх WebGL, без CSS-масок и анимированных фильтров: один заранее подготовленный световой спрайт, до 24 лучей, разрешение FX не выше 1000 пикселей по высоте независимо от DPR телефона. Средние 70% экрана остаются свободными. Отрисовка использует существующий игровой цикл, останавливается на паузе; слой удаляется при выходе. При уменьшенной анимации остаётся статичный индикатор скорости по краям.

Шлейф непосредственно за шаром: пять заострённых бело-голубых струй с синим ореолом, привязанных к персонажу. Короткий шлейф виден уже при обычном падении; разгон увеличивает длину и яркость, BOOST даёт дополнительный всплеск. Отдаление камеры компенсируется удлинением струй без увеличения ореола у шара. Низкое качество сохраняет этот эффект; reduced motion оставляет укороченный шлейф без пульсации. При замедлении и отскоке струи отключаются.

След траектории сохраняется отдельно от струй: он заметен с начальной скорости, окрашен в светлый голубой и рисуется с обеих сторон при поворотах. Стартовые струи укорочены и приглушены; их интенсивность нарастает постепенно, а BOOST сохраняет краткий яркий импульс.

За шлейфом остаются голубые искры: пул из 24 частиц хранит их мировые координаты, поэтому они не прилипают к шару после поворота и плавно исчезают. На низком качестве снижается частота появления. Четыре маленькие синие конечности двигаются чаще с разгоном; при ударе поджимаются под шар и затем раскрываются, при смерти остаются поджатыми. В небесной локации птицы медленно летят слева направо: их высота задана в координатах экрана и не зависит от падения, параллакса или отдаления камеры. Пауза останавливает полёт; при переходе в кристальную локацию птицы плавно исчезают и освобождают ресурсы.


Птицы — дальние голубовато-серые силуэты без мелких деталей и бликов. Воздушная перспектива различает планы размером, оттенком и прозрачностью. Крылья делают быстрый взмах вниз, медленно возвращаются и ненадолго переходят в планирование; фазы у птиц разные. Высота полёта постоянна, параллакс сцены на неё не влияет. При reduced motion взмахи замедляются и смягчаются, но не отключаются.

### Ширина поля и характер зон

Доступная ширина движения следует за ортографической камерой: широкий экран ПК и отдаление на телефоне открывают игровое пространство по бокам. Размеры платформ и расстояния между ними не зависят от камеры. По бокам добавляются новые дорожки, повторяющие исходный рисунок текущей зоны: безопасные и опасные платформы, ловушки и монетные цепочки. Существующие платформы не перемещаются и не растягиваются; разрушенные не появляются повторно при отдалении камеры. Границы мыши и относительных свайпов обновляются вместе с камерой. Пул растёт по необходимости, не более четырёх объектов за такт и до 144 платформ; новые объекты сразу включаются в физические столкновения и подписи. Повтор и выход освобождают объекты забега, сохраняя общий рендерер.

Характер ближайшего испытания обозначается по краям экрана и коротким звуковым сигналом: янтарные опасные полосы для ловушек, красные для узкого опасного коридора, золотые искры для монетной дорожки, голубые осколки для «Каскада». «Каскад» — последовательность пробиваемых платформ для серии ударов и комбо. Сигнал привязан к фактически приближающимся рядам; он не отмечает правильную дорожку и не заменяет текущую оценку пробиваемости. На паузе и после забега эффекты зон скрываются, переключатель звуковых эффектов управляет и звуком входа в зону.


Во второй, неоновой кристальной локации герой светится изнутри голубым светом, получает яркий бирюзовый контур и мягкий голубовато-фиолетовый ореол. Синие детали тоже подсвечены, лицо остаётся тёмным и читаемым. Интенсивность следует двухсекундному переходу фона и затухает при выходе из локации. Ореол — один дополнительный полупрозрачный объект без текстур и полноэкранного bloom; материалы и геометрия переиспользуются до конца забега и освобождаются при выходе.
