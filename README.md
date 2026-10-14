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
