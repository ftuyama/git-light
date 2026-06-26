import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const sharedAlias = { '@shared': resolve(__dirname, 'shared') }

export default defineConfig({
  main: {
    // chokidar is ESM-only; bundle it into the CJS main output instead of
    // externalizing so require() resolution never sees a bare ESM package.
    plugins: [externalizeDepsPlugin({ exclude: ['chokidar'] })],
    resolve: { alias: sharedAlias },
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        ...sharedAlias,
      },
    },
    plugins: [vue(), tailwindcss()],
    build: {
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
  },
})
