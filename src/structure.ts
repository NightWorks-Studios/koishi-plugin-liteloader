export type ScriptFormat = 'auto' | 'esm' | 'cjs'

export interface LiteLoaderScript {
  id: number
  uuid: string
  name: string
  code: string
  format: ScriptFormat
  enabled: boolean
  edited: boolean
  lastError: string
  updatedAt: number
}

export interface LiteLoaderScriptItem {
  id: number
  uuid: string
  name: string
  format: ScriptFormat
  enabled: boolean
  edited: boolean
  lastError: string
  updatedAt: number
}

declare module 'koishi' {
  interface Tables {
    liteloader_script: LiteLoaderScript
  }
}
