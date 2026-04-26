/**
 * Vite Plugin: dayjs ESM Redirect
 *
 * dayjs 1.x 的 package.json 没有暴露 ESM 入口（无 module/exports 字段），
 * 只有 main: "dayjs.min.js"（UMD）。Vite dev 模式的 esbuild 预构建无法从 UMD
 * 正确提取 default export，导致浏览器报错：
 *   "does not provide an export named 'default'"
 *
 * 本插件在 resolveId 阶段将 dayjs 及其插件重定向到 esm/ 目录下的真正 ESM 构建。
 */
import type { Plugin } from 'vite'
import { resolve } from 'path'
import { readdirSync, existsSync } from 'fs'

function findDayjsRoot(currentDir: string): string | null {
  // pnpm 将间接依赖放在根目录 node_modules/.pnpm/dayjs@x.x.x/node_modules/dayjs/
  const pnpmDir = resolve(currentDir, '../../node_modules/.pnpm')
  if (!existsSync(pnpmDir)) return null
  const entries = readdirSync(pnpmDir)
  const dayjsEntry = entries.find((name) => name.startsWith('dayjs@'))
  if (!dayjsEntry) return null
  const candidate = resolve(pnpmDir, dayjsEntry, 'node_modules/dayjs')
  return existsSync(candidate) ? candidate : null
}

export default function dayjsEsmPlugin(currentDir: string): Plugin {
  const dayjsRoot = findDayjsRoot(currentDir)

  return {
    name: 'dayjs-esm-redirect',
    enforce: 'pre',

    resolveId(id) {
      if (!dayjsRoot) return

      // dayjs 主包 → esm/index.js
      if (id === 'dayjs') {
        return resolve(dayjsRoot, 'esm/index.js')
      }

      // dayjs CJS 插件 → esm 插件 (e.g. dayjs/plugin/customParseFormat.js)
      const pluginMatch = id.match(/^dayjs\/plugin\/(.+)\.js$/)
      if (pluginMatch) {
        return resolve(dayjsRoot, 'esm/plugin', pluginMatch[1], 'index.js')
      }
    },
  }
}
