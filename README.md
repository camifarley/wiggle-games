# Wiggle Games 🫧🐶

Camera movement mini-games for little kids. Runs in the browser on iPhone, Mac and Fire tablet.
Everything is processed on the device: no video is recorded or uploaded.

```bash
npm install
npm run dev:http   # Mac: http://localhost:5173
npm run dev        # HTTPS on your Wi-Fi, for iPhone / Fire tablet (accept the cert warning)
```

Test without a camera: `http://localhost:5173/?fakecam&debug`

**iPhone tip:** open the live site in Safari, then Share → *Add to Home Screen*. It launches
full-screen like an app.

Making a game: copy `src/games/_template` to `src/games/NN-name`. See [CLAUDE.md](CLAUDE.md).
