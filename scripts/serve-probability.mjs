#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

const [token, mode, port, storage] = process.argv.slice(2);
if (
  !/^[0-9a-f-]{36}$/.test(token ?? '') ||
  !['dev', 'preview'].includes(mode) ||
  !/^\d+$/.test(port ?? '') ||
  !storage
)
  throw new Error('Use the agent launch command to start an owned instance.');
const root = fileURLToPath(new URL('../', import.meta.url));
const args =
  mode === 'dev'
    ? [
        resolve(root, 'node_modules/vite/bin/vite.js'),
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        port,
        '--strictPort',
      ]
    : [
        resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
        'dev',
        '--config',
        'dist/server/wrangler.json',
        '--local',
        '--persist-to',
        storage,
        '--ip',
        '127.0.0.1',
        '--port',
        port,
        '--inspector-port',
        '0',
      ];
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PROBABILITY_LOCAL_STATE: storage },
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (child.exitCode === null) child.kill(signal);
  });
