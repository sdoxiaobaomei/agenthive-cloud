#!/usr/bin/env node
/**
 * Debug Login Page Test
 */

import http from 'http'

console.log('=== Debug: Testing Login Page ===\n')

// Test login page
const req = http.get('http://localhost:3000/login', (res) => {
  console.log('Status:', res.statusCode)
  console.log('Headers:', JSON.stringify(res.headers, null, 2))
  
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    console.log('\nContent length:', data.length)
    console.log('Has login form:', data.includes('手机号'))
    console.log('Has password input:', data.includes('密码'))
    console.log('Has login button:', data.includes('登录 / 注册'))
    
    // Check for any redirect mechanisms
    console.log('\n=== Checking for redirect mechanisms ===')
    console.log('Meta refresh:', data.includes('http-equiv="refresh"'))
    console.log('Window location:', data.includes('window.location'))
    console.log('NavigateTo:', data.includes('navigateTo'))
    console.log('Router push:', data.includes('router.push'))
    
    // Check console log markers
    console.log('\n=== Debug markers ===')
    console.log('Login setup executed:', data.includes('[Login Page] Setup executed'))
    console.log('Login mounted:', data.includes('[Login Page] Mounted'))
    
    // Print first 500 chars of body for inspection
    console.log('\n=== Body preview (first 500 chars) ===')
    console.log(data.substring(0, 500))
  })
})

req.on('error', (e) => console.error('Error:', e.message))
