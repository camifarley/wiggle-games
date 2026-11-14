// App entry: Play screen -> camera -> menu <-> games (hash routes: #/ and #/play/<id>)

import { camera } from './core/camera.js';
import { audio } from './core/audio.js';
import { runtime } from './core/runtime.js';
import { view } from './core/view.js';
import { ui } from './core/ui.js';
import { games } from './games/registry.js';

let routeToken = 0;

async function boot() {
  ui.loading('Turning on the camera…');
  try {
    await camera.start();
  } catch (e) {
    console.error(e);
    ui.error('We need the camera to play. Tap to try again, and choose "Allow".', play);
    return;
  }
  view.updateCover();
  addEventListener('hashchange', route);
  route();
}

async function chooseCamera() {
  const cams = await camera.list().catch(() => []);
  ui.cameraPicker(cams, camera.deviceId, async (id) => {
    try { await camera.use(id); } catch (e) { console.error(e); }
    view.updateCover();
  }, () => {});
}

function play() {
  audio.unlock(); // must happen inside the tap
  boot();
}

async function route() {
  const token = ++routeToken;
  const id = location.hash.match(/^#\/play\/(.+)$/)?.[1];
  const entry = games.find((g) => g.id === id);
  if (!entry) {
    runtime.stop();
    ui.menu(games, (g) => { location.hash = `#/play/${g.id}`; }, chooseCamera);
    return;
  }
  ui.loading(`${entry.icon} ${entry.title}`);
  try {
    const mod = await entry.load();
    if (token !== routeToken) return;
    await runtime.start(mod);
    if (token !== routeToken) return runtime.stop();
    ui.backButton(() => { location.hash = '#/'; });
  } catch (e) {
    console.error(e);
    ui.error('Oops, that game had a hiccup.', () => { location.hash = '#/'; });
  }
}

runtime.begin();
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
ui.start(play);
