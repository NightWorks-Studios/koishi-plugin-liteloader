import { Context } from '@koishijs/client'
import Page from './index.vue'

export default (ctx: Context) => {
  ctx.page({
    name: 'LiteLoader 脚本',
    path: '/liteloader',
    authority: 3,
    component: Page,
  })
}
