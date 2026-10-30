import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  // Bundle dependencies into the server build. Left external, packages like
  // @react-three/fiber resolve to CommonJS builds that require() the ESM-only
  // three, which crashes on Netlify's function runtime. The dev server can't
  // run bundled CommonJS, so it keeps them external.
  ssr: command === 'build' ? { noExternal: true } : undefined,
  plugins: [tailwindcss(), tanstackStart(), netlify(), viteReact()],
}))
