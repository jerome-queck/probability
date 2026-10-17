import vinext from 'vinext';
import { defineConfig } from 'vite';
import hosting from './.openai/hosting.json';
import { sites } from './build/sites-vite-plugin';

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.sites-runtime/wrangler/logs';
  process.env.WRANGLER_REGISTRY_PATH ??= '.sites-runtime/wrangler/registry';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.sites-runtime/miniflare/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    server: {
      host: '127.0.0.1',
      watch: { useFsEvents: false, usePolling: true },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        ...(process.env.PROBABILITY_LOCAL_STATE
          ? { persistState: { path: process.env.PROBABILITY_LOCAL_STATE } }
          : {}),
        config: {
          main: './build/sites-worker.ts',
          compatibility_flags: ['nodejs_compat'],
          d1_databases: [
            {
              binding: hosting.d1,
              database_name: 'probability-local',
              database_id: '00000000-0000-4000-8000-000000000000',
            },
          ],
        },
      }),
    ],
  };
});
