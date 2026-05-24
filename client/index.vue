<template>
  <k-layout class="lite-page">
    <template #header>
      LiteLoader - {{ currentItem?.name || '未选择脚本' }}
    </template>

    <template #left>
      <div class="left-pane">
        <div class="create-row">
          <k-button @click="createScript">新建脚本</k-button>
        </div>
        <div class="list-wrap">
          <div
            v-for="item in scripts"
            :key="item.id"
            class="list-item"
            :class="{ active: item.id === currentId }"
            @click="selectScript(item.id)"
          >
            <div class="title">{{ item.name }}</div>
            <div class="meta">
              <span>{{ item.format }}</span>
              <span>{{ item.enabled ? '启用' : '禁用' }}</span>
              <span v-if="item.lastError" class="error">错误</span>
            </div>
          </div>
          <k-empty v-if="!scripts.length">暂无脚本</k-empty>
        </div>
      </div>
    </template>

    <div class="main-pane" v-if="currentId != null">
      <div class="toolbar">
        <input class="name-input" v-model="name" @change="renameScript" placeholder="脚本名称" />
        <select v-model="format" class="format">
          <option value="auto">auto</option>
          <option value="esm">esm</option>
          <option value="cjs">cjs</option>
        </select>
        <div class="spacer"></div>
        <k-button @click="saveScript">保存</k-button>
        <k-button @click="checkSyntax">语法检查</k-button>
        <k-button @click="reloadScript">重载</k-button>
        <k-button @click="toggleState">{{ currentEnabled ? '禁用' : '启用' }}</k-button>
        <k-button class="danger" @click="deleteScript">删除</k-button>
      </div>

      <div class="status-panel" v-if="checkError">
        <div class="status-title">
          语法检查结果
          <button class="copy-btn" @click="copyError(checkError)">复制报错</button>
        </div>
        <pre>{{ checkError }}</pre>
      </div>

      <div class="editor-wrap">
        <div class="editor-head">
          <span>代码</span>
          <span class="hint">支持 ESM/CJS，建议导出 apply(ctx)</span>
        </div>
        <div class="editor-body">
          <pre ref="codeHighlight" class="code-highlight" aria-hidden="true"><code class="hljs language-javascript" v-html="highlightedCode"></code></pre>
          <textarea ref="codeInput" class="code" v-model="code" spellcheck="false" @scroll="syncHighlightScroll" />
        </div>
      </div>

      <div class="error-panel" v-if="currentError">
        <div class="error-title">
          最近一次加载错误
          <button class="copy-btn" @click="copyError(currentError)">复制报错</button>
        </div>
        <pre>{{ currentError }}</pre>
      </div>
    </div>

    <k-empty v-else class="empty-stage">
      在左侧选择或创建一个脚本
    </k-empty>
  </k-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { send, store } from '@koishijs/client'
import 'highlight.js/styles/stackoverflow-light.css'
import highlight from 'highlight.js/lib/common'
import JavaScript from 'highlight.js/lib/languages/javascript'

highlight.registerLanguage('javascript', JavaScript)

const currentId = ref<number | null>(null)
const code = ref('')
const codeInput = ref<HTMLTextAreaElement | null>(null)
const codeHighlight = ref<HTMLElement | null>(null)
const format = ref<'auto' | 'esm' | 'cjs'>('auto')
const name = ref('')

const scripts = computed(() => (store.liteloader || []) as any[])
const currentItem = computed(() => scripts.value.find(item => item.id === currentId.value))
const currentEnabled = computed(() => !!currentItem.value?.enabled)
const currentError = computed(() => currentItem.value?.lastError || '')
const checkError = ref('')
const pageError = ref('')
const highlightedCode = computed(() => {
  try {
    const result = highlight.highlight(code.value || '', { language: 'javascript', ignoreIllegals: true }).value
    return result + '\n'
  } catch (error) {
    pageError.value = `高亮渲染失败: ${error?.message || String(error)}`
    return (code.value || '') + '\n'
  }
})

function syncHighlightScroll() {
  const input = codeInput.value
  const output = codeHighlight.value
  if (!input || !output) return
  output.scrollTop = input.scrollTop
  output.scrollLeft = input.scrollLeft
}

watch(scripts, async (value) => {
  if (!Array.isArray(value) || !value.length) {
    currentId.value = null
    return
  }
  if (currentId.value == null || !value.find(item => item.id === currentId.value)) {
    try {
      await selectScript(value[0].id)
    } catch (error) {
      pageError.value = `加载脚本失败: ${error?.message || String(error)}`
    }
  }
}, { immediate: true })

async function createScript() {
  try {
    const id = await send('create-liteloader-script')
    await selectScript(Number(id))
  } catch (error) {
    pageError.value = `创建脚本失败: ${error?.message || String(error)}`
  }
}

async function selectScript(id: number) {
  currentId.value = id
  const data = await send('load-liteloader-script', id)
  code.value = data.code
  format.value = data.format
  name.value = data.name
  pageError.value = ''
}

async function saveScript(reload = true) {
  if (currentId.value == null) return
  await send('save-liteloader-script', currentId.value, {
    code: code.value,
    format: format.value,
    name: name.value,
    reload,
  })
}

async function renameScript() {
  if (currentId.value == null) return
  await send('rename-liteloader-script', currentId.value, name.value)
}

async function reloadScript() {
  if (currentId.value == null) return
  await saveScript(false)
  await send('reload-liteloader-script', currentId.value)
}

async function checkSyntax() {
  try {
    const result = await send('check-liteloader-script', {
      code: code.value,
      format: format.value,
    })
    checkError.value = result.ok ? '语法检查通过。' : (result.error || '语法检查失败')
  } catch (error) {
    checkError.value = `语法检查请求失败: ${error?.message || String(error)}`
  }
}

async function toggleState() {
  if (currentId.value == null) return
  await saveScript(false)
  const next = !currentEnabled.value
  await send('set-liteloader-script-state', currentId.value, next)
  const item = scripts.value.find(item => item.id === currentId.value)
  if (item) item.enabled = next
}

async function deleteScript() {
  if (currentId.value == null) return
  const id = currentId.value
  await send('delete-liteloader-script', id)
  const list = scripts.value
  const index = list.findIndex(item => item.id === id)
  if (index >= 0) list.splice(index, 1)
  const next = list[index] || list[index - 1]
  if (next) {
    await selectScript(next.id)
  } else {
    currentId.value = null
    code.value = ''
    name.value = ''
    format.value = 'auto'
  }
}

async function copyError(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const node = document.createElement('textarea')
    node.value = text
    document.body.appendChild(node)
    node.select()
    document.execCommand('copy')
    document.body.removeChild(node)
  }
}
</script>

<style scoped lang="scss">
.lite-page {
  height: 100%;
}

.left-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
}

.create-row {
  padding: 10px;
  border-bottom: 1px solid var(--border);
}

.list-wrap {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.list-item {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  background: var(--bg2);

  &.active {
    border-color: var(--primary);
    background: var(--bg3);
  }
}

.title {
  font-weight: 600;
  color: var(--fg0);
  line-height: 1.4;
}

.meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--fg2);
}

.meta .error {
  color: var(--danger);
}

.main-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg2);
}

.name-input,
.format {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg1);
  color: var(--fg0);
  padding: 0 10px;
}

.name-input {
  width: 260px;
}

.spacer {
  flex: 1;
}

.danger {
  color: var(--danger);
}

.editor-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg2);
  display: flex;
  flex-direction: column;
}

.editor-head {
  height: 34px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  color: var(--fg1);
  font-size: 13px;
}

.hint {
  color: var(--fg2);
  font-size: 12px;
}

.code {
  position: absolute;
  inset: 0;
  width: 100%;
  resize: none;
  border: 0;
  outline: 0;
  padding: 12px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: transparent;
  color: transparent;
  caret-color: var(--fg0);
  z-index: 2;
  white-space: pre;
  overflow: auto;
  tab-size: 2;
  user-select: text;
}

.code::selection {
  color: var(--fg0);
  background: color-mix(in srgb, var(--primary) 30%, transparent);
}

.editor-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.code-highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 12px;
  overflow: hidden;
  background: var(--bg0);
  color: var(--fg0);
  pointer-events: none;
  z-index: 1;
}

.code-highlight code {
  display: block;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  tab-size: 2;
}

.code-highlight :deep(.hljs) {
  padding: 0;
  margin: 0;
  background: transparent;
}

.error-panel {
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  background: color-mix(in srgb, var(--danger) 8%, var(--bg1));
  border-radius: 8px;
  padding: 8px 10px;
}

.status-panel {
  border: 1px solid var(--border);
  background: var(--bg2);
  border-radius: 8px;
  padding: 8px 10px;
}

.status-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fg1);
  margin-bottom: 6px;
}

.status-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 80px;
  overflow: auto;
  color: var(--fg1);
  font-size: 12px;
}

.error-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--danger);
  margin-bottom: 6px;
}

.copy-btn {
  border: 1px solid var(--border);
  background: var(--bg1);
  color: var(--fg1);
  border-radius: 4px;
  height: 22px;
  padding: 0 8px;
  cursor: pointer;
}

.error-panel pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow: auto;
  color: var(--fg1);
  font-size: 12px;
}

.empty-stage {
  height: 100%;
}

@media (max-width: 960px) {
  .toolbar {
    flex-wrap: wrap;
  }

  .name-input {
    width: 100%;
  }

  .spacer {
    display: none;
  }

}
</style>
