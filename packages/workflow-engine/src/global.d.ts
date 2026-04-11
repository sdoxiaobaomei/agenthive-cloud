declare const console: {
  log(...args: any[]): void
  error(...args: any[]): void
  warn(...args: any[]): void
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}

declare module 'fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  export function readdir(path: string): Promise<string[]>
  export function readFile(path: string, encoding?: string): Promise<string>
  export function writeFile(path: string, data: string): Promise<void>
}

declare module 'path' {
  export function join(...paths: string[]): string
}
