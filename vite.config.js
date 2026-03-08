import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy Uniswap Routing API to bypass CORS restrictions
      '/api/uniswap': {
        target: 'https://api.uniswap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uniswap/, ''),
        headers: {
          'Origin': 'https://app.uniswap.org',
          'Referer': 'https://app.uniswap.org/',
          'x-request-source': 'uniswap-web',
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
