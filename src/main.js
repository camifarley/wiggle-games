// App entry: Play screen -> camera -> menu <-> games (hash routes: #/ and #/play/<id>)

import { camera } from './core/camera.js';
import { audio } from './core/audio.js';
import { music } from './core/music.js';
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

// Routes: #/  menu | #/play/<game>  (release picker if several) | #/play/<game>@<version>
async function route() {
  const token = ++routeToken;
  const [, id, ver] = location.hash.match(/^#\/play\/([^@]+)(?:@(.+))?$/) || [];
  const entry = games.find((g) => g.id === id);
  if (!entry) {
    runtime.stop();
    music.forScreen('menu');
    ui.menu(games, (g) => { location.hash = `#/play/${g.id}`; }, chooseCamera);
    return;
  }
  const release = ver ? entry.releases.find((r) => r.version === ver) : entry.releases.length === 1 ? entry.latest : null;
  if (!release) {
    runtime.stop();
    music.forScreen('menu');
    ui.releasePicker(entry, (r) => { location.hash = `#/play/${entry.id}@${r.version}`; }, () => { location.hash = '#/'; });
    return;
  }
  ui.loading(entry.title, release.shot);
  try {
    const mod = await release.load();
    if (token !== routeToken) return;
    await runtime.start(mod, { release: release.version, id: entry.id });
    if (token !== routeToken) return runtime.stop();
    // back goes to the release picker for games with several releases
    ui.backButton(() => { location.hash = entry.releases.length > 1 ? `#/play/${entry.id}` : '#/'; }, () => runtime.togglePause());
  } catch (e) {
    console.error(e);
    ui.error('Oops, that game had a hiccup.', () => { location.hash = '#/'; });
  }
}

runtime.begin();
document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
ui.start(play);
