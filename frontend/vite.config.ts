import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  // The TanStack packages pin different @tanstack/router-core versions
  // (start-server-core carries its own copy). Left external, the production
  // server imports the top-level copy and fails; bundling them keeps each one
  // on the version it was built against.
  ssr: command === 'build' ? { noExternal: [/^@tanstack\//] } : undefined,
}))

export default config
