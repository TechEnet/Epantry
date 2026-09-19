import {
  defineConfig,
} from 'vite'

import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    /*
    |--------------------------------------------------------------------------
    | LAN Access
    |--------------------------------------------------------------------------
    |
    | Makes the frontend accessible from another device on the same network.
    |
    */

    host: '0.0.0.0',

    port: 5173,

    strictPort: true,

    /*
    |--------------------------------------------------------------------------
    | Backend Proxy
    |--------------------------------------------------------------------------
    */

    proxy: {
      '/api': {
        target:
          'http://127.0.0.1:5001',

        changeOrigin: true,

        configure: (
          proxy,
        ) => {
          proxy.on(
            'proxyReq',

            (
              proxyRequest,
            ) => {
              /*
              |--------------------------------------------------------------------------
              | Local Development CORS
              |--------------------------------------------------------------------------
              |
              | Browser request is same-origin with Vite.
              | Vite communicates with Express server-side.
              |
              */

              proxyRequest.removeHeader(
                'origin',
              )
            },
          )
        },
      },
    },
  },
})