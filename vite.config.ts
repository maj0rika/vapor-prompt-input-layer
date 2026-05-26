import { tmpdir } from 'node:os';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleComplianceReport } from './server/compliance/complianceProxy';

function complianceProxyPlugin(): Plugin {
  return {
    name: 'compliance-report-proxy',
    configureServer(server) {
      server.middlewares.use('/api/compliance/report', (req, res) => {
        void handleComplianceReport(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/compliance/report', (req, res) => {
        void handleComplianceReport(req, res);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), complianceProxyPlugin()],
    server: {
      host: '0.0.0.0',
      fs: {
        allow: [process.cwd(), tmpdir()],
      },
      watch: {
        ignored: ['**/vapor-preview-*/**'],
      },
    },
  };
});
