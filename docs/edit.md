# Drag Handle vue extension

Have you ever wanted to drag nodes around your vue-based editor? Well, we did too—so here's an extension for that.

The `DragHandleVue` component allows you to easily handle dragging nodes around in the editor. You can define custom render functions, placement, and more. It essentially wraps the [DragHandle](/docs/editor/extensions/functionality/drag-handle) extension in a vue component that will automatically register/unregister the extension with the editor.

## [](#install)Install

```
npm install @tiptap/extension-drag-handle-vue-3 @tiptap/extension-drag-handle @tiptap/extension-node-range @tiptap/extension-collaboration @tiptap/y-tiptap yjs y-protocols
```

### Vue 2 vs. Vue 3

There are two versions of the DragHandle extension available. Make sure to install the correct version for your Vue version. `@tiptap/extension-drag-handle-vue-2` and `@tiptap/extension-drag-handle-vue-3`

## [](#props)Props

All props follow the same structure as the [DragHandle](/docs/editor/extensions/functionality/drag-handle) extension.

### [](#children)children

The content that should be displayed inside of the drag handle.

```
<drag-handle>
  <div>Drag Me!</div>
</drag-handle>
```

### [](#computepositionconfig)computePositionConfig

Configuration for position computation of the drag handle using the floating-ui/dom package. You can pass any options that are available in the [floating-ui documentation](https://floating-ui.com/docs/computePosition).

Default: `{ placement: 'left-start', strategy: 'absolute' }`

```
<drag-handle :compute-position-config="{ placement: 'left', strategy: 'fixed' }">
  <div>Drag Me!</div>
</drag-handle>
```

### [](#onnodechange)onNodeChange

Returns a node or null when a node is hovered over. This can be used to highlight the node that is currently hovered over.

Default: `undefined`

```
<template>
  <drag-handle @nodeChange="handleNodeChange">
    <div>Drag Me!</div>
  </drag-handle>
</template>

<script>
import { ref } from 'vue'
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'

export default {
  components: {
    DragHandle,
  },
  setup() {
    const selectedNode = ref(null)

    const handleNodeChange = ({ node, editor, pos }) => {
      selectedNode.value = node
      // do something with the node
    }

    return {
      selectedNode,
      handleNodeChange,
    }
  },
}
</script>
```

### [](#getreferencedvirtualelement)getReferencedVirtualElement

A function that returns the virtual element for the drag handle. This is useful when the menu needs to be positioned relative to a specific DOM element.

Default: `undefined`

```
<template>
  <drag-handle :get-referenced-virtual-element="getVirtualElement">
    <div>Drag Me!</div>
  </drag-handle>
</template>

<script>
export default {
  setup() {
    const getVirtualElement = () => {
      // Return a virtual element for custom positioning
      return null
    }

    return {
      getVirtualElement,
    }
  },
}
</script>
```

### [](#locked)locked

Locks the draghandle in place and visibility. If the drag handle was visible, it will remain visible until unlocked. If it was hidden, it will remain hidden until unlocked.

Default: `false`

```
<drag-handle :locked="true">
  <div>Drag Me!</div>
</drag-handle>
```

### [](#pluginkey)pluginKey

The key that should be used to store the plugin in the editor. This is useful if you have multiple drag handles in the same editor.

Default: `undefined`

```
<drag-handle pluginKey="myCustomDragHandle">
  <div>Drag Me!</div>
</drag-handle>
```

### [](#nested)nested

Enable drag handles for nested content such as list items, blockquotes, and other nested structures.

When enabled, the drag handle will appear for nested blocks, not just top-level blocks. A rule-based scoring system determines which node to target based on cursor position and configured rules.

Default: `false`

### Avoiding Re-renders

When passing an object to the `nested` prop, always define it as a constant outside your component. Inline objects or objects created in computed properties will cause the plugin to reinitialize on every render cycle, leading to performance issues.

```
<template>
  <drag-handle :editor="editor" :nested="NESTED_CONFIG">
    <div>Drag Me!</div>
  </drag-handle>
</template>

<script>
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'

// Define config as a constant OUTSIDE the component
const NESTED_CONFIG = { edgeDetection: { threshold: -16 } }

export default {
  components: { DragHandle },
  data() {
    return {
      // Expose the constant to the template
      NESTED_CONFIG,
    }
  },
}
</script>
```

For simple boolean enabling without custom configuration:

```
<drag-handle :nested="true">
  <div>Drag Me!</div>
</drag-handle>
```

#### [](#full-example-with-toggle-support)Full Example with Toggle Support

```
<template>
  <div v-if="editor">
    <button @click="nested = !nested">Toggle nested</button>
    <drag-handle :editor="editor" :nested="nestedOptions">
      <div class="drag-handle" />
    </drag-handle>
  </div>
  <editor-content :editor="editor" />
</template>

<script>
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Editor, EditorContent } from '@tiptap/vue-3'

// Define config as a constant OUTSIDE the component to prevent re-renders
const NESTED_CONFIG = { edgeDetection: { threshold: -16 } }

export default {
  components: {
    EditorContent,
    DragHandle,
  },
  data() {
    return {
      editor: null,
      nested: true,
    }
  },
  computed: {
    nestedOptions() {
      // Return the constant reference, not a new object
      return this.nested ? NESTED_CONFIG : false
    },
  },
  mounted() {
    this.editor = new Editor({
      extensions: [StarterKit],
      content: '<ul><li>Item 1</li><li>Item 2</li></ul>',
    })
  },
  beforeUnmount() {
    this.editor?.destroy()
  },
}
</script>
```

See the [DragHandle nested documentation](/docs/editor/extensions/functionality/drag-handle#nested-drag-handle) for detailed configuration options including edge detection, custom rules, and allowed containers.

### [](#commands)Commands

See the [DragHandle](/docs/editor/extensions/functionality/drag-handle) extension for available editor commands.
