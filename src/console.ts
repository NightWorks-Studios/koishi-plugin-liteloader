import { Context } from 'koishi'
import { v4 as uuidV4 } from 'uuid'
import { ScriptFormat } from './structure'

declare module '@koishijs/plugin-console' {
  interface Events {
    'create-liteloader-script'(): Promise<number>
    'load-liteloader-script'(id: number): Promise<{ code: string, format: ScriptFormat, name: string }>
    'save-liteloader-script'(id: number, data: { code?: string, format?: ScriptFormat, name?: string, reload?: boolean }): Promise<void>
    'rename-liteloader-script'(id: number, name: string): Promise<void>
    'delete-liteloader-script'(id: number): Promise<void>
    'set-liteloader-script-state'(id: number, enabled: boolean): Promise<void>
    'reload-liteloader-script'(id: number): Promise<void>
    'check-liteloader-script'(data: { code: string, format: ScriptFormat }): Promise<{ ok: boolean, error?: string }>
  }
}

const DEFAULT_CODE = `export const name = 'lite-script'\n\nexport async function apply(ctx) {\n  ctx.command('hello-lite').action(() => 'hello from liteloader')\n}\n`

export function initializeConsoleApi(ctx: Context) {
  const getService = () => ctx.get('liteloader')

  ctx.console.addListener('create-liteloader-script', async () => {
    const item = await ctx.database.create('liteloader_script', {
      uuid: uuidV4(),
      name: '未命名脚本',
      format: 'auto',
      code: DEFAULT_CODE,
      enabled: false,
      edited: false,
      lastError: '',
      updatedAt: Date.now(),
    })
    await getService()?.refreshList()
    return item.id
  }, { authority: 5 })

  ctx.console.addListener('load-liteloader-script', async (id: number) => {
    const item = (await ctx.database.get('liteloader_script', { id }, ['code', 'format', 'name']))[0]
    return {
      code: item?.code || '',
      format: (item?.format || 'auto') as ScriptFormat,
      name: item?.name || '',
    }
  }, { authority: 5 })

  ctx.console.addListener('save-liteloader-script', async (id: number, data) => {
    const patch: any = { updatedAt: Date.now() }
    if (typeof data.code === 'string') patch.code = data.code
    if (typeof data.name === 'string') patch.name = data.name
    if (data.format) patch.format = data.format
    patch.edited = true
    patch.lastError = ''
    await ctx.database.set('liteloader_script', id, patch)
    const enabled = !!(await ctx.database.get('liteloader_script', { id }, ['enabled']))[0]?.enabled
    const shouldReload = data.reload !== false
    if (enabled && shouldReload) {
      await getService()?.reloadScriptById(id)
    } else {
      await getService()?.refreshList()
    }
  }, { authority: 5 })

  ctx.console.addListener('rename-liteloader-script', async (id: number, name: string) => {
    await ctx.database.set('liteloader_script', id, { name, updatedAt: Date.now() })
    await getService()?.refreshList()
  }, { authority: 5 })

  ctx.console.addListener('delete-liteloader-script', async (id: number) => {
    getService()?.loader.unload(id)
    await ctx.database.remove('liteloader_script', { id })
    await getService()?.refreshList()
  }, { authority: 5 })

  ctx.console.addListener('set-liteloader-script-state', async (id: number, enabled: boolean) => {
    await ctx.database.set('liteloader_script', id, { enabled, updatedAt: Date.now() })
    await getService()?.setScriptStateById(id, enabled)
  }, { authority: 5 })

  ctx.console.addListener('reload-liteloader-script', async (id: number) => {
    await getService()?.reloadScriptById(id)
  }, { authority: 5 })

  ctx.console.addListener('check-liteloader-script', async (data) => {
    const error = getService()?.loader.checkSyntax(data.code || '', data.format || 'auto')
    if (error) return { ok: false, error }
    return { ok: true }
  }, { authority: 5 })
}
