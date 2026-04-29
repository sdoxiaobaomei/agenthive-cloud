#!/usr/bin/env node
/**
 * AgentHive Cloud - Unified Docker Image Builder
 * Usage: node scripts/docker-build.mjs [service-name|all]
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());

// Parse .env.docker
function loadEnvDocker() {
  const envPath = resolve(ROOT, '.env.docker');
  if (!existsSync(envPath)) {
    console.error('❌ .env.docker not found. Run from project root.');
    process.exit(1);
  }
  const env = {};
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnvDocker();
const TAG = env.IMAGE_TAG || 'latest';
const REGISTRY = env.REGISTRY_PREFIX || 'agenthive';
const GIT_COMMIT = env.GIT_COMMIT || 'unknown';
const BUILD_TIME = env.BUILD_TIME || new Date().toISOString();

const BUILD_ARGS = [
  `--build-arg BUILD_TIME=${BUILD_TIME}`,
  `--build-arg GIT_COMMIT=${GIT_COMMIT}`,
  `--build-arg VERSION=${env.VERSION || '1.0.0'}`
].join(' ');

const services = [
  {
    name: 'landing',
    image: `${REGISTRY}/landing:${TAG}`,
    context: '.',
    dockerfile: 'apps/landing/Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/landing/.output/server/index.mjs'))
  },
  {
    name: 'api',
    image: `${REGISTRY}/api:${TAG}`,
    context: '.',
    dockerfile: 'apps/api/Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/api/dist/index.js'))
  },
  {
    name: 'agent-runtime',
    image: `${REGISTRY}/agent-runtime:${TAG}`,
    context: './apps/agent-runtime',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/agent-runtime/dist/index.js'))
  },
  {
    name: 'gateway-service',
    image: `${REGISTRY}/gateway-service:${TAG}`,
    context: './apps/java/gateway-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/gateway-service/target/gateway-service-1.0.0-SNAPSHOT.jar'))
  },
  {
    name: 'auth-service',
    image: `${REGISTRY}/auth-service:${TAG}`,
    context: './apps/java/auth-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/auth-service/target/auth-service-1.0.0-SNAPSHOT.jar'))
  },
  {
    name: 'user-service',
    image: `${REGISTRY}/user-service:${TAG}`,
    context: './apps/java/user-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/user-service/target/user-service-1.0.0-SNAPSHOT.jar'))
  },
  {
    name: 'payment-service',
    image: `${REGISTRY}/payment-service:${TAG}`,
    context: './apps/java/payment-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/payment-service/target/payment-service-1.0.0.jar'))
  },
  {
    name: 'order-service',
    image: `${REGISTRY}/order-service:${TAG}`,
    context: './apps/java/order-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/order-service/target/order-service-1.0.0.jar'))
  },
  {
    name: 'cart-service',
    image: `${REGISTRY}/cart-service:${TAG}`,
    context: './apps/java/cart-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/cart-service/target/cart-service-1.0.0.jar'))
  },
  {
    name: 'logistics-service',
    image: `${REGISTRY}/logistics-service:${TAG}`,
    context: './apps/java/logistics-service',
    dockerfile: 'Dockerfile',
    precheck: () => existsSync(resolve(ROOT, 'apps/java/logistics-service/target/logistics-service-1.0.0.jar'))
  }
];

function buildService(svc) {
  console.log(`\n🔨 Building ${svc.name} → ${svc.image}`);

  if (!svc.precheck()) {
    console.error(`   ❌ Pre-build artifact missing. Skipping ${svc.name}.`);
    return { name: svc.name, status: 'skipped', reason: 'artifact missing' };
  }

  const cmd = `docker build ${BUILD_ARGS} -f ${svc.dockerfile} -t ${svc.image} ${svc.context}`;
  console.log(`   $ ${cmd}`);

  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    console.log(`   ✅ ${svc.name} built successfully`);
    return { name: svc.name, status: 'success', image: svc.image };
  } catch (err) {
    console.error(`   ❌ ${svc.name} build failed`);
    return { name: svc.name, status: 'failed', image: svc.image };
  }
}

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Docker Build Summary');
  console.log('='.repeat(60));
  console.log(`Version : ${TAG}`);
  console.log(`Git     : ${GIT_COMMIT}`);
  console.log(`Built   : ${BUILD_TIME}`);
  console.log('-'.repeat(60));

  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped');

  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⏭️';
    console.log(`${icon} ${r.name.padEnd(20)} ${r.status}`);
    if (r.image) console.log(`   ${r.image}`);
  }

  console.log('-'.repeat(60));
  console.log(`Total: ${results.length} | ✅ ${success.length} | ❌ ${failed.length} | ⏭️ ${skipped.length}`);

  if (failed.length > 0) {
    console.error('\n⚠️ Some builds failed. Check logs above.');
    process.exit(1);
  }
}

async function main() {
  const arg = process.argv[2] || 'all';
  const toBuild = arg === 'all'
    ? services
    : services.filter(s => s.name === arg);

  if (toBuild.length === 0) {
    console.error(`Unknown service: ${arg}`);
    console.error(`Available: ${services.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  console.log('🐳 AgentHive Cloud Docker Builder');
  console.log(`   Tag : ${TAG}`);
  console.log(`   Git : ${GIT_COMMIT}`);
  console.log(`   Time: ${BUILD_TIME}`);

  const results = [];
  for (const svc of toBuild) {
    results.push(buildService(svc));
  }

  printSummary(results);
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
