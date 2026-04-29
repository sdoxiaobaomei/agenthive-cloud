/**
 * Markdown 渲染组合式函数
 * 使用 markdown-it + 白名单标签过滤（XSS 防护）
 * SSR 安全：服务端做基础过滤，客户端用 DOMParser 深度过滤
 */

import MarkdownIt from 'markdown-it'

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'del', 's',
  'ul', 'ol', 'li',
  'a', 'code', 'pre', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
}

/** 服务端基础过滤：移除事件处理器、script/style 标签 */
function basicSanitize(html: string): string {
  // 移除 script/style 标签及其内容
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '')
  // 移除事件处理器
  html = html.replace(/\s*on\w+\s*=\s*["']?[^"'>]*["']?/gi, '')
  // 移除 javascript: 伪协议
  html = html.replace(/javascript:/gi, '')
  // 移除 data: 伪协议（防止 base64 攻击）
  html = html.replace(/data:[^;]*;base64,/gi, '')
  return html
}

/** 客户端深度过滤：DOMParser 白名单 */
function deepSanitize(html: string): string {
  if (typeof DOMParser === 'undefined') return basicSanitize(html)

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()

      if (!ALLOWED_TAGS.has(tagName)) {
        const span = doc.createElement('span')
        while (el.firstChild) {
          span.appendChild(el.firstChild)
        }
        el.parentNode?.replaceChild(span, el)
        walk(span)
        return
      }

      const allowed = ALLOWED_ATTRS[tagName]
      Array.from(el.attributes).forEach(attr => {
        if (!allowed?.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name)
        }
      })

      if (tagName === 'a') {
        const href = el.getAttribute('href')
        if (href && !/^https?:\/\//i.test(href)) {
          el.removeAttribute('href')
        }
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }
    }
    Array.from(node.childNodes).forEach(walk)
  }

  walk(doc.body)
  return doc.body.innerHTML
}

/** Markdown 渲染器 */
export function useMarkdownRender() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  const render = (content: string): string => {
    if (!content) return ''
    const rawHtml = md.render(content)
    if (import.meta.client) {
      return deepSanitize(rawHtml)
    }
    return basicSanitize(rawHtml)
  }

  return { render }
}
