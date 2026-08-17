#!/usr/bin/env node
/**
 * tunnel-keepalive.js — Monitor local origin + cloudflared; auto-restart on failure.
 *
 * Modes (CLOUDFLARED_MODE):
 *   docker   — production: restart cloudflared-prod via docker compose
 *   process  — local dev: spawn `cloudflared tunnel run --token …`
 *   auto     — docker if DEPLOY_PATH + docker-compose.prod.yml exist, else process
 *
 * Env:
 *   LOCAL_HEALTH_URL     default http://127.0.0.1:80/healthz (dev: http://127.0.0.1:3000/api/health)
 *   PUBLIC_HEALTH_URL    optional https://api.nexusshield.ai/healthz
 *   CLOUDFLARE_TUNNEL_TOKEN
 *   DEPLOY_PATH          default /opt/nexus-core-firewall (docker mode)
 *   CHECK_INTERVAL_MS    default 15000
 *   RESTART_COOLDOWN_MS  default 30000
 *   MAX_CONSECUTIVE_FAILS default 2 (failures before restart)
 */

'use strict';

const { spawn, execFile } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const cfg = {
  localHealthUrl: process.env.LOCAL_HEALTH_URL || 'http://127.0.0.1:80/healthz',
  publicHealthUrl: process.env.PUBLIC_HEALTH_URL || '',
  tunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN || '',
  deployPath: process.env.DEPLOY_PATH || '/opt/nexus-core-firewall',
  mode: (process.env.CLOUDFLARED_MODE || 'auto').toLowerCase(),
  checkIntervalMs: Number(process.env.CHECK_INTERVAL_MS || 15000),
  restartCooldownMs: Number(process.env.RESTART_COOLDOWN_MS || 30000),
  maxConsecutiveFails: Number(process.env.MAX_CONSECUTIVE_FAILS || 2),
  cloudflaredBin: process.env.CLOUDFLARED_BIN || 'cloudflared',
};

let cloudflaredProc = null;
let lastRestartAt = 0;
let localFailStreak = 0;
let tunnelFailStreak = 0;
let stopping = false;

function ts() {
  return new Date().toISOString();
}

function log(level, msg, extra) {
  const line = `[tunnel-keepalive] ${ts()} ${level.toUpperCase()} ${msg}`;
  if (extra) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
}

function resolveMode() {
  if (cfg.mode === 'docker' || cfg.mode === 'process') {
    return cfg.mode;
  }
  const composeFile = path.join(cfg.deployPath, 'docker-compose.prod.yml');
  if (fs.existsSync(composeFile)) {
    return 'docker';
  }
  return 'process';
}

function probeUrl(urlString, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      resolve({ ok: false, status: 0, error: 'invalid url' });
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'nexus-tunnel-keepalive/1.0' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, status: res.statusCode, body: body.slice(0, 512) });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, error: err.message });
    });
    req.end();
  });
}

function execPromise(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

async function isDockerCloudflaredRunning() {
  try {
    const out = await execPromise('docker', ['ps', '--format', '{{.Names}}']);
    return out.split('\n').some((name) => name.trim() === 'cloudflared-prod');
  } catch (err) {
    log('warn', `docker ps failed: ${err.message}`);
    return false;
  }
}

async function restartDockerCloudflared() {
  const composeFile = path.join(cfg.deployPath, 'docker-compose.prod.yml');
  const envFile = path.join(cfg.deployPath, '.env');
  if (!fs.existsSync(composeFile)) {
    throw new Error(`Missing ${composeFile}`);
  }

  const args = ['compose', '--env-file', envFile, '--profile', 'cloudflare', '-f', composeFile];
  log('info', 'Restarting cloudflared-prod via docker compose…');
  await execPromise('docker', [...args, 'up', '-d', 'cloudflared'], { cwd: cfg.deployPath });
}

function startProcessCloudflared() {
  if (!cfg.tunnelToken) {
    log('warn', 'CLOUDFLARE_TUNNEL_TOKEN missing — cannot start cloudflared process');
    return;
  }
  if (cloudflaredProc) {
    return;
  }

  log('info', 'Starting cloudflared tunnel (process mode)…');
  cloudflaredProc = spawn(
    cfg.cloudflaredBin,
    ['tunnel', 'run', '--token', cfg.tunnelToken, '--retries', '5'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
  );

  cloudflaredProc.stdout.on('data', (buf) => {
    const text = buf.toString().trim();
    if (text) log('info', `[cloudflared] ${text}`);
  });
  cloudflaredProc.stderr.on('data', (buf) => {
    const text = buf.toString().trim();
    if (text) log('warn', `[cloudflared] ${text}`);
  });
  cloudflaredProc.on('exit', (code, signal) => {
    log('warn', `cloudflared exited code=${code} signal=${signal || 'none'}`);
    cloudflaredProc = null;
  });
}

function stopProcessCloudflared() {
  if (cloudflaredProc) {
    cloudflaredProc.kill('SIGTERM');
    cloudflaredProc = null;
  }
}

async function isTunnelHealthy(mode) {
  if (mode === 'docker') {
    return isDockerCloudflaredRunning();
  }
  return Boolean(cloudflaredProc && !cloudflaredProc.killed);
}

async function maybeRestartTunnel(mode, reason) {
  const now = Date.now();
  if (now - lastRestartAt < cfg.restartCooldownMs) {
    log('warn', `Restart skipped (cooldown) — ${reason}`);
    return;
  }
  lastRestartAt = now;
  tunnelFailStreak = 0;

  try {
    if (mode === 'docker') {
      await restartDockerCloudflared();
    } else {
      stopProcessCloudflared();
      startProcessCloudflared();
    }
    log('info', `Tunnel restart triggered: ${reason}`);
  } catch (err) {
    log('error', `Tunnel restart failed: ${err.message}`);
  }
}

async function tick(mode) {
  const local = await probeUrl(cfg.localHealthUrl);
  if (local.ok) {
    localFailStreak = 0;
    log('info', `Local origin OK (${cfg.localHealthUrl}) status=${local.status}`);
  } else {
    localFailStreak += 1;
    log(
      'warn',
      `Local origin unhealthy (${cfg.localHealthUrl}) streak=${localFailStreak} err=${local.error || local.status}`,
    );
  }

  const tunnelUp = await isTunnelHealthy(mode);
  if (tunnelUp) {
    tunnelFailStreak = 0;
    log('info', `cloudflared ${mode === 'docker' ? 'container' : 'process'} running`);
  } else {
    tunnelFailStreak += 1;
    log('warn', `cloudflared not running streak=${tunnelFailStreak}`);
  }

  if (tunnelFailStreak >= cfg.maxConsecutiveFails) {
    await maybeRestartTunnel(mode, 'cloudflared down');
  }

  if (cfg.publicHealthUrl) {
    const pub = await probeUrl(cfg.publicHealthUrl, 12000);
    if (pub.ok) {
      log('info', `Public tunnel OK (${cfg.publicHealthUrl}) status=${pub.status}`);
    } else if (local.ok && tunnelUp) {
      log(
        'warn',
        `Public URL failing while local origin is up — check Cloudflare ingress (Error 1033). status=${pub.status} err=${pub.error || ''}`,
      );
    }
  }
}

async function main() {
  const mode = resolveMode();
  log('info', `Starting keepalive mode=${mode} local=${cfg.localHealthUrl}`);

  if (mode === 'process') {
    startProcessCloudflared();
  }

  await tick(mode);
  const timer = setInterval(() => {
    tick(mode).catch((err) => log('error', `tick failed: ${err.message}`));
  }, cfg.checkIntervalMs);

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    stopProcessCloudflared();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log('error', err.message);
  process.exit(1);
});
