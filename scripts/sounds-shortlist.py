# Builds the Sound Picker shortlist: picks candidate Kenney (CC0) sounds per game slot, converts them
# to AAC .m4a (plays on Mac, iPhone, Fire), and writes public/sounds/candidates.json.
# Usage: venv/bin/python -I shortlist.py <kenney_dir> <repo_dir>
import json, os, subprocess, sys, tempfile
import soundfile as sf

KENNEY, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, 'public', 'sounds', 'candidates')

def k(pack, *names):
    return [(pack, n) for n in names]

SLOTS = [
  ('pop', '🫧', 'Bubble pop', 'Bubble Pop bubbles, small hits', 'pop',
   k('interface-sounds', 'drop_001', 'drop_002', 'drop_003', 'pluck_001', 'pluck_002') + k('digital-audio', 'pepSound1')),
  ('boing', '🏀', 'Boing / bounce', 'Bouncy balls, bugs hopping, bag landing', 'boing',
   k('digital-audio', 'phaseJump1', 'phaseJump2', 'phaseJump3', 'phaseJump4', 'phaserUp1', 'phaserUp3')),
  ('smash', '🪨', 'Boulder smash', 'Smash Run: breaking boulders and pumpkins', 'boom',
   k('impact-sounds', 'impactMining_000', 'impactMining_002', 'impactWood_heavy_000', 'impactWood_heavy_002') + k('sci-fi-sounds', 'explosionCrunch_000', 'explosionCrunch_002')),
  ('boom', '💥', 'Big boom', 'Bouncy Boom spin, bag burst, mega laser', 'boom',
   k('sci-fi-sounds', 'lowFrequency_explosion_000', 'lowFrequency_explosion_001', 'explosionCrunch_003', 'explosionCrunch_004') + k('impact-sounds', 'impactPlate_heavy_000', 'impactMetal_heavy_000')),
  ('punch', '👊', 'Punch hit', 'Smash Run punches, Space Pilot punch', 'boing',
   k('impact-sounds', 'impactPunch_heavy_000', 'impactPunch_heavy_002', 'impactPunch_heavy_004', 'impactPunch_medium_000', 'impactPunch_medium_002', 'impactSoft_heavy_000')),
  ('bonk', '🤕', 'Screen bonk', 'Boulder bonks into the screen when he stands still', 'boing',
   k('impact-sounds', 'impactSoft_heavy_002', 'impactSoft_heavy_004', 'impactBell_heavy_000', 'impactPlank_medium_000', 'impactGlass_heavy_000', 'impactTin_medium_000')),
  ('laser', '🔫', 'Laser (punch)', 'Space Pilot cyan twin lasers', 'tone',
   k('sci-fi-sounds', 'laserSmall_000', 'laserSmall_002', 'laserSmall_004', 'laserRetro_000', 'laserRetro_002') + k('digital-audio', 'laser1')),
  ('sonic', '📢', 'Sonic laser (shout)', 'Space Pilot pink lasers when he shouts PEW', 'whoosh',
   k('sci-fi-sounds', 'laserLarge_000', 'laserLarge_002', 'laserLarge_004') + k('digital-audio', 'phaserDown1', 'zapTwoTone', 'zapThreeToneUp')),
  ('powerup', '⭐', 'Power-up / level up', 'Level up, power mode, mega ball', 'tada',
   k('digital-audio', 'powerUp1', 'powerUp3', 'powerUp5', 'powerUp7', 'powerUp9', 'powerUp11')),
  ('win', '🏆', 'Big win jingle', 'Finale, trophy, full passport', 'tada',
   k('music-jingles', 'jingles_NES00', 'jingles_NES08', 'jingles_PIZZI00', 'jingles_PIZZI10', 'jingles_STEEL00', 'jingles_SAX04')),
  ('collect', '💎', 'Collect gem / coin', 'Gems, stars, rings', 'ding',
   k('casino-audio', 'chips-collide-1', 'chips-handle-1') + k('rpg-audio', 'handleCoins') + k('digital-audio', 'highUp', 'threeTone1', 'twoTone1')),
  ('splat', '🟢', 'Slime splat', 'Bouncy Boom slime, alien slime on the windshield', 'splat',
   k('sci-fi-sounds', 'slime_000', 'slime_001') + k('impact-sounds', 'impactSoft_medium_000', 'impactSoft_medium_002', 'footstep_snow_000', 'impactGeneric_light_000')),
  ('step', '👟', 'Running footsteps', 'Smash Run running', None,
   k('impact-sounds', 'footstep_grass_000', 'footstep_grass_002', 'footstep_concrete_000', 'footstep_snow_002', 'footstep_wood_000', 'footstep_carpet_000')),
  ('engine', '🚀', 'Spaceship engine', 'Space Pilot thrusters', None,
   k('sci-fi-sounds', 'spaceEngineSmall_000', 'spaceEngineSmall_002', 'thrusterFire_000', 'thrusterFire_002', 'engineCircular_000', 'spaceEngineLow_000')),
  ('shield', '🛡️', 'Shield / force field', 'Power aura, shields', None,
   k('sci-fi-sounds', 'forceField_000', 'forceField_001', 'forceField_002', 'forceField_003', 'forceField_004')),
  ('cubes', '👾', 'Alien bursts into cubes', 'Space Pilot alien hits', 'pop',
   k('impact-sounds', 'impactGlass_light_000', 'impactGlass_light_002', 'impactGlass_medium_000') + k('interface-sounds', 'glass_001', 'glass_003', 'glitch_001')),
  ('tap', '👆', 'Button tap', 'Menu and picker buttons', None,
   k('ui-audio', 'click1', 'click3', 'rollover2') + k('interface-sounds', 'select_001', 'switch_002', 'confirmation_001')),
]

def find(pack, name):
    for root, _, files in os.walk(os.path.join(KENNEY, pack, 'x')):
        for f in files:
            if os.path.splitext(f)[0] == name and f.endswith('.ogg'):
                return os.path.join(root, f)
    return None

os.makedirs(OUT, exist_ok=True)
manifest = []
missing = []
for sid, emoji, label, use, synth, cands in SLOTS:
    items = []
    for pack, name in cands:
        src = find(pack, name)
        if not src:
            missing.append(f'{pack}/{name}')
            continue
        data, rate = sf.read(src, always_2d=True)
        peak = float(abs(data).max()) or 1.0
        data = data * (0.89 / peak)  # normalize to about -1 dBFS so candidates compare fairly
        dur = len(data) / rate
        fname = f'{sid}__{pack}__{name}.m4a'
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            sf.write(tmp.name, data, rate, subtype='PCM_16')
            subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', tmp.name, os.path.join(OUT, fname)], check=True)
        items.append({'id': f'{pack}/{name}', 'file': f'sounds/candidates/{fname}', 'pack': pack, 'name': name, 'seconds': round(dur, 2)})
    manifest.append({'slot': sid, 'emoji': emoji, 'label': label, 'use': use, 'synth': synth, 'candidates': items})

with open(os.path.join(REPO, 'public', 'sounds', 'candidates.json'), 'w') as f:
    json.dump({'source': 'Kenney.nl audio packs (CC0 1.0, public domain)', 'slots': manifest}, f, indent=1, ensure_ascii=False)
print('slots', len(manifest), 'files', sum(len(s['candidates']) for s in manifest))
print('missing', missing)
