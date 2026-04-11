import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from './AppHeader.vue'
import { ref } from 'vue'

/**
 * AppHeader Component Tests
 * 
 * Test Criteria:
 * - /app/dashboard links must use <a> tags (not NuxtLink)
 * - This is required for Nitro routeRules proxy to work correctly
 */
describe('AppHeader', () => {
  it('should render login link as <a> tag with correct href', () => {
    const wrapper = mount(AppHeader)
    
    const loginLink = wrapper.find('a[href="/app/dashboard"].text-gray-600')
    expect(loginLink.exists()).toBe(true)
    expect(loginLink.text()).toContain('登录')
  })

  it('should render "开始使用" CTA as <a> tag (not NuxtLink)', () => {
    const wrapper = mount(AppHeader)
    
    // Find the CTA by its distinctive classes
    const ctaLink = wrapper.find('a.bg-primary-500.text-white.px-4')
    expect(ctaLink.exists()).toBe(true)
    expect(ctaLink.attributes('href')).toBe('/app/dashboard')
    expect(ctaLink.text()).toContain('开始使用')
  })

  it('should not use NuxtLink for /app/dashboard navigation', () => {
    const wrapper = mount(AppHeader)
    
    // There should be no elements with to="/app/dashboard"
    const nuxtLinks = wrapper.findAll('[to="/app/dashboard"]')
    expect(nuxtLinks.length).toBe(0)
  })

  it('should have correct mobile menu links', () => {
    const wrapper = mount(AppHeader)
    
    // Mobile menu should also use <a> tags for /app/dashboard
    const mobileLogin = wrapper.find('a.block.text-gray-600[href="/app/dashboard"]')
    const mobileCta = wrapper.find('a.block.bg-primary-500.text-white[href="/app/dashboard"]')
    
    expect(mobileLogin.exists()).toBe(true)
    expect(mobileCta.exists()).toBe(true)
  })
})
