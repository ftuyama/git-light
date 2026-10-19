import { open } from '@tauri-apps/plugin-dialog'
import { usePromptStore } from '@/stores/prompt'
import { useRepositoryStore } from '@/stores/repository'

/**
 * Repository lifecycle commands that combine a native folder picker (or text
 * prompt) with a store action. Shared by the toolbar/repo-tab dropdowns and the
 * native menu, so the flows stay identical wherever they are triggered.
 */

/** Prompt for a directory, returning the picked path or null when cancelled. */
export async function pickFolder(): Promise<string | null> {
  try {
    const picked = await open({ directory: true, multiple: false })
    return typeof picked === 'string' ? picked : null
  } catch (err) {
    console.error('[git-light] folder pick failed:', err)
    return null
  }
}

/** Ask for a remote URL + destination, then clone into a new tab. */
export async function cloneRepository(): Promise<void> {
  const prompt = usePromptStore()
  const url = await prompt.prompt({
    title: 'Clone repository',
    message: 'Repository URL (https:// or git@host:). Auth uses your SSH keys or credential manager.',
    placeholder: 'https://github.com/org/repo.git',
    confirmLabel: 'Next',
  })
  if (!url) return
  const parentPath = await pickFolder()
  if (!parentPath) return
  await useRepositoryStore().cloneRepository({ url, parentPath })
}

/** Ask for a folder + initial branch, then initialize a repository in a new tab. */
export async function initRepository(): Promise<void> {
  const folder = await pickFolder()
  if (!folder) return
  const prompt = usePromptStore()
  const branch = await prompt.prompt({
    title: 'Initialize repository',
    message: `Initial branch for ${folder} (empty uses the git default).`,
    placeholder: 'main',
    confirmLabel: 'Initialize',
  })
  if (branch === null) return
  await useRepositoryStore().initRepository({ path: folder, defaultBranch: branch || undefined })
}

/** Pick a folder and open the best repository match inside it. */
export async function scanFolder(): Promise<void> {
  const folder = await pickFolder()
  if (!folder) return
  const repo = useRepositoryStore()
  const found = await repo.discoverRepositories(folder)
  if (found.length === 1 && found[0]) {
    await repo.openRepository(found[0].path)
  } else if (found.length > 1) {
    await repo.openRepository(found[0]?.path ?? folder)
  } else {
    await repo.openRepository(folder)
  }
}
