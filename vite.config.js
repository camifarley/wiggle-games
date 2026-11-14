import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS in dev so iPhone / Fire tablet on your Wi-Fi can use the camera.
// `npm run dev:http` skips it (fine on the Mac at http://localhost).
export default defineConfig(({ command }) => ({
  base: './', // works on GitHub Pages project sites
  plugins: command === 'serve' && process.env.HTTP !== '1' ? [basicSsl()] : [],
}));
