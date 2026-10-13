import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@types': path.resolve(__dirname, './src/types'),
        'react-router': path.resolve(__dirname, './src/lib/router.tsx'),
        'react-router-dom': path.resolve(__dirname, './src/lib/router.tsx'),
      },
    },
    define: {
      // Expose public Google Drive Client ID if provided in .env
      'import.meta.env.GOOGLE_DRIVE_CLIENT_ID': JSON.stringify(
        env.GOOGLE_DRIVE_CLIENT_ID || env.VITE_GOOGLE_DRIVE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || ''
      ),
    },
  }
})
