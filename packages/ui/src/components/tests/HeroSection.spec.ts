import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroSection from './HeroSection.vue'

/**
 * HeroSection Component Tests
 * 
 * Test Criteria:
 * - CTA button must use <a> tag (not router-link/NuxtLink) for /app/dashboard
 * - This ensures the request goes to server for Nitro proxy to handle
 */
describe('HeroSection', () => {
  it('should render the CTA button as <a> tag (not NuxtLink)', () => {
    const wrapper = mount(HeroSection)
    
    // Find the CTA button by text content
    const ctaButton = wrapper.find('a')
    
    // Should exist and have correct attributes
    expect(ctaButton.exists()).toBe(true)
    expect(ctaButton.attributes('href')).toBe('/app/dashboard')
    expect(ctaButton.text()).toContain('免费开始使用')
  })

  it('should not use router-link for /app/dashboard navigation', () => {
    const wrapper = mount(HeroSection)
    
    // Should not have any router-link or NuxtLink pointing to /app/dashboard
    const nuxtLinks = wrapper.findAll('[to="/app/dashboard"]')
    expect(nuxtLinks.length).toBe(0)
    
    const routerLinks = wrapper.findAll('router-link[href="/app/dashboard"]')
    expect(routerLinks.length).toBe(0)
  })

  it('CTA link should have proper styling classes', () => {
    const wrapper = mount(HeroSection)
    const ctaButton = wrapper.find('a[href="/app/dashboard"]')
    
    expect(ctaButton.exists()).toBe(true)
    expect(ctaButton.classes()).toContain('bg-primary-500')
    expect(ctaButton.classes()).toContain('text-white')
  })
})
