import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Match by path: React is imported through subpaths (react/jsx-runtime,
// react-dom/client), so naming only package entries left it inside the
// recharts chunk and forced charts onto the first page load.
const CHUNKS = [
  ['vendor', /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/],
  ['supabase', /[\\/]node_modules[\\/]@supabase[\\/]/],
  ['lucide', /[\\/]node_modules[\\/]lucide-react[\\/]/],
  ['recharts', /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/],
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return CHUNKS.find(([, pattern]) => pattern.test(id))?.[0]
        }
      }
    }
  }
})
