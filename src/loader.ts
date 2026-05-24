import { Context, ForkScope, segment } from 'koishi'
import { esModuleToCommonJs } from './transpiler'
import { LiteLoaderScript, ScriptFormat } from './structure'

export class ScriptLoader {
  private scopes = new Map<number, ForkScope>()
  private logger

  constructor(private ctx: Context) {
    this.logger = this.ctx.logger('liteloader')
  }

  private resolveCode(code: string, format: ScriptFormat) {
    if (format === 'cjs') return code
    if (format === 'esm') return esModuleToCommonJs(code)
    if (code.includes('export ') || code.includes('import ')) return esModuleToCommonJs(code)
    return code
  }

  private formatError(error: any) {
    const raw = error?.stack || error?.message || String(error)
    const match = String(raw).match(/<anonymous>:(\d+):(\d+)/)
    if (!match) return raw
    const line = Math.max(1, Number(match[1]) - 1)
    const column = Number(match[2])
    return `第 ${line} 行，第 ${column} 列: ${error?.message || String(error)}`
  }

  checkSyntax(code: string, format: ScriptFormat) {
    try {
      const transformed = this.resolveCode(code, format)
      const body = `const {module,exports,require,segment} = this;\n${transformed}`
      new Function(body)
      return null
    } catch (error) {
      return this.formatError(error)
    }
  }

  unload(id: number) {
    const scope = this.scopes.get(id)
    if (scope) {
      this.logger.info(`unload script #${id}`)
      scope.dispose()
      this.scopes.delete(id)
    }
  }

  load(script: LiteLoaderScript): string | null {
    this.logger.info(`load script #${script.id} (${script.name}) format=${script.format}`)
    this.unload(script.id)

    const context: any = {
      module: { exports: {} },
      exports: {},
      require,
      segment,
    }

    try {
      const transformed = this.resolveCode(script.code, script.format)
      const body = `const {${Object.keys(context).join(',')}} = this;\n${transformed}`
      const fn = new Function(body)
      fn.call(context)
      const plugin = context.module.exports?.default || context.module.exports || context.exports
      if (!plugin || typeof plugin.apply !== 'function') {
        return '脚本未导出 apply(ctx) 函数，无法加载。'
      }
      const scope = this.ctx.plugin(plugin)
      this.scopes.set(script.id, scope)
      this.logger.info(`load script success #${script.id} (${script.name})`)
      return null
    } catch (error) {
      this.unload(script.id)
      this.logger.warn(`load script failed #${script.id} (${script.name})`)
      return this.formatError(error)
    }
  }

  unloadAll() {
    this.logger.info(`unload all scripts (${this.scopes.size})`)
    for (const id of [...this.scopes.keys()]) this.unload(id)
  }
}
