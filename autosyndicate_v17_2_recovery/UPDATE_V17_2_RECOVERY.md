# AutoSyndicate V17.2 Recovery — PixiJS render / 2.5D drag / layered tuning

## Critical renderer recovery
- Added `src/features/pixi-app.ts` as the single PixiJS lifecycle entry point.
- PixiJS 8.20 renderer chain: WebGL first, Canvas2D second (`preference: ['webgl','canvas']`).
- If autodetect itself throws, a clean second `Application` is initialized explicitly with `preference: 'canvas'`.
- Canvas is appended only after `await app.init(...)`.
- React unmount destroys ticker/renderer/canvas with `app.destroy(true, ...)` and clears the host.
- Removed the old text `WEBGL НЕДОСТУПЕН` race replacement.

Note: `forceCanvas: true` is not a supported PixiJS 8.20 Application option. The renderer preference chain is the current API for WebGL -> Canvas fallback.

## Car visual system
- Replaced the shared class-level BODY_VARIANTS placeholder system with 25 per-model profile definitions.
- Every car id now has independent roof, deck, hood, nose, axle and wheel-radius geometry.
- AMG GT has a pushed-back cabin / long hood profile; VAZ-2106 uses a classic three-box sedan profile; RS6 uses a long wagon roof; 911/R8/R35/supercars/hypercars have separate proportions.
- No gray/default rectangle is used for a missing model in normal ids 1..25.
- Layer order is preserved in Pixi: base body -> finish -> decals -> tint -> wheels -> aero.
- Paint, tint, front/rear wheels, ride height, body kit, spoiler and up to 60 decal sprites are driven from one `CarVisualConfig`.

## Tuning atelier
- Pixi editor uses the shared renderer lifecycle.
- `useRef` host mount + `useEffect` initialization + renderer cleanup on unmount.
- Every React config mutation rebuilds the layered car and explicitly calls `app.render()`.
- Dragging a decal updates the Pixi sprite immediately and commits x/y into React state on release.
- Emergency path is still graphical SVG car output; there is no text or gray-car fallback.

## 2.5D race
- Restored the Pixi race module that was accidentally absent from V17.1 recovery.
- Mandatory canvas race scene inside the existing race cockpit.
- Rival/police occupy upper lanes; player occupies lower lane.
- Racer X-position is based on live distance delta to the player.
- Three parallax speeds implemented with `TilingSprite`: city slow, fence medium, asphalt fast; sky is nearly static.
- Layered/customized car is baked to a single Pixi texture for the race.
- Police racer is visible and has a red/blue light bar.
- Existing DOM HUD remains interactive above the canvas: tachometer, speedometer, throttle, brake, shift +, shift -, N2O.
- If Pixi cannot create either WebGL or Canvas renderer, a graphical native Canvas2D race renderer takes over and still draws the custom car SVGs. It never displays a textual race substitute.

## Shared visual integration
- Late V17.2 runtime override routes garage/shop/profile legacy image requests through `CarVisualConfig` and SVG data URIs.
- Race uses the same local config for the player and remote `car_visuals` when available for a private Race Room.
- Saving atelier config refreshes garage/profile and persists through existing state/profile sync.

## Checks
- `check:v17.2`: 48/48.
- Previous static regression suites: V16 38/38, V15.1 18/18, V15 24/24, V14 14/14.
- TypeScript parser check: all 7 modified TS/TSX runtime modules parse without syntax diagnostics.
- Full `npm install` was attempted but timed out in the execution environment, therefore a real `next build` is not claimed as completed.

## Manual acceptance after deploy
1. Open Garage and verify VAZ / AMG GT / RS6 / Chiron visibly have different body profiles.
2. Open Tuning Atelier and change paint, front/rear wheels, tint and add a decal; preview must update immediately.
3. Drag the decal with a finger, save, reopen — position must persist.
4. Start a duel: canvas must appear, rival above, player below; both cars visible.
5. Hold throttle: road/fence/city move at different speeds and racers shift in X based on distance.
6. Switch gears with +/-, use N2O, verify HUD remains tappable over canvas.
7. Test on a device/webview with WebGL disabled — Canvas2D renderer should still show graphics instead of a WEBGL error text.
