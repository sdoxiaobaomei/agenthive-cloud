/**
 * Vite CJS Guard Plugin
 *
 * 根本目的：在 dev 模式下提前发现 "CJS 模块未被预构建" 的问题，
 * 避免浏览器控制台出现晦涩的 "does not provide an export named 'default'" 报错。
 *
 * 工作原理：
 * 1. Vite dev 模式下，node_modules 中的依赖应通过 optimizeDeps 预构建为 ESM
 * 2. 如果某个 CJS 模块未被预构建，Vite 会直接将其原样 serve 给浏览器
 * 3. 浏览器解析 CJS 的 module.exports 时，找不到 export default，于是报错
 * 4. 本插件拦截所有 node_modules 中的 .js 文件加载请求，检测其是否为 CJS 格式
 * 5. 若发现未预构建的 CJS 模块，立即在服务端控制台输出明确的警告
 *
 * 使用方式：在 nuxt.config.ts 的 vite.plugins 中注册，dev 模式自动生效
 */
import type { Plugin } from 'vite'

// CJS 格式特征正则（用于检测 module.exports / exports.xxx）
const CJS_PATTERNS = [
  /\bmodule\.exports\s*=/,
  /\bexports\.\w+\s*=/,
  /typeof\s+exports\s*===?\s*['"]object['"]/,
]

export default function cjsGuard(): Plugin {
  const checkedModules = new Set<string>()

  return {
    name: 'agenthive:cjs-guard',
    apply: 'serve', // 仅在 dev 模式生效

    transform(code, id) {
      // 只检查 node_modules 中的 .js 文件
      if (!id.includes('node_modules') || !id.endsWith('.js')) return

      // 跳过已经被 Vite 预构建的文件（路径包含 .vite-cache 或 .vite/deps）
      if (id.includes('.vite-cache') || id.includes('.vite/deps')) return

      // 跳过已检查过的模块（避免重复警告）
      if (checkedModules.has(id)) return
      checkedModules.add(id)

      // 检测文件内容是否包含 CJS 特征
      const isCJS = CJS_PATTERNS.some((p) => p.test(code))
      if (!isCJS) return

      // 提取包名，用于给出修复建议
      const pkgMatch = id.match(/node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/])?node_modules[\\/]([^\\/]+)/)
      const pkgName = pkgMatch?.[1] || 'unknown'

      this.warn(
        `
┌─────────────────────────────────────────────────────────────────────────┐
│  [CJS Guard] 检测到未预构建的 CommonJS 模块被直接加载                   │
├─────────────────────────────────────────────────────────────────────────┤
│  模块路径: ${id.slice(id.indexOf('node_modules'))}
│  所属包:   ${pkgName}
│                                                                         │
│  该模块使用 CommonJS (module.exports) 格式，浏览器以 ESM 方式           │
│  解析时会失败，控制台将出现:                                            │
│    "does not provide an export named 'default'"                         │
│                                                                         │
│  修复方式：                                                             │
│  1. 在 nuxt.config.ts → vite.optimizeDeps.include 中                  │
│     添加正确路径（注意 .js 后缀是否匹配 Element Plus 内部导入）         │
│  2. 删除 .vite-cache 后重新启动 dev 服务器                             │
│  3. 或将 '${pkgName}' 加入 build.transpile 列表                        │
└─────────────────────────────────────────────────────────────────────────┘
        `
      )
    },
  }
}
