import { Context, icons } from '@koishijs/client'
import Page from './index.vue'
import Activity from './icons/activity.vue'

icons.register('liteloader', Activity)

export default (ctx: Context) => {
  ctx.page({
    name: 'LiteLoader',
    path: '/liteloader',
    icon: 'liteloader',
    authority: 5,
    component: Page,
    fields: ['liteloader'],
  })
}
