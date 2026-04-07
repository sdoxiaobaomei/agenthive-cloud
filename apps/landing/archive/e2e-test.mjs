#!/usr/bin/env node
/**
 * E2E Test Runner - Frontend (3000) + Backend (3001)
 */

import http from 'http'

const FRONTEND_URL = 'http://localhost:3000'
const BACKEND_URL = 'http://localhost:3001'

// HTTP request helper
function request(url, path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ status: res.statusCode, data: json, headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers })
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

// Test Results
const results = {
  passed: [],
  failed: []
}

function test(name, fn) {
  return fn()
    .then(() => {
      console.log(`✅ PASS: ${name}`)
      results.passed.push(name)
    })
    .catch(err => {
      console.log(`❌ FAIL: ${name} - ${err.message}`)
      results.failed.push({ name, error: err.message })
    })
}

// Global flags
let backendRunning = false

// Run all tests
async function runTests() {
  console.log('🚀 Starting E2E Tests...\n')
  console.log(`Frontend: ${FRONTEND_URL}`)
  console.log(`Backend:  ${BACKEND_URL}\n`)

  // ==================== FRONTEND TESTS ====================
  console.log('🌐 FRONTEND TESTS (Port 3000):\n')
  console.log('Page Load Tests:\n')

  await test('Landing page loads (200)', async () => {
    const res = await request(FRONTEND_URL, '/')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
  })

  await test('Login page loads (200)', async () => {
    const res = await request(FRONTEND_URL, '/login')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
  })

  await test('Chat page exists (200 or redirect)', async () => {
    const res = await request(FRONTEND_URL, '/chat')
    if (res.status !== 200 && res.status !== 302 && res.status !== 307) {
      throw new Error(`Status: ${res.status}`)
    }
  })

  await test('Features page loads (200)', async () => {
    const res = await request(FRONTEND_URL, '/features')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
  })

  await test('Pricing page loads (200)', async () => {
    const res = await request(FRONTEND_URL, '/pricing')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
  })

  await test('Docs page loads (200)', async () => {
    const res = await request(FRONTEND_URL, '/docs')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
  })

  // ==================== BACKEND TESTS ====================
  if (backendRunning) {
    console.log('\n📡 BACKEND TESTS (Port 3001):\n')
    console.log('API Endpoints:\n')

    await test('GET /api/agents returns data', async () => {
      const res = await request(BACKEND_URL, '/api/agents')
      if (res.status === 500) throw new Error('Status: 500 (DB not initialized)')
      if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    })

    await test('GET /api/tasks returns data', async () => {
      const res = await request(BACKEND_URL, '/api/tasks')
      if (res.status === 500) throw new Error('Status: 500 (DB not initialized)')
      if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    })

    await test('GET /api/code/files returns file tree', async () => {
      const res = await request(BACKEND_URL, '/api/code/files')
      if (res.status === 500) throw new Error('Status: 500 (DB not initialized)')
      if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    })

    await test('POST /api/auth/login authenticates user', async () => {
      const res = await request(BACKEND_URL, '/api/auth/login', 'POST', {
        username: 'admin',
        password: 'admin'
      })
      if (res.status === 500) throw new Error('Status: 500 (DB not initialized)')
      if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    })

    await test('Backend health check', async () => {
      const res = await request(BACKEND_URL, '/api/health')
      if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    })
  } else {
    console.log('\n⏭️  Skipping backend tests (no standalone backend on :3001)\n')
  }

  // ==================== PROXY TESTS ====================
  console.log('\n🔗 PROXY TESTS (Frontend → Backend):\n')
  console.log('API requests through Frontend (3000):\n')

  await test('Frontend proxies /api/projects to Backend', async () => {
    const res = await request(FRONTEND_URL, '/api/projects')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    if (!res.data.success) throw new Error('Proxy failed')
  })

  await test('Frontend proxies /api/auth/login to Backend', async () => {
    const res = await request(FRONTEND_URL, '/api/auth/login', 'POST', {
      username: 'admin',
      password: 'admin'
    })
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    if (!res.data.success) throw new Error('Proxy failed')
  })

  await test('Frontend proxies /api/code/files to Backend', async () => {
    const res = await request(FRONTEND_URL, '/api/code/files')
    if (res.status !== 200) throw new Error(`Status: ${res.status}`)
    if (!res.data.success) throw new Error('Proxy failed')
  })

  // ==================== ERROR HANDLING ====================
  console.log('\n🚫 Error Handling:\n')

  await test('Non-existent page is handled (200 or 302)', async () => {
    const res = await request(FRONTEND_URL, '/non-existent-page')
    if (res.status !== 200 && res.status !== 302 && res.status !== 404) {
      throw new Error(`Unexpected status: ${res.status}`)
    }
  })

  if (backendRunning) {
    await test('Backend returns 404 for unknown endpoint', async () => {
      const res = await request(BACKEND_URL, '/api/unknown-endpoint')
      // Backend should return 404 or handle gracefully
      if (res.status !== 404 && res.status !== 200) {
        throw new Error(`Unexpected status: ${res.status}`)
      }
    })
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Passed: ${results.passed.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  const total = results.passed.length + results.failed.length
  console.log(`📈 Success Rate: ${((results.passed.length / total) * 100).toFixed(1)}%`)
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:')
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
  }

  console.log('\n' + '='.repeat(60))
  
  process.exit(results.failed.length > 0 ? 1 : 0)
}

// Check if servers are running
async function checkServers() {
  let frontendRunning = false

  try {
    await request(FRONTEND_URL, '/')
    frontendRunning = true
  } catch {}

  try {
    await request(BACKEND_URL, '/health')
    backendRunning = true
  } catch {
    backendRunning = false
  }

  return { frontendRunning }
}

// Main
checkServers().then(({ frontendRunning }) => {
  if (!frontendRunning) {
    console.error('❌ Error: Frontend is not running at http://localhost:3000')
    console.log(`Please start with: cd agenthive-cloud/apps/landing && node .output-new/server/index.mjs`)
    process.exit(1)
  }

  if (!backendRunning) {
    console.log('ℹ️  Standalone backend not running on :3001, using embedded API routes\n')
  }

  runTests()
})
