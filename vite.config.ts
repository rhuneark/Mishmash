import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  rundotGameLibrariesPlugin,
  rundotMultiplayerPlugin,
} from '@series-inc/rundot-game-sdk/vite';

// CDN assets in cdn/ folder are automatically served in dev mode

export default defineConfig({
  plugins: [
    react(), // Must come first - handles JSX transform
    rundotGameLibrariesPlugin(),
    rundotMultiplayerPlugin(),
  ],
  base: './',
  server: {
    allowedHosts: true,
  },
  // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
  // RUN.game SDK includes top-level await, so we must target an environment that supports it.
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022', // Support top-level await for embedded libraries
    // No experimentalMinChunkSize (v1.29-v1.32 had it): it folded the SDK's lazily loaded
    // helper into a start-up chunk that imports the SDK's chunk, and with the embedded
    // libraries the SDK's top-level await then waited on itself: a blank screen on RUN.
    // scripts/check-chunks.mjs (after every build) fails on that shape.
  },
});
