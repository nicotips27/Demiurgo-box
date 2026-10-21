import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Relative base so the build works from any sub-path (the GitHub Pages
  // project site lives at /Demiurgo-box/).
  base: './',
  // Static assets live in public/ so they are served at the site root
  // ("textures/grass_green_d.jpg" -> /textures/grass_green_d.jpg) and copied
  // verbatim into dist/ without being processed by the bundler.
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
