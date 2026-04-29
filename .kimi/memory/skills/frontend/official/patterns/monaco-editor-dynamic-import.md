# [Draft] Monaco Editor Dynamic Import

> 来源: TICKET-FEAT-006b | 创建: 2026-04-27 | 考察期: 2026-05-27

## 场景

Vue 3/Nuxt 3 集成 Monaco Editor，完整包 ~40MB，需按需加载。

## 代码

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const editorContainer = ref<HTMLDivElement>();
let editor: any = null;

onMounted(async () => {
  const monaco = await import('monaco-editor');
  editor = monaco.editor.create(editorContainer.value!, {
    value: props.modelValue,
    language: props.language,
    theme: 'vs-dark',
    automaticLayout: true,
  });
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue());
  });
});

watch(() => props.modelValue, (newVal) => {
  if (editor && editor.getValue() !== newVal) {
    editor.setValue(newVal);
  }
});
</script>
```

## 关键设计

1. **动态导入拆分 chunk**: `import('monaco-editor')` 而非顶层 import，Webpack/Vite 自动拆分
2. **diff guards 避免 watcher 风暴**: `getValue() !== newVal` 后再 `setValue`，否则外部 modelValue 更新 → setValue → onDidChangeModelContent → emit → 无限循环
3. **SSR 安全**: 必须在 `onMounted` 中初始化

## 注意

- 销毁时调用 `editor.dispose()` 避免内存泄漏
- 语言贡献文件需单独导入，否则语法高亮不生效
