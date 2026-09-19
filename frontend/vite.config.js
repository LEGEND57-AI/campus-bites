import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Stamps the deployed commit into index.html as <meta name="app-commit">, so
// the live build can be identified (curl the page, or read it in DevTools)
// without any visible UI. Vercel sets VERCEL_GIT_COMMIT_SHA during its build;
// elsewhere it is "unknown". Only this one value is read -- nothing else from
// the environment reaches the page -- and it must look like a commit SHA.
const rawCommit = process.env.VERCEL_GIT_COMMIT_SHA || ''
const commit = /^[0-9a-f]{7,40}$/i.test(rawCommit) ? rawCommit : 'unknown'

const buildCommitMeta = {
  name: 'build-commit-meta',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'app-commit', content: commit }, injectTo: 'head' },
  ],
}

export default defineConfig({
  plugins: [react(), buildCommitMeta],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})