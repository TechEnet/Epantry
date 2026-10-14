import {
  defineConfig,
} from 'vite'

import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url))

// Use WebP only where Sharp has generated a counterpart. Missing images and
// pre-existing PNG/JPEG references keep their old behavior automatically.
function optimizedPublicImages() {
  return {
    name: 'epantry-optimized-public-images',
    enforce: 'pre',
    transform(source, id) {
      if (
        !/\.(?:jsx?|css)(?:\?|$)/.test(id) ||
        !['.png', '.jpg', '.jpeg'].some((extension) => source.includes(extension))
      ) {
        return null
      }

      const rewritten = source.replace(
        /(["'])(\/(?:hero|exploar|banners|video)\/[^"'\r\n]+?\.(?:png|jpe?g))\1/g,
        (original, quote, asset) => {
          const optimizedPath = asset.replace(/\.(?:png|jpe?g)$/i, '.webp')
          // Restrict all lookup paths to known public image subdirectories.
          return existsSync(`${publicRoot}${optimizedPath}`)
            ? `${quote}${optimizedPath}${quote}`
            : original
        },
      )
      return rewritten === source ? null : { code: rewritten, map: null }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    optimizedPublicImages(),
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