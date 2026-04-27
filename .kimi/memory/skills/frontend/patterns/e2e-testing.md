# Pattern: Playwright E2E 测试

```typescript
// 错误 — brittle CSS selector
test('login', async ({ page }) => {
  await page.click('.btn-primary')
})

// 正确 — stable locator
test('login', async ({ page }) => {
  await page.getByTestId('login-button').click()
  await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
})
```
