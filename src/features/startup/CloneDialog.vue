<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{ open: boolean; busy: boolean }>()

const emit = defineEmits<{
  close: []
  submit: [{ url: string; parentPath: string; name: string }]
}>()

const { t } = useI18n()

const url = ref('')
const parentPath = ref('')
const name = ref('')
const error = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      error.value = ''
    }
  },
)

async function pickParent(): Promise<void> {
  try {
    const picked = await openFolderDialog({ directory: true, multiple: false })
    if (typeof picked === 'string') parentPath.value = picked
  } catch (err) {
    console.error('[git-light] folder pick failed:', err)
  }
}

function onSubmit(): void {
  if (!url.value.trim()) {
    error.value = t('shell.clone.urlRequired')
    return
  }
  if (!parentPath.value.trim()) {
    error.value = t('shell.clone.destinationRequired')
    return
  }
  error.value = ''
  emit('submit', { url: url.value.trim(), parentPath: parentPath.value.trim(), name: name.value.trim() })
}
</script>

<template>
  <Dialog :open="open" :title="t('shell.clone.title')" @confirm="onSubmit" @cancel="emit('close')">
    <label class="block text-xs font-medium text-[var(--color-fg-muted)]">
      {{ $t('shell.clone.url') }}
      <input
        v-model="url"
        type="text"
        placeholder="https://github.com/org/repo.git"
        spellcheck="false"
        class="focus-ring mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
        @keydown.enter="onSubmit"
      />
    </label>
    <label class="block text-xs font-medium text-[var(--color-fg-muted)]">
      {{ $t('shell.clone.destination') }}
      <div class="mt-1 flex gap-2">
        <input
          v-model="parentPath"
          type="text"
          placeholder="/Users/you/Projects"
          spellcheck="false"
          class="focus-ring min-w-0 flex-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
        />
        <Button size="sm" @click="pickParent">{{ $t('shell.browse') }}</Button>
      </div>
    </label>
    <label class="block text-xs font-medium text-[var(--color-fg-muted)]">
      {{ $t('shell.clone.folderName') }}
      <span class="font-normal">{{ $t('shell.clone.folderNameHint') }}</span>
      <input
        v-model="name"
        type="text"
        placeholder="repo"
        spellcheck="false"
        class="focus-ring mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
        @keydown.enter="onSubmit"
      />
    </label>
    <p class="text-xs text-[var(--color-fg-muted)]">
      {{ $t('shell.clone.authHint') }}
    </p>
    <p v-if="error" class="text-xs text-[var(--color-danger)]">{{ error }}</p>

    <template #footer>
      <Button variant="ghost" :disabled="busy" @click="emit('close')">{{ $t('common.actions.cancel') }}</Button>
      <Button variant="primary" :busy="busy" :disabled="busy" @click="onSubmit">
        {{ busy ? $t('shell.clone.busy') : $t('shell.clone.submit') }}
      </Button>
    </template>
  </Dialog>
</template>
