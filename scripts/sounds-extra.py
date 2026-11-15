# Sound Picker round 2: CC0 sounds and music from OpenGameArt.org that fill Kenney's gaps (cute pops, boings,
# squeaks, splats, silly voices) plus cheerful music loops. Trims silence, normalizes loudness, converts to AAC
# .m4a (plays on Mac, iPhone, Fire) and writes public/sounds/candidates-extra.json (merged by the Picker).
#
# Usage: venv/bin/python -I sounds-extra.py <download_dir> <repo_dir>
#   <download_dir> holds the OpenGameArt downloads, unzipped, in the folders named in SOURCES below.
#   Needs soundfile + numpy (ogg/wav) and macOS afconvert (mp3 decode, AAC encode).
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

DL, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'public', 'sounds', 'candidates')
MUSIC_OUT = os.path.join(REPO, 'public', 'sounds', 'music-candidates')

# pack folder -> (title, page) for credits
PACKS = {
  'silly': ('Silly Sound Effects', 'https://opengameart.org/node/183321'),
  'boings': ('Boings', 'https://opengameart.org/node/183317'),
  'squish': ('Squish Sounds Effects', 'https://opengameart.org/node/183322'),
  'pops1': ('Pop sounds 0', 'https://opengameart.org/content/pop-sounds-0'),
  'pops2': ('Pop sounds', 'https://opengameart.org/content/pop-sounds'),
  'x_squeaktoy/squeak toy': ('Squeak toy sounds (bart)', 'https://opengameart.org/content/squeak-toy-sounds'),
  'x_pondpals/Pond Pals SFX Pack/sfx': ('Pond Pals SFX Pack', 'https://opengameart.org/node/168822'),
  'x_pondpals/Pond Pals SFX Pack/ui': ('Pond Pals SFX Pack', 'https://opengameart.org/node/168822'),
  'x_random18/sound_effects': ('18 random video game sound effects', 'https://opengameart.org/node/3972'),
  'x_cc0sfx100': ('100 CC0 SFX', 'https://opengameart.org/node/85570'),
  'music': ('', ''),
}

# slot -> [(pack folder, file)]
SOURCES = {
  'pop': [('pops1', 'pop2.wav'), ('pops1', 'pop5.wav'), ('pops2', 'pop1.ogg'), ('pops2', 'pop6.ogg'), ('x_cc0sfx100', 'plop_01.ogg'), ('silly', 'plup.mp3')],
  'boing': [('boings', 'bing_01_0.mp3'), ('boings', 'bung_01.mp3'), ('x_random18/sound_effects', 'boing.wav'), ('x_cc0sfx100', 'spring_01.ogg'), ('x_cc0sfx100', 'spring_04.ogg'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_jump.wav')],
  'squeak': [('x_squeaktoy/squeak toy', 'squeak toy - squeak1.wav'), ('x_squeaktoy/squeak toy', 'squeak toy - squeak3.wav'), ('x_squeaktoy/squeak toy', 'squeak toy - squeak5.wav'), ('x_random18/sound_effects', 'squeak.wav'), ('x_random18/sound_effects', 'squeak2.wav')],
  'giggle': [('silly', 'blah.mp3'), ('silly', 'booleh.mp3'), ('silly', 'uah.mp3'), ('silly', 'blung_0.mp3'), ('silly', 'bloop.mp3'), ('x_random18/sound_effects', 'bloops.wav')],
  'splat': [('squish', 'squish_01_0.mp3'), ('squish', 'squish_03.mp3'), ('squish', 'squish_05.mp3'), ('squish', 'squishsplat_impact.mp3'), ('squish', 'squishpop.mp3'), ('x_cc0sfx100', 'splash_01.ogg')],
  'collect': [('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_pickup_bonus.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_pickup_heart.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_pickup_egg.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_score.wav')],
  'powerup': [('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_pickup_1up.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_respawn.wav')],
  'bonk': [('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_bump.wav'), ('x_cc0sfx100', 'pot_01.ogg'), ('x_cc0sfx100', 'wooden_01.ogg'), ('x_cc0sfx100', 'hit_01.ogg')],
  'punch': [('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_push.wav'), ('x_cc0sfx100', 'hit_02.ogg'), ('x_cc0sfx100', 'slam_01.ogg')],
  'whoosh': [('x_random18/sound_effects', 'whoosh.wav'), ('x_random18/sound_effects', 'whoosh2.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_player_dive.wav'), ('x_pondpals/Pond Pals SFX Pack/sfx', 'sfx_monster_spin.wav')],
  'laser': [('x_random18/sound_effects', 'beam.wav'), ('x_random18/sound_effects', 'beam2.wav'), ('x_random18/sound_effects', 'martianray.wav')],
  'tap': [('x_pondpals/Pond Pals SFX Pack/ui', 'menu_move.wav'), ('x_pondpals/Pond Pals SFX Pack/ui', 'menu_set.wav'), ('x_pondpals/Pond Pals SFX Pack/ui', 'menu_start.wav')],
}

# music slot -> [(file, title, author, page)]
MUSIC = [
  ('flowerbed_fields.ogg', 'Flowerbed Fields', 'https://opengameart.org/content/flowerbed-fields-loop'),
  ('platformer_0.ogg', 'Overworld Theme', 'https://opengameart.org/content/overworld-theme-0'),
  ('platformer_alt_0.ogg', 'Overworld Theme (alt)', 'https://opengameart.org/content/overworld-theme-0'),
  ('napping_on_a_cloud.ogg', 'Napping on a Cloud', 'https://opengameart.org/content/napping-on-a-cloud'),
  ('happy_adveture.mp3', 'Happy Adventure', 'https://opengameart.org/content/happy-adventure-loop'),
]
MUSIC_FOR = {  # which music rows each track is offered in
  'flowerbed_fields.ogg': ['music:menu', 'music:04-bounca-bugs'],
  'platformer_0.ogg': ['music:06-smash-run', 'music:08-mega-roll'],
  'platformer_alt_0.ogg': ['music:06-smash-run', 'music:05-move-lab'],
  'napping_on_a_cloud.ogg': ['music:menu', 'music:sneaky'],
  'happy_adveture.mp3': ['music:menu', 'music:05-move-lab', 'music:08-mega-roll'],
}

def load(path):
    if path.endswith('.mp3'):
        tmp = tempfile.mktemp(suffix='.wav')
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', path, tmp], check=True)
        d, sr = sf.read(tmp, always_2d=True); os.remove(tmp)
    else:
        d, sr = sf.read(path, always_2d=True)
    return d.astype(np.float32), sr

def analyze(x, sr):
    spec = np.abs(np.fft.rfft(x[: sr * 2] * np.hanning(min(len(x), sr * 2))))
    freqs = np.fft.rfftfreq(min(len(x), sr * 2), 1 / sr)
    centroid = float((spec * freqs).sum() / (spec.sum() + 1e-9))
    return round(centroid)

def encode(x, sr, out, bitrate, channels=1):
    tmp = tempfile.mktemp(suffix='.wav')
    sf.write(tmp, x, sr, subtype='PCM_16')
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', str(bitrate), tmp, out], check=True)
    os.remove(tmp)

def sfx(slot, pack, name):
    d, sr = load(os.path.join(DL, pack, name))
    x = d.mean(axis=1)
    # trim silence (-45 dB) with a little pre-roll
    thr = np.abs(x).max() * 10 ** (-45 / 20)
    idx = np.where(np.abs(x) > thr)[0]
    x = x[max(0, idx[0] - int(0.005 * sr)): idx[-1] + int(0.02 * sr)]
    maxlen = int(2.5 * sr)
    if len(x) > maxlen:  # cap long tails with a fade
        x = x[:maxlen]; x[-int(0.2 * sr):] *= np.linspace(1, 0, int(0.2 * sr))
    # loudness: peak -3 dBFS, but cap RMS so dense sounds aren't louder than the rest
    x = x / (np.abs(x).max() + 1e-9) * 0.7
    rms = float(np.sqrt((x ** 2).mean()))
    if rms > 0.18: x *= 0.18 / rms
    base = os.path.splitext(name)[0].replace(' ', '_').replace('-', '').replace('__', '_')
    packid = 'oga-' + pack.split('/')[0].replace('x_', '')
    fname = f'{slot}__{packid}__{base}.m4a'
    encode(x, sr, os.path.join(OUT, fname), 64000)
    title, page = PACKS[pack]
    return {'id': f'{packid}/{base}', 'file': f'sounds/candidates/{fname}', 'pack': packid, 'name': base,
            'seconds': round(len(x) / sr, 2), 'isNew': True, 'credit': f'{title}, OpenGameArt.org, CC0', 'page': page,
            'centroidHz': analyze(x, sr)}

def music(name, title, page):
    d, sr = load(os.path.join(DL, 'music', name))
    x = d.mean(axis=1) if d.shape[1] > 1 else d[:, 0]
    x = x / (np.abs(x).max() + 1e-9) * 0.85
    base = os.path.splitext(name)[0]
    fname = f'{base}.m4a'
    os.makedirs(MUSIC_OUT, exist_ok=True)
    encode(x, sr, os.path.join(MUSIC_OUT, fname), 64000)
    return {'id': f'oga-music/{base}', 'music': f'sounds/music-candidates/{fname}', 'name': title,
            'seconds': round(len(x) / sr, 1), 'isNew': True, 'credit': f'{title}, OpenGameArt.org, CC0', 'page': page,
            'kb': round(os.path.getsize(os.path.join(MUSIC_OUT, fname)) / 1024)}

os.makedirs(OUT, exist_ok=True)
out = {'source': 'OpenGameArt.org (CC0 1.0, public domain)', 'slots': {}, 'music': {}}
for slot, items in SOURCES.items():
    out['slots'][slot] = [sfx(slot, p, n) for p, n in items]
for name, title, page in MUSIC:
    m = music(name, title, page)
    for row in MUSIC_FOR[name]: out['music'].setdefault(row, []).append(m)
with open(os.path.join(REPO, 'public', 'sounds', 'candidates-extra.json'), 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
for slot, c in out['slots'].items():
    print(slot, [(x['name'], x['seconds'], x['centroidHz']) for x in c])
print({m['name']: (m['seconds'], m['kb']) for row in out['music'].values() for m in row})
