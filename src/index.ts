import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import { LiteLoaderProvider, initializeDatabase } from './data'
import { initializeConsoleApi } from './console'
import { LiteLoaderService } from './service'

export const name = 'liteloader'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export const inject = ['database', 'console']

export const using = inject

export async function apply(ctx: Context) {
  ctx.plugin(LiteLoaderService)
  ctx.plugin(LiteLoaderProvider)

  await initializeDatabase(ctx)

  ctx.using(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })

  initializeConsoleApi(ctx)
  const service = ctx.get('liteloader')
  if (service) await service.reloadAll()
}

export * from './structure'
