<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{ open: boolean; busy: boolean }>()

const emit = defineEmits<{
  close: []
  submit: [{ path: string; defaultBranch: string }]
}>()

const { t } = useI18n()

const folder = ref('')
const branch = ref('')
const error = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      error.value = ''
    }
  },
)

async function pickFolder(): Promise<void> {
  try {
    const picked = await openFolderDialog({ directory: true, multiple: false })
    if (typeof picked === 'string') folder.value = picked
  } catch (err) {
    console.error('[git-light] folder pick failed:', err)
  }
}

function onSubmit(): void {
  if (!folder.value.trim()) {
    error.value = t('shell.init.folderRequired')
    return
  }
  error.value = ''
  emit('submit', { path: folder.value.trim(), defaultBranch: branch.value.trim() })
}
</script>

<template>
  <Dialog :open="open" :title="t('shell.init.title')" @confirm="onSubmit" @cancel="emit('close')">
    <label class="block text-xs font-medium text-[var(--color-fg-muted)]">
      {{ $t('shell.init.folder') }}
      <div class="mt-1 flex gap-2">
        <input
          v-model="folder"
          type="text"
          placeholder="/Users/you/Projects/new-repo"
          spellcheck="false"
          class="focus-ring min-w-0 flex-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
        />
        <Button size="sm" @click="pickFolder">{{ $t('shell.browse') }}</Button>
      </div>
    </label>
    <label class="block text-xs font-medium text-[var(--color-fg-muted)]">
      {{ $t('shell.init.initialBranch') }}
      <span class="font-normal">{{ $t('shell.init.initialBranchHint') }}</span>
      <input
        v-model="branch"
        type="text"
        placeholder="main"
        spellcheck="false"
        class="focus-ring mt-1 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
        @keydown.enter="onSubmit"
      />
    </label>
    <p v-if="error" class="text-xs text-[var(--color-danger)]">{{ error }}</p>

    <template #footer>
      <Button variant="ghost" :disabled="busy" @click="emit('close')">{{ $t('common.actions.cancel') }}</Button>
      <Button variant="primary" :busy="busy" :disabled="busy" @click="onSubmit">
        {{ busy ? $t('shell.init.busy') : $t('shell.init.submit') }}
      </Button>
    </template>
  </Dialog>
</template>
