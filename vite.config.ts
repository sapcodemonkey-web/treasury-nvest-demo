import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base matches the GitHub Pages project path: https://<user>.github.io/treasury-nvest-demo/
export default defineConfig({
  plugins: [react()],
  base: '/treasury-nvest-demo/',
  test: {
    environment: 'node',
  },
});
