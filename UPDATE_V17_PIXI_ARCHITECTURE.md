# AutoSyndicate V17 — PixiJS 2.5D Drag Engine + Layered Tuning Atelier

## Что изменено

V17 переводит визуал автомобиля на единый конфигурационный пайплайн. Активные игровые экраны больше не обязаны знать, где лежит фотография машины: они получают `CarVisualConfig` и строят один и тот же автомобиль через SVG или PixiJS.

```text
player state / Supabase
        │
        ▼
  CarVisualConfig
        │
        ├──────────────► React <CarVisual/> ─► Garage / Salon / Profile / Duel Room
        │
        ├──────────────► SVG renderer ───────► legacy DOM surfaces / public profile
        │
        ├──────────────► Pixi layered builder ─► Tuning Atelier
        │                         │
        │                         └─ generateTexture() ─► flat race Sprite
        │
        └──────────────► /api/car-visual/:playerId ─► PNG ─► Telegram Inline duel card
```

Главный принцип: **внешний вид хранится как данные, а не как готовая картинка**.

---

## 1. Единая структура данных автомобиля

Файлы:

- `src/features/car-visual/types.ts`
- `src/features/car-visual/catalog.ts`
- `src/features/car-visual/schema.ts`

Канонический формат V17:

```json
{
  "version": 1,
  "carId": 14,
  "paint": {
    "hex": "#FF0000",
    "type": "gloss"
  },
  "tint": {
    "opacity": 0.85,
    "color": "#000000"
  },
  "wheels": {
    "frontId": "bbs_rim_18",
    "rearId": "bbs_rim_18",
    "diameter": 18
  },
  "spoilerId": "gt_wing_v1",
  "bodyKitId": "stock",
  "rideHeight": 8,
  "decals": [
    {
      "id": "stripe_1",
      "assetId": "racing_stripes_white",
      "x": 120,
      "y": 76,
      "scale": 1,
      "rotation": 0,
      "zIndex": 20,
      "tint": "#FFFFFF",
      "opacity": 1
    }
  ]
}
```

`normalizeCarVisualConfig()` также понимает упрощённый формат из ТЗ:

```json
{
  "car_id": 14,
  "paint": { "hex": "#FF0000", "type": "gloss" },
  "tint": { "opacity": 0.85, "color": "#000000" },
  "wheels_id": "bbs_rim_18",
  "spoiler_id": "gt_wing_v1",
  "vinyl_id": "racing_stripes_white"
}
```

Он автоматически преобразуется в канонический формат V17.

Ограничения в Zod:

- не более **60 винилов/наклеек на одну машину**;
- ограниченные координаты, scale, rotation, zIndex, opacity;
- только валидные `#RRGGBB` цвета;
- не более 100 записей машин в одной карте visual-конфигов.

---

## 2. Векторные кузова

Файлы:

- `src/features/car-visual/catalog.ts`
- `public/assets/cars/vector/*.svg`

Добавлено **25 векторных model presets**:

1. VAZ-2106
2. Golf Mk2
3. AE86
4. Silvia S15
5. RX-7 FD
6. Supra MK4
7. Evo IX
8. WRX STI
9. GT-R R34
10. Mustang GT
11. Challenger SRT
12. Camaro SS
13. BMW M4
14. Mercedes-AMG GT
15. Audi RS6
16. Porsche 911 Turbo
17. Porsche 911 GT3 RS
18. Audi R8
19. GT-R R35
20. McLaren 720S
21. Ferrari 488
22. Ferrari SF90
23. Huracan
24. Aventador
25. Bugatti Chiron

Статические `.webp` фотографии больше не входят в активный пользовательский render pipeline и не загружаются preloader'ом. Старые файлы оставлены в проекте только как legacy/admin compatibility, чтобы не ломать существующую базу `image_path`.

### Важное ограничение по геометрии

В архиве находятся **игровые model-specific SVG silhouettes**, а не OEM/CAD-чертежи производителя. Архитектура специально отделяет геометрию модели от покраски/дисков/винилов, поэтому production-вектор с более точным заводским контуром можно заменить для любой модели без изменения state, БД, редактора, гонки или Telegram-интеграции.

---

## 3. Универсальный `<CarVisual />`

Файл:

`src/components/car/CarVisual.tsx`

Использование:

```tsx
<CarVisual config={playerCarVisual} size="sm" />
<CarVisual config={playerCarVisual} size="md" />
<CarVisual config={playerCarVisual} size="lg" />
```

React-компонент нормализует конфиг и строит SVG из тех же данных, которые использует PixiJS.

Интеграция выполнена в:

- гараже;
- автосалоне;
- собственном профиле;
- публичном профиле;
- Duel Room;
- списках/превью, использующих `carArtSVG()` / `carThumb()`.

---

# Модуль A — PixiJS 2.5D Drag Engine

## 4. Архитектура race renderer

Файл:

`src/features/race/pixi/PixiDragRaceEngine.ts`

Renderer и игровая физика разделены.

```text
Race physics / Race Room live progress
              │
              ▼
      PixiRaceSnapshot
              │
              ▼
   PixiDragRaceEngine.update()
              │
       ┌──────┴──────┐
       │             │
   Parallax       Racers
TilingSprites   baked Sprites
```

Это позволяет:

- не связывать FPS WebGL с сетевой частотой Race Room;
- не пересоздавать DOM каждый кадр;
- использовать один renderer для NPC, ДПС и real-time игрока;
- заменить физику без переписывания рендера.

---

## 5. 2.5D side-scroller и полосы

Pixi renderer создаёт отдельные Y-lanes.

Для двух участников:

```text
──────── PLAYER ─────────────────

──────── RIVAL ──────────────────
```

Для трёх и более участников lane positions автоматически распределяются по доступной высоте. X-позиция соперника считается из **реальной разницы дистанций**:

```ts
const relative = rivalDistance - playerDistance;
const rivalX = playerCameraX + relative * pixelsPerMeter;
```

Поэтому машины не «приклеены» друг к другу и не перекрываются.

В online Race Room `rivalDistance` берётся из `privateRemoteProgress.distance`, то есть в Pixi отображается реальный серверный прогресс второго игрока.

---

## 6. Параллакс

Используются `PIXI.TilingSprite`:

- `sky` — почти статичное небо;
- `city` — дальний фон, медленный scroll;
- `fence` — ближнее ограждение, быстрый scroll;
- `road` — самый быстрый слой дорожного полотна.

Скорость скролла привязана к `speedKmh`, а не к декоративному таймеру.

При `reducedMotion` динамический параллакс отключается.

---

## 7. Машина в гонке: Layer → Bake → Sprite

Последовательность:

```text
CarVisualConfig
  ↓
buildPixiCar()
  ↓
Container с Body / Finish / Tint / Wheels / Aero / Decals
  ↓
renderer.generateTexture(...)
  ↓
1 Sprite на участника
```

Гонка не таскает 60 decal-спрайтов каждый кадр. Сложная сборка создаётся один раз перед стартом и запекается в flat texture.

Файл:

`src/features/car-visual/bake.ts`

API:

```ts
bakeCarTexture(renderer, container)
bakeCarPng(renderer, container)
```

`bakeCarPng()` дополнительно может получить PNG data URL через Pixi ExtractSystem.

---

## 8. Ручная КПП

В проекте сохранён рабочий cockpit с:

- стрелочным RPM;
- спидометром;
- газом;
- тормозом;
- `+` передача;
- `−` передача;
- N2O.

Зелёная зона тахометра продолжает давать максимальный shift boost. V17 добавляет явное понижение передачи с защитой от опасного over-rev.

Также добавлен автономный физический core:

`src/features/race/pixi/drag-physics.ts`

Он содержит:

- 6 передач;
- gear ratios;
- speed caps;
- perfect/good/miss shift windows;
- torque curve;
- power-to-weight acceleration;
- aero resistance;
- brake;
- N2O;
- shift boost;
- distance integration.

Активный Mini App в V17 использует уже отлаженную race-физику legacy runtime как authoritative gameplay adapter, а Pixi получает её snapshot. Это сделано намеренно, чтобы не сломать баланс ДПС, online Race Rooms и предыдущий green-zone gameplay одной миграцией.

---

# Модуль B — PixiJS Layered Tuning / Vinyl Editor

## 9. Слои автомобиля

Файл:

`src/features/car-visual/pixi-car.ts`

`buildPixiCar()` создаёт независимые контейнеры:

```text
car root
├── base-body
├── color-finish
├── decals-vinyls
├── window-tint
├── wheels-rims
└── body-kits-spoilers
```

Винилы дополнительно маскируются контуром кузова, поэтому decal при drag не рисуется за пределами листового металла.

---

## 10. Decal manipulation

Каждый винил — отдельный `PIXI.Sprite`.

Поддерживаются:

- `x`;
- `y`;
- `scale`;
- `rotation`;
- `zIndex`;
- `tint`;
- `opacity`.

Touch drag работает непосредственно по машине:

```text
pointerdown
   ↓
globalpointermove
   ↓
pointerup / pointerupoutside
   ↓
commit x/y into CarVisualConfig
```

---

## 11. Тюнинг-Ателье

Файлы:

- `src/components/tuning/PixiCarEditor.tsx`
- `src/components/tuning/TuningAtelierBridge.tsx`

Из гаража добавлена кнопка **ТЮНИНГ-АТЕЛЬЕ**.

Категории:

### Покраска

- цвет;
- gloss;
- matte;
- pearl;
- chameleon.

### Диски

- отдельный выбор передней оси;
- отдельный выбор задней оси;
- 14–22";
- Steel / BBS / TE37 / Deep Dish / Forged.

### Подвеска

Кузов смещается относительно неподвижных ступиц колёс, то есть изменение действительно работает как высота подвески, а не как scale всей машины.

### Тонировка

- 0–95%;
- цвет стекла.

### Аэродинамика

- stock;
- street lip;
- widebody;
- track splitter;
- ducktail;
- GT wing;
- track wing.

### Винилы

- до 60 слоёв;
- Racing Stripes;
- Side Flash;
- Number 77;
- Checker;
- Flame;
- SYNDICATE;
- drag пальцем;
- scale;
- rotation;
- z-order;
- opacity;
- tint;
- удаление отдельного слоя.

Pixi `Application` редактора не пересоздаётся при каждом движении slider. Меняется только car container, что уменьшает мерцание и лишнюю инициализацию WebGL.

---

## 12. State + Supabase

Локальный state:

```ts
state.carVisuals = {
  "1": { ...CarVisualConfig },
  "14": { ...CarVisualConfig }
}
```

`MAX_SAVE_BYTES` увеличен до 1 MiB для decal data.

Синхронизация:

```text
visual-save
   ↓
state.carVisuals
   ↓
saveState()
   ↓
/api/profile/sync
   ↓
player_profiles.car_visuals JSONB
```

SQL:

`supabase/upgrade-v17-car-visuals.sql`

Миграция добавляет:

```sql
player_profiles.car_visuals jsonb not null default '{}'
```

Перед V17 на production миграцию нужно выполнить один раз.

---

## 13. Telegram Inline Mode

Endpoint:

`GET /api/car-visual/[playerId]?carId=14`

Он:

1. проверяет профиль;
2. проверяет, что машина реально принадлежит игроку;
3. читает `car_visuals`;
4. строит актуальную сборку;
5. отдаёт PNG через `ImageResponse`.

Inline duel results теперь используют этот endpoint как `photo_url`, поэтому карточка вызова получает внешний вид машины вызывающего: цвет, диски, тонировку, спойлер и винилы.

---

## 14. Market / передача машин

`vehicleDataSchema` расширен `visualConfig`.

При создании market snapshot внешний вид машины сохраняется вместе с:

- апгрейдами;
- состоянием;
- топливом;
- номером;
- tuning history.

После покупки visual config восстанавливается новому владельцу.

---

# Проверка

## Автоматические проверки V17

```bash
npm run check:v17
```

Проверяются:

- Pixi dependency;
- 25 vector bodies;
- CarVisualConfig;
- max 60 decals;
- layered Pixi builder;
- independent wheels;
- suspension offset;
- decal interaction;
- texture bake;
- 2.5D parallax;
- lane separation;
- live distance integration;
- police visual;
- manual cockpit controls;
- tuning atelier;
- state/profile/database sync;
- Garage/Salon/Profile/Duel Room integration;
- Telegram PNG endpoint;
- Inline photo challenge;
- market visual snapshot;
- removal of raster-car preloading.

На подготовленной версии: **48/48**.

Также повторно проходят предыдущие регрессии:

- V16: **38/38**;
- V15.1: **18/18**;
- V15: **24/24**;
- V14: **14/14**.

Синтаксический parse изменённых TS/TSX: **25/25**.

## Ручная проверка

1. Выполнить SQL V16, если ещё не выполнялся.
2. Выполнить `supabase/upgrade-v17-car-visuals.sql`.
3. Выполнить `npm install` — V17 добавляет `pixi.js@8.20.0`.
4. Запустить Mini App.
5. Гараж → `ТЮНИНГ-АТЕЛЬЕ`.
6. Изменить цвет/диски/тонировку.
7. Добавить несколько vinyl layers и перетащить их пальцем.
8. Сохранить.
9. Перейти в профиль и убедиться, что визуал совпал.
10. Запустить обычную гонку: должен открыться WebGL side-scroller с двумя Y-lanes и parallax.
11. Проверить газ, тормоз, SHIFT +/−, N2O и green-zone.
12. Запустить Race Room с двух аккаунтов и проверить, что автомобиль соперника движется по server live-progress.
13. Отправить inline duel challenge и проверить PNG автомобиля в карточке Telegram.

---

## Production note

Архив намеренно **не содержит `node_modules`**. Полный `next build` в текущем окружении не подтверждён, потому что установка npm-зависимостей не завершилась по сети. Это не скрывается автоматическими `check:*`: они являются статическими/regression checks, а не заменой production build и E2E с Telegram + Supabase.
