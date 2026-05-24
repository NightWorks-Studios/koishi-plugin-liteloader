import { Context } from '@koishijs/client'

export default (ctx: Context) => {
  ctx.page({
    name: 'LiteLoader 脚本',
    path: '/liteloader',
    authority: 3,
    component: () => import('./index.vue'),
  })
}
