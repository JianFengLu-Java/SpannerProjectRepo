<template>
  <div v-if="editor" class="editor-root">
    <div class="toolbar">
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button @click="editor.chain().focus().toggleBold().run()">Bold</button>
      <button
        @click="editor.chain().focus().toggleBulletList().run()"
        :class="{ 'is-active': editor.isActive('bulletList') }"
      >
        Bullet list
      </button>

      <button @click="editor.chain().focus().lockDragHandle().run()">Lock drag handle</button>
      <button @click="editor.chain().focus().unlockDragHandle().run()">Unlock drag handle</button>
      <button @click="editor.chain().focus().toggleDragHandle().run()">Toggle drag handle</button>
      <button @click="editor.setEditable(!editor.isEditable)">Toggle editable</button>
      <button @click="nested = !nested">Toggle nested</button>

      <input
        class="title-input"
        :value="localTitle"
        placeholder="未标题云文档"
        @input="onTitleInput"
      />
    </div>

    <drag-handle :editor="editor" :nested="nestedOptions">
      <div class="custom-drag-handle" />
    </drag-handle>
  </div>

  <editor-content :editor="editor" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'
import Image from '@tiptap/extension-image'
import NodeRange from '@tiptap/extension-node-range'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import type { JSONContent } from '@tiptap/core'
import type { CloudDoc, CloudDocSaveState } from '@renderer/types/cloudDoc'

const NESTED_CONFIG = { edgeDetection: { threshold: -16 } }

const props = defineProps<{
  doc: CloudDoc
  saveState: CloudDocSaveState
  saveErrorMessage: string
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:content', payload: { contentHtml: string; contentJson: string }): void
}>()

const nested = ref(true)
const localTitle = ref(props.doc.title)

const nestedOptions = computed(() => {
  return nested.value ? NESTED_CONFIG : false
})

const readJson = (value: string): JSONContent | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as JSONContent
  } catch {
    return null
  }
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Image.configure({ inline: false }),
    NodeRange.configure({
      key: null,
    }),
    TableKit,
  ],
  content: readJson(props.doc.contentJson) || props.doc.contentHtml || '<p></p>',
  onUpdate: ({ editor }) => {
    emit('update:content', {
      contentHtml: editor.getHTML(),
      contentJson: JSON.stringify(editor.getJSON()),
    })
  },
})

const onTitleInput = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  localTitle.value = value
  emit('update:title', value)
}

watch(
  () => props.doc.id,
  () => {
    localTitle.value = props.doc.title
    if (!editor.value) return
    const parsed = readJson(props.doc.contentJson)
    if (parsed) {
      editor.value.commands.setContent(parsed, { emitUpdate: false })
      return
    }
    editor.value.commands.setContent(props.doc.contentHtml || '<p></p>', { emitUpdate: false })
  },
)

watch(
  () => props.doc.title,
  value => {
    if (value === localTitle.value) return
    localTitle.value = value
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
::selection {
  background-color: #70cff850;
}

.editor-root {
  position: relative;
  -webkit-app-region: no-drag;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  -webkit-app-region: no-drag;
}

.title-input {
  min-width: 220px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

button.is-active {
  background: #e8f2ff;
}

:deep(.ProseMirror) {
  padding: 1rem 1rem 1rem 0;
  -webkit-app-region: no-drag;
}

:deep(.ProseMirror *) {
  margin-top: 0.75em;
}

:deep(.ProseMirror > *) {
  margin-left: 3rem;
}

:deep(.ProseMirror .ProseMirror-widget *) {
  margin-top: auto;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding: 0 1rem;
}

:deep(.ProseMirror-noderangeselection *::selection) {
  background: transparent;
}

:deep(.ProseMirror-noderangeselection *) {
  caret-color: transparent;
}

:deep(.ProseMirror-selectednode),
:deep(.ProseMirror-selectednoderange) {
  position: relative;
}

:deep(.ProseMirror-selectednode)::before,
:deep(.ProseMirror-selectednoderange)::before {
  position: absolute;
  pointer-events: none;
  z-index: -1;
  content: '';
  top: -0.25rem;
  left: -0.25rem;
  right: -0.25rem;
  bottom: -0.25rem;
  background-color: #70cff850;
  border-radius: 0.2rem;
}

:deep(.custom-drag-handle)::after {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1.25rem;
  content: '⠿';
  font-weight: 700;
  cursor: grab;
  background: #0d0d0d10;
  color: #0d0d0d50;
  border-radius: 0.25rem;
  -webkit-app-region: no-drag;
}
</style>
