/**
 * Simple Markdown renderer for chat messages
 * Supports: code blocks, inline code, bold, italic, line breaks
 */
export function renderMarkdown(content: string): string {
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
  content = content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  content = content.replace(/\n/g, '<br>')
  return content
}
