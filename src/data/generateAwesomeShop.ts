import { githubAvatarUrl, initialsFor } from '@shared/git/avatar'
import { faker } from '@faker-js/faker'
import type {
  Author,
  Branch,
  Commit,
  Ref,
  Repository,
  RepositoryData,
  Stash,
  Tag,
  WorkingTreeFile,
  Worktree,
} from '@/types/git'

const AVATAR_COLORS = [
  '#a371f7',
  '#3fb950',
  '#58a6ff',
  '#f0883e',
  '#db61a2',
  '#e3b341',
  '#56d4dd',
  '#ff7b72',
]

function initials(name: string): string {
  return initialsFor(name)
}

function makeAuthors(count: number): Author[] {
  return Array.from({ length: count }, (_, i) => {
    const name = faker.person.fullName()
    const email = faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase()
    return {
      name,
      email,
      avatarUrl: faker.datatype.boolean({ probability: 0.35 })
        ? faker.image.avatar()
        : githubAvatarUrl(email),
      initials: initials(name),
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }
  })
}

interface BranchSpec {
  name: string
  group: string
  laneColorIndex: number
}

const LOCAL_BRANCH_SPECS: BranchSpec[] = [
  { name: 'main', group: '', laneColorIndex: 2 },
  { name: 'develop', group: '', laneColorIndex: 1 },
  { name: 'release/2.5', group: 'release', laneColorIndex: 5 },
  { name: 'release/2.4', group: 'release', laneColorIndex: 5 },
  { name: 'feature/payment', group: 'feature', laneColorIndex: 0 },
  { name: 'feature/auth', group: 'feature', laneColorIndex: 3 },
  { name: 'feature/mobile', group: 'feature', laneColorIndex: 6 },
  { name: 'feature/search', group: 'feature', laneColorIndex: 4 },
  { name: 'feature/checkout', group: 'feature', laneColorIndex: 7 },
  { name: 'feature/notifications', group: 'feature', laneColorIndex: 0 },
  { name: 'feature/analytics', group: 'feature', laneColorIndex: 6 },
  { name: 'hotfix/login', group: 'hotfix', laneColorIndex: 7 },
  { name: 'hotfix/cart-crash', group: 'hotfix', laneColorIndex: 7 },
  { name: 'chore/deps-bump', group: 'chore', laneColorIndex: 1 },
  { name: 'chore/ci-cache', group: 'chore', laneColorIndex: 1 },
  { name: 'bugfix/avatar-upload', group: 'bugfix', laneColorIndex: 3 },
  { name: 'bugfix/timezone', group: 'bugfix', laneColorIndex: 3 },
  { name: 'experiment/edge-render', group: 'experiment', laneColorIndex: 4 },
  { name: 'docs/api-reference', group: 'docs', laneColorIndex: 5 },
  { name: 'refactor/state-store', group: 'refactor', laneColorIndex: 0 },
]

const CHERRY_PICK_SUBJECTS = [
  'Backport security patch from develop',
  'Cherry-pick rate limiter fix',
  'Apply hotfix for checkout rounding',
]

function sha(): string {
  return faker.git.commitSha()
}

interface BuildState {
  chrono: Commit[]
  authors: Author[]
  branchTips: Map<string, string>
}

function makeCommit(
  authors: Author[],
  parents: string[],
  date: Date,
  subject: string,
  options: { isCherryPick?: boolean } = {},
): Commit {
  const author = faker.helpers.arrayElement(authors)
  const id = sha()
  return {
    sha: id,
    shortSha: id.slice(0, 7),
    parents,
    subject,
    body: faker.datatype.boolean({ probability: 0.35 })
      ? faker.lorem.sentences({ min: 1, max: 3 })
      : undefined,
    author,
    committer: author,
    date,
    refs: [],
    isMerge: parents.length > 1,
    isCherryPick: options.isCherryPick,
  }
}

function buildHistory(authors: Author[], targetCount: number): BuildState {
  const chrono: Commit[] = []
  const branchTips = new Map<string, string>()

  let clock = faker.date.past({ years: 1 }).getTime()
  const tick = (): Date => {
    clock += faker.number.int({ min: 20 * 60 * 1000, max: 14 * 60 * 60 * 1000 })
    return new Date(clock)
  }

  // Root commit.
  const root = makeCommit(authors, [], tick(), 'Initial commit: scaffold AwesomeShop monorepo')
  chrono.push(root)
  let mainTip = root.sha
  let developTip = root.sha
  branchTips.set('main', mainTip)
  branchTips.set('develop', developTip)

  const featureBranches = LOCAL_BRANCH_SPECS.filter(
    (b) => b.name !== 'main' && b.name !== 'develop',
  )

  while (chrono.length < targetCount) {
    const roll = faker.number.float()

    if (roll < 0.18) {
      // Spin up a short-lived feature branch off develop and merge it back.
      const branch = faker.helpers.arrayElement(featureBranches)
      let tip = developTip
      const commitsOnBranch = faker.number.int({ min: 2, max: 6 })
      for (let i = 0; i < commitsOnBranch && chrono.length < targetCount; i++) {
        const c = makeCommit(authors, [tip], tick(), faker.git.commitMessage())
        chrono.push(c)
        tip = c.sha
        branchTips.set(branch.name, tip)
      }
      if (chrono.length < targetCount) {
        const merge = makeCommit(
          authors,
          [developTip, tip],
          tick(),
          `Merge branch '${branch.name}' into develop`,
        )
        chrono.push(merge)
        developTip = merge.sha
        branchTips.set('develop', developTip)
      }
    } else if (roll < 0.27) {
      // Promote develop into main via a merge (release flow).
      const merge = makeCommit(
        authors,
        [mainTip, developTip],
        tick(),
        "Merge branch 'develop' into main",
      )
      chrono.push(merge)
      mainTip = merge.sha
      branchTips.set('main', mainTip)
    } else if (roll < 0.31 && chrono.length > 20) {
      // Cherry-pick a fix onto main.
      const c = makeCommit(
        authors,
        [mainTip],
        tick(),
        faker.helpers.arrayElement(CHERRY_PICK_SUBJECTS),
        { isCherryPick: true },
      )
      chrono.push(c)
      mainTip = c.sha
      branchTips.set('main', mainTip)
    } else if (roll < 0.6) {
      // Ordinary develop commit.
      const c = makeCommit(authors, [developTip], tick(), faker.git.commitMessage())
      chrono.push(c)
      developTip = c.sha
      branchTips.set('develop', developTip)
    } else {
      // Ordinary main commit.
      const c = makeCommit(authors, [mainTip], tick(), faker.git.commitMessage())
      chrono.push(c)
      mainTip = c.sha
      branchTips.set('main', mainTip)
    }
  }

  // Give the remaining declared feature/hotfix branches a tip near the top so
  // the sidebar feels populated even if they never merged.
  for (const branch of featureBranches) {
    if (!branchTips.has(branch.name)) {
      const anchor = chrono[chrono.length - faker.number.int({ min: 1, max: 12 })]
      const tip = makeCommit(authors, [anchor.sha], tick(), faker.git.commitMessage())
      chrono.push(tip)
      branchTips.set(branch.name, tip.sha)
    }
  }

  return { chrono, authors, branchTips }
}

function attachRefs(commits: Commit[], branchTips: Map<string, string>, currentBranch: string): void {
  const byTip = new Map<string, Ref[]>()
  for (const [name, tipSha] of branchTips) {
    const list = byTip.get(tipSha) ?? []
    list.push({
      type: 'localBranch',
      name,
      label: name,
      isHead: name === currentBranch,
    })
    byTip.set(tipSha, list)
  }
  for (const commit of commits) {
    const refs = byTip.get(commit.sha)
    if (refs) commit.refs.push(...refs)
  }
}

function makeBranches(branchTips: Map<string, string>, currentBranch: string): Branch[] {
  const local = LOCAL_BRANCH_SPECS.map<Branch>((spec) => ({
    id: `local:${spec.name}`,
    name: spec.name,
    kind: 'local',
    group: spec.group,
    tipSha: branchTips.get(spec.name) ?? '',
    ahead: faker.number.int({ min: 0, max: 8 }),
    behind: faker.number.int({ min: 0, max: 6 }),
    isCurrent: spec.name === currentBranch,
    isFavorite: ['main', 'develop', 'feature/payment'].includes(spec.name),
    lastActivity: faker.date.recent({ days: 30 }),
    laneColorIndex: spec.laneColorIndex,
  }))

  const remoteNames = [
    'main',
    'develop',
    'release/2.5',
    'release/2.4',
    'feature/payment',
    'feature/auth',
    'feature/mobile',
    'feature/search',
    'feature/checkout',
    'hotfix/login',
    'chore/deps-bump',
    'bugfix/timezone',
    'docs/api-reference',
    'refactor/state-store',
    'experiment/edge-render',
  ]
  const remote = remoteNames.map<Branch>((name) => {
    const spec = LOCAL_BRANCH_SPECS.find((b) => b.name === name)
    return {
      id: `remote:origin/${name}`,
      name,
      kind: 'remote',
      group: spec?.group ?? '',
      remote: 'origin',
      tipSha: branchTips.get(name) ?? '',
      ahead: 0,
      behind: faker.number.int({ min: 0, max: 4 }),
      isCurrent: false,
      isFavorite: false,
      lastActivity: faker.date.recent({ days: 45 }),
      laneColorIndex: spec?.laneColorIndex ?? 2,
    }
  })

  return [...local, ...remote]
}

function makeTags(commits: Commit[]): Tag[] {
  const names = ['v2.5.0', 'v2.5.0-rc1', 'v2.4.0', 'v2.3.0', 'v2.2.0']
  return names.map((name, i) => {
    const commit = commits[Math.min(commits.length - 1, 10 + i * 25)]
    commit.refs.push({ type: 'tag', name, label: name })
    return {
      id: `tag:${name}`,
      name,
      sha: commit.sha,
      message: faker.git.commitMessage(),
      date: commit.date,
    }
  })
}

function makeStashes(): Stash[] {
  const messages = [
    'WIP on feature/payment: refactor checkout totals',
    'WIP on develop: experiment with new avatar uploader',
    'WIP on main: debug flaky integration test',
  ]
  return messages.map((message, index) => ({
    id: `stash@{${index}}`,
    index,
    message,
    branch: ['feature/payment', 'develop', 'main'][index],
    date: faker.date.recent({ days: 10 }),
    filesChanged: faker.number.int({ min: 1, max: 14 }),
  }))
}

function makeWorktrees(): Worktree[] {
  return [
    {
      id: 'wt:main',
      path: '~/code/awesome-shop',
      branch: 'feature/payment',
      isMain: true,
      isLocked: false,
    },
    {
      id: 'wt:release',
      path: '~/code/awesome-shop-release',
      branch: 'release/2.5',
      isMain: false,
      isLocked: true,
    },
  ]
}

const FILE_DIRECTORIES = [
  'src/components',
  'src/components/checkout',
  'src/features/payment',
  'src/features/auth',
  'src/lib/api',
  'src/lib/utils',
  'src/stores',
  'src/styles',
  'tests/unit',
  'tests/e2e',
  'public/assets',
  'docs',
  '.github/workflows',
]

const FILE_EXTENSIONS = ['ts', 'tsx', 'vue', 'css', 'json', 'md', 'svg', 'test.ts']

function makeWorkingTree(count: number): WorkingTreeFile[] {
  const files: WorkingTreeFile[] = []
  const used = new Set<string>()
  while (files.length < count) {
    const dir = faker.helpers.arrayElement(FILE_DIRECTORIES)
    const fileName = `${faker.helpers.slugify(faker.word.words({ count: { min: 1, max: 2 } }))}.${faker.helpers.arrayElement(FILE_EXTENSIONS)}`
    const path = `${dir}/${fileName}`
    if (used.has(path)) continue
    used.add(path)

    const roll = faker.number.float()
    const status =
      roll < 0.6 ? 'modified' : roll < 0.78 ? 'added' : roll < 0.9 ? 'deleted' : 'renamed'

    files.push({
      id: `file:${files.length}`,
      path,
      fileName,
      directory: dir,
      status,
      staged: faker.datatype.boolean({ probability: 0.3 }),
      additions: status === 'deleted' ? 0 : faker.number.int({ min: 0, max: 240 }),
      deletions: status === 'added' ? 0 : faker.number.int({ min: 0, max: 180 }),
      oldPath:
        status === 'renamed'
          ? `${dir}/${faker.helpers.slugify(faker.word.words(1))}.ts`
          : undefined,
    })
  }
  return files
}

export function generateAwesomeShop(commitCount = 400): RepositoryData {
  faker.seed(42)

  const currentBranch = 'feature/payment'
  const authors = makeAuthors(8)
  const { chrono, branchTips } = buildHistory(authors, commitCount)

  const commits = [...chrono].reverse()
  attachRefs(commits, branchTips, currentBranch)

  // HEAD marker on the tip of the current branch.
  const headSha = branchTips.get(currentBranch)
  const headCommit = commits.find((c) => c.sha === headSha)
  if (headCommit) headCommit.refs.unshift({ type: 'head', name: 'HEAD', label: 'HEAD' })

  const branches = makeBranches(branchTips, currentBranch)
  const tags = makeTags(commits)
  const stashes = makeStashes()
  const worktrees = makeWorktrees()
  const workingTree = makeWorkingTree(200)

  const repository: Repository = {
    name: 'AwesomeShop',
    path: '~/code/awesome-shop',
    gitVersion: '2.43.0',
    currentBranch,
    ahead: 2,
    behind: 5,
    remoteUrl: 'git@github.com:awesome-co/awesome-shop.git',
  }

  return {
    repository,
    commits,
    branches,
    tags,
    stashes,
    worktrees,
    workingTree,
    authors,
    commitAuthor: authors[0]!,
  }
}
