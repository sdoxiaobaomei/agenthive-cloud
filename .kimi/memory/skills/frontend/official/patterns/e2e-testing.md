> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Playwright E2E 娴嬭瘯

```typescript
// 閿欒 鈥?brittle CSS selector
test('login', async ({ page }) => {
  await page.click('.btn-primary')
})

// 姝ｇ‘ 鈥?stable locator
test('login', async ({ page }) => {
  await page.getByTestId('login-button').click()
  await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
})
```
