import { DataService } from '@koishijs/plugin-console'
import { Context } from 'koishi'
import { v4 as uuidV4 } from 'uuid'
import { LiteLoaderScriptItem } from './structure'

declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      liteloader: LiteLoaderProvider
    }
  }
}

export class LiteLoaderProvider extends DataService<LiteLoaderScriptItem[]> {
  constructor(ctx: Context) {
    super(ctx, 'liteloader')
  }

  async get() {
    return await this.ctx.database.get('liteloader_script', { id: { $not: -1 } }, ['id', 'uuid', 'name', 'format', 'enabled', 'edited', 'lastError', 'updatedAt'])
  }
}

export async function initializeDatabase(ctx: Context) {
  ctx.database.extend('liteloader_script', {
    id: 'unsigned',
    uuid: 'string',
    name: 'string',
    code: 'text',
    format: 'string',
    enabled: 'boolean',
    edited: 'boolean',
    lastError: 'text',
    updatedAt: 'unsigned',
  }, {
    autoInc: true,
  })

  const scripts = await ctx.database.get('liteloader_script', { id: { $not: -1 } })
  for (const script of scripts) {
    const patch: any = {}
    if (!script.uuid) patch.uuid = uuidV4()
    if (!script.format) patch.format = 'auto'
    if (!script.updatedAt) patch.updatedAt = Date.now()
    if (script.lastError == null) patch.lastError = ''
    if (script.edited == null) patch.edited = false
    if (Object.keys(patch).length) {
      await ctx.database.set('liteloader_script', script.id, patch)
    }
  }
}
