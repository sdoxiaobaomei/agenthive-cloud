#!/usr/bin/env node
/**
 * API Chat Workflow E2E Test
 * Cross-platform script (Windows/PowerShell safe)
 * Handles UTF-8 JSON correctly via Buffer.byteLength
 */

import http from 'http';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER = {
  username: 'e2e_test_user',
  password: 'TestPass123!',
  email: 'e2e@test.local'
};

let token = null;
let sessionId = null;

function request(path, method = 'GET', data = null, auth = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (auth && token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data: json, body });
        } catch {
          resolve({ status: res.statusCode, data: null, body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function ok(label, status) {
  const icon = status >= 200 && status < 300 ? '✅' : '❌';
  console.log(`${icon} ${label} (HTTP ${status})`);
}

async function run() {
  console.log(`🧪 Testing API at ${BASE_URL}\n`);

  // 1. Health check
  const health = await request('/api/health');
  ok('Health Check', health.status);
  if (health.status !== 200) {
    console.error('Server not ready. Aborting.');
    process.exit(1);
  }
  console.log(`   DB: ${health.data?.services?.database?.ok ? 'OK' : 'FAIL'}`);
  console.log(`   Redis: ${health.data?.services?.redis?.ok ? 'OK' : 'FAIL'}`);
  console.log(`   LLM: ${health.data?.services?.llm?.ok ? 'OK' : 'FAIL'}`);

  // 2. Register (ignore 409 conflict if already exists)
  const reg = await request('/api/auth/register', 'POST', TEST_USER);
  ok('Register User', reg.status);
  if (reg.status === 200) {
    token = reg.data?.data?.token;
  }

  // 3. Login if register failed or no token
  if (!token) {
    const login = await request('/api/auth/login', 'POST', {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    ok('Login User', login.status);
    if (login.status === 200) {
      token = login.data?.data?.token;
    }
  }

  if (!token) {
    console.error('❌ Failed to obtain auth token');
    process.exit(1);
  }
  console.log(`   Token: ${token.slice(0, 20)}...`);

  // 4. Create chat session
  const session = await request('/api/chat/sessions', 'POST', {
    title: 'E2E 测试会话'
  }, true);
  ok('Create Chat Session', session.status);
  sessionId = session.data?.data?.id;
  if (!sessionId) {
    console.error('❌ Failed to create session');
    process.exit(1);
  }
  console.log(`   Session ID: ${sessionId}`);

  // 5. Send Chinese message
  const msg = await request(`/api/chat/sessions/${sessionId}/messages`, 'POST', {
    content: '你好，请帮我创建一个简单的登录页面'
  }, true);
  ok('Send Chinese Message', msg.status);
  console.log(`   Intent: ${msg.data?.data?.intent || 'N/A'}`);
  console.log(`   Assistant: ${msg.data?.data?.message?.content?.slice(0, 40) || 'N/A'}...`);

  // 6. Get messages
  const list = await request(`/api/chat/sessions/${sessionId}/messages`, 'GET', null, true);
  ok('Get Message List', list.status);
  const count = list.data?.data?.messages?.length || 0;
  console.log(`   Messages: ${count}`);

  // Summary
  const allOk = [health, reg, session, msg, list].every(r => r.status >= 200 && r.status < 300);
  console.log(`\n${allOk ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
  process.exit(allOk ? 0 : 1);
}

run().catch(err => {
  console.error('💥 Unexpected error:', err.message);
  process.exit(1);
});
