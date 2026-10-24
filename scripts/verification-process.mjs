import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const receiptReserve = 4000;
const probeMs = 500;
const localBudget = 45_000;

export function watchTermination({ budgetMs = localBudget } = {}) {
  const controller = new AbortController();
  const inherited = Number(process.env.PROBABILITY_LIFECYCLE_BUDGET_MS);
  const allowance = Math.min(budgetMs, inherited > 0 ? inherited : budgetMs);
  let interruption = null;
  let deadline = Infinity;
  const receive = (signal) => {
    const at = new Date().toISOString();
    if (!interruption) {
      deadline = Date.now() + allowance;
      try {
        const parent = Number(
          readFileSync(process.env.PROBABILITY_LIFECYCLE_DEADLINE_FILE, 'utf8'),
        );
        if (Number.isFinite(parent)) deadline = Math.min(deadline, parent);
      } catch {}
      interruption = {
        signal,
        at,
        exitCode: signal === 'SIGINT' ? 130 : 143,
        received: [],
      };
    }
    interruption.received.push({ signal, at });
    if (!controller.signal.aborted)
      controller.abort(new Error(`interrupted by ${signal}`));
  };
  const handlers = Object.fromEntries(
    ['SIGINT', 'SIGTERM'].map((signal) => [signal, () => receive(signal)]),
  );
  for (const [signal, handler] of Object.entries(handlers))
    process.on(signal, handler);
  return {
    signal: controller.signal,
    budgetMs: allowance,
    deadline: () => deadline,
    cleanupDeadline: () =>
      Math.min(deadline - receiptReserve, Date.now() + allowance),
    interruption: () => interruption,
    dispose: () => {
      for (const [signal, handler] of Object.entries(handlers))
        process.off(signal, handler);
    },
  };
}

function ps(args) {
  return new Promise((resolveOutput, reject) => {
    execFile(
      'ps',
      args,
      {
        encoding: 'utf8',
        detached: true,
        timeout: probeMs,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, output) => (error ? reject(error) : resolveOutput(output)),
    );
  });
}
async function members(pid) {
  const output = await ps(['-axo', 'pid=,pgid=,stat=']);
  return output.split('\n').flatMap((row) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)/.exec(row);
    return match && Number(match[2]) === pid && !match[3].startsWith('Z')
      ? [Number(match[1])]
      : [];
  });
}
async function owns(pid, nonce) {
  try {
    const output = (
      await ps(['-p', String(pid), '-o', 'pgid=,command='])
    ).trim();
    const match = /^(\d+)\s+(.+)$/.exec(output);
    return (
      Number(match?.[1]) === pid &&
      match?.[2] ===
        [process.execPath, modulePath, '--supervise', nonce].join(' ')
    );
  } catch {
    return false;
  }
}
async function signalGroup(pid, nonce, signal) {
  if (!(await owns(pid, nonce)))
    throw new Error(`refusing to signal unowned command group ${pid}`);
  process.kill(-pid, signal);
}

export async function runCommand({
  file,
  args,
  log,
  signal,
  deadline = () => Infinity,
  budgetMs = localBudget,
  cwd = process.cwd(),
  stream = true,
}) {
  signal?.throwIfAborted();
  const directory = mkdtempSync(join(tmpdir(), 'probability-command-'));
  const deadlineFile = join(directory, 'deadline');
  const nonce = randomUUID();
  let fd = null;
  let child;
  let output = '';
  let result;
  let firstSignal = null;
  let teardown;
  let cleanupFailure = null;
  let closed = false;
  let releasing = false;
  let end = Infinity;
  const capture = (chunk, target) => {
    output += chunk;
    if (fd !== null) {
      try {
        writeFileSync(fd, chunk);
      } catch (error) {
        cleanupFailure ??= `command log: ${error.message}`;
        closeSync(fd);
        fd = null;
      }
    }
    if (stream) target.write(chunk);
  };
  const stop = (
    received = signal?.reason?.message?.includes('SIGINT')
      ? 'SIGINT'
      : 'SIGTERM',
  ) =>
    (teardown ??= (async () => {
      firstSignal = received;
      end = Math.min(
        deadline() - receiptReserve,
        Date.now() + budgetMs - receiptReserve,
      );
      try {
        writeFileSync(deadlineFile, String(end - receiptReserve));
        if (!closed) await signalGroup(child.pid, nonce, firstSignal);
        while (!closed && Date.now() < end) await delay(25);
        if (!closed) await signalGroup(child.pid, nonce, 'SIGKILL');
      } catch (error) {
        cleanupFailure = error.message;
      }
    })());
  const abort = () => {
    void stop();
  };
  try {
    if (log) {
      mkdirSync(dirname(resolve(log)), { recursive: true });
      fd = openSync(log, 'wx');
    }
    child = spawn(process.execPath, [modulePath, '--supervise', nonce], {
      cwd,
      detached: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const completion = new Promise((resolveChild) => {
      child.on('error', (error) => {
        cleanupFailure = error.message;
      });
      child.on('message', (message) => {
        if (message?.type === 'result') result = message.result;
      });
      child.on('close', (status, rawSignal) => {
        closed = true;
        resolveChild({ status, signal: rawSignal });
      });
    });
    child.stdout.on('data', (chunk) => capture(chunk, process.stdout));
    child.stderr.on('data', (chunk) => capture(chunk, process.stderr));
    child.on('spawn', () =>
      child.send({
        type: 'start',
        file,
        args,
        cwd,
        deadlineFile,
        budgetMs: budgetMs - 2 * receiptReserve,
      }),
    );
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    while (!closed) {
      if (!teardown && Date.now() >= deadline() - 2 * receiptReserve)
        void stop('SIGTERM');
      if (result && !releasing) {
        try {
          if ((await members(child.pid)).every((pid) => pid === child.pid)) {
            releasing = true;
            if (child.connected) child.send({ type: 'release' });
          }
        } catch (error) {
          cleanupFailure = error.message;
          void stop();
        }
      }
      if (teardown && !closed && Date.now() > end + probeMs) {
        cleanupFailure ??= `command teardown exceeded its deadline; retained ${directory}`;
        if (child.connected) child.disconnect();
        child.stdout.destroy();
        child.stderr.destroy();
        child.unref();
        break;
      }
      await Promise.race([completion, delay(25)]);
    }
    if (teardown) await teardown;
    const raw = closed ? await completion : { status: 1, signal: null };
    if (!result && !firstSignal)
      cleanupFailure ??= 'command supervisor exited without a result';
    if ((await members(child.pid)).length)
      cleanupFailure ??= `command group ${child.pid} remains after supervisor exit; retained ${directory}`;
    return {
      status: firstSignal
        ? firstSignal === 'SIGINT'
          ? 130
          : 143
        : (result?.status ?? raw.status ?? 1),
      signal: result?.signal ?? raw.signal,
      groupStopped: !cleanupFailure,
      cleanupFailure,
      output,
    };
  } finally {
    signal?.removeEventListener('abort', abort);
    if (fd !== null) closeSync(fd);
    if (!cleanupFailure) rmSync(directory, { recursive: true, force: true });
  }
}

async function supervise(nonce) {
  if (!/^[0-9a-f-]{36}$/.test(nonce ?? '') || !process.send)
    throw new Error('private command supervisor requires IPC');
  let started = false;
  let done = false;
  let parentLost = false;
  let ending;
  let spec;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {});
  const drain = () =>
    (ending ??= (async () => {
      parentLost = true;
      let end =
        Date.now() +
        Math.max(1000, (spec?.budgetMs ?? localBudget) + receiptReserve);
      try {
        if (spec?.deadlineFile) {
          try {
            end = Math.min(
              end,
              Number(readFileSync(spec.deadlineFile, 'utf8')) + receiptReserve,
            );
          } catch {}
          writeFileSync(spec.deadlineFile, String(end - receiptReserve));
        }
        await signalGroup(process.pid, nonce, 'SIGTERM');
        while (Date.now() < end) {
          if ((await members(process.pid)).every((pid) => pid === process.pid))
            process.exit(1);
          await delay(25);
        }
        await signalGroup(process.pid, nonce, 'SIGKILL');
      } catch (error) {
        console.error(`command supervisor cleanup: ${error.message}`);
        process.exit(1);
      }
    })());
  process.on('disconnect', drain);
  process.on('message', (message) => {
    if (message?.type === 'release' && done) {
      process.exit(0);
      return;
    }
    if (message?.type !== 'start' || started || parentLost) return;
    started = true;
    spec = message;
    const child = spawn(message.file, message.args, {
      cwd: message.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PROBABILITY_LIFECYCLE_DEADLINE_FILE: message.deadlineFile,
        PROBABILITY_LIFECYCLE_BUDGET_MS: String(message.budgetMs),
      },
    });
    child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
    let error;
    child.on('error', (failure) => {
      error = failure.message;
      console.error(error);
    });
    child.on('close', async (status, signal) => {
      await Promise.all([
        new Promise((ok) => process.stdout.write('', ok)),
        new Promise((ok) => process.stderr.write('', ok)),
      ]);
      done = true;
      if (process.connected)
        process.send({
          type: 'result',
          result: { status: error ? 1 : (status ?? 1), signal },
        });
      else void drain();
    });
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await supervise(process.argv[3]);
