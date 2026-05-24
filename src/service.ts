import { Service } from 'koishi'
import { ScriptLoader } from './loader'
import { LiteLoaderScript } from './structure'

declare module 'koishi' {
  interface Context {
    liteloader: LiteLoaderService
  }
}

export class LiteLoaderService extends Service {
  loader: ScriptLoader
  private liteLogger

  constructor(ctx) {
    super(ctx, 'liteloader')
    this.loader = new ScriptLoader(ctx)
    this.liteLogger = this.ctx.logger('liteloader')
  }

  async refreshList() {
    const data = this.ctx.get('console.liteloader')
    if (data) await data.refresh()
  }

  async reloadScriptById(id: number) {
    this.liteLogger.info(`reload script #${id}`)
    const script = (await this.ctx.database.get('liteloader_script', { id }, ['id', 'name', 'code', 'format', 'enabled', 'edited', 'lastError', 'uuid', 'updatedAt']))[0] as LiteLoaderScript
    if (!script) return
    if (!script.enabled) {
      this.liteLogger.info(`script #${id} disabled, unload only`)
      this.loader.unload(script.id)
      await this.ctx.database.set('liteloader_script', script.id, { lastError: '' })
      await this.refreshList()
      return
    }
    const error = this.loader.load(script)
    await this.ctx.database.set('liteloader_script', script.id, { lastError: error || '', edited: false })
    if (error) this.liteLogger.warn(`reload failed #${id}: ${error.split('\n')[0]}`)
    else this.liteLogger.info(`reload success #${id}`)
    await this.refreshList()
  }

  async setScriptStateById(id: number, enabled: boolean) {
    const script = (await this.ctx.database.get('liteloader_script', { id }, ['id', 'name', 'code', 'format', 'enabled', 'edited', 'lastError', 'uuid', 'updatedAt']))[0] as LiteLoaderScript
    if (!script) return
    if (enabled) {
      this.liteLogger.info(`enable script #${id}`)
      const error = this.loader.load(script)
      await this.ctx.database.set('liteloader_script', script.id, { lastError: error || '', edited: false })
      if (error) this.liteLogger.warn(`enable failed #${id}: ${error.split('\n')[0]}`)
      else this.liteLogger.info(`enable success #${id}`)
    } else {
      this.liteLogger.info(`disable script #${id}`)
      this.loader.unload(script.id)
      await this.ctx.database.set('liteloader_script', script.id, { lastError: '' })
      this.liteLogger.info(`disable success #${id}`)
    }
    await this.refreshList()
  }

  async reloadAll() {
    this.liteLogger.info('reload all enabled scripts')
    this.loader.unloadAll()
    const scripts = await this.ctx.database.get('liteloader_script', { enabled: true }, ['id', 'name', 'code', 'format', 'enabled', 'edited', 'lastError', 'uuid', 'updatedAt']) as LiteLoaderScript[]
    for (const script of scripts) {
      const error = this.loader.load(script)
      await this.ctx.database.set('liteloader_script', script.id, { lastError: error || '', edited: false })
    }
    await this.refreshList()
  }
}
