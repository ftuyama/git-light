import { execFile, spawn } from 'node:child_process'
import { classifyGitError, GitError } from '@shared/git/errors'

export interface RunOptions {
  cwd: string
  signal?: AbortSignal
  /** Resolve instead of throwing on a non-zero exit code. */
  allowFailure?: boolean
  /** Override the default 30s timeout (ms). 0 disables the timeout. */
  timeout?: number
  /** Extra environment variables. */
  env?: Record<string, string>
  /** Max stdout buffer in bytes (default 200 MB for large logs/diffs). */
  maxBuffer?: number
  /** UTF-8 payload written to stdin before the process closes. */
  input?: string
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

const DEFAULT_TIMEOUT = 30_000
const DEFAULT_MAX_BUFFER = 200 * 1024 * 1024

/**
 * Thin wrapper around the system `git` binary. Every invocation uses an
 * argument array (never a shell string) to eliminate command injection. The
 * caller always supplies the repository cwd.
 */
export class GitCliProvider {
  /** Common args applied to every invocation for stable, parseable output. */
  private baseArgs(): string[] {
    return ['-c', 'core.quotepath=false', '-c', 'color.ui=false']
  }

  private childEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
    return {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
      LC_ALL: 'C',
      ...extra,
    }
  }

  /** Buffered invocation. Throws a typed {@link GitError} on failure. */
  run(args: string[], options: RunOptions): Promise<RunResult> {
    const { cwd, signal, allowFailure, timeout, env, maxBuffer, input } = options
    const fullArgs = [...this.baseArgs(), ...args]

    if (input !== undefined) {
      return this.runWithStdin(fullArgs, input, {
        cwd,
        signal,
        allowFailure,
        timeout,
        env,
        maxBuffer,
      })
    }

    return new Promise<RunResult>((resolve, reject) => {
      execFile(
        'git',
        fullArgs,
        {
          cwd,
          signal,
          timeout: timeout ?? DEFAULT_TIMEOUT,
          maxBuffer: maxBuffer ?? DEFAULT_MAX_BUFFER,
          env: this.childEnv(env),
          windowsHide: true,
          encoding: 'utf8',
        },
        (error, stdout, stderr) => {
          const out = stdout ?? ''
          const err = stderr ?? ''

          if (error == null) {
            resolve({ stdout: out, stderr: err, exitCode: 0 })
            return
          }

          if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR' || signal?.aborted) {
            reject(new GitError('Cancelled', 'The operation was cancelled.'))
            return
          }

          const exitCode = typeof error.code === 'number' ? error.code : null

          if (allowFailure) {
            resolve({ stdout: out, stderr: err, exitCode })
            return
          }

          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(
              new GitError('Unknown', 'Git is not installed or not on PATH.', {
                detail: 'Install Git and ensure the `git` command is available.',
              }),
            )
            return
          }

          reject(classifyGitError(err || out, exitCode))
        },
      )
    })
  }

  private runWithStdin(
    fullArgs: string[],
    stdin: string,
    options: Omit<RunOptions, 'input'>,
  ): Promise<RunResult> {
    const { cwd, signal, allowFailure, timeout, env } = options

    return new Promise<RunResult>((resolve, reject) => {
      const child = spawn('git', fullArgs, {
        cwd,
        signal,
        env: this.childEnv(env),
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer =
        timeout === 0
          ? null
          : setTimeout(() => {
              timedOut = true
              child.kill()
            }, timeout ?? DEFAULT_TIMEOUT)

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (timer) clearTimeout(timer)
        if (error.code === 'ABORT_ERR' || signal?.aborted) {
          reject(new GitError('Cancelled', 'The operation was cancelled.'))
        } else if (error.code === 'ENOENT') {
          reject(new GitError('Unknown', 'Git is not installed or not on PATH.'))
        } else {
          reject(new GitError('Unknown', error.message))
        }
      })

      child.on('close', (code) => {
        if (timer) clearTimeout(timer)
        if (signal?.aborted) {
          reject(new GitError('Cancelled', 'The operation was cancelled.'))
          return
        }
        if (timedOut) {
          reject(new GitError('Unknown', 'Git command timed out.'))
          return
        }
        if (code === 0 || allowFailure) {
          resolve({ stdout, stderr, exitCode: code })
        } else {
          reject(classifyGitError(stderr || stdout, code))
        }
      })

      child.stdin?.write(stdin)
      child.stdin?.end()
    })
  }

  /**
   * Streaming invocation for long-running remote operations. Progress lines are
   * delivered via {@link onLine} (git writes progress to stderr).
   */
  runStreaming(
    args: string[],
    options: RunOptions,
    onLine?: (line: string, stream: 'stdout' | 'stderr') => void,
  ): Promise<RunResult> {
    const { cwd, signal, allowFailure, env } = options
    const fullArgs = [...this.baseArgs(), ...args, '--progress']

    return new Promise<RunResult>((resolve, reject) => {
      const child = spawn('git', fullArgs, {
        cwd,
        signal,
        env: this.childEnv(env),
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''

      const pump = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
        const text = chunk.toString('utf8')
        if (stream === 'stdout') stdout += text
        else stderr += text
        if (onLine) {
          for (const line of text.split(/\r?\n|\r/)) {
            if (line.trim()) onLine(line.trim(), stream)
          }
        }
      }

      child.stdout?.on('data', (c: Buffer) => pump(c, 'stdout'))
      child.stderr?.on('data', (c: Buffer) => pump(c, 'stderr'))

      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ABORT_ERR' || signal?.aborted) {
          reject(new GitError('Cancelled', 'The operation was cancelled.'))
        } else if (error.code === 'ENOENT') {
          reject(new GitError('Unknown', 'Git is not installed or not on PATH.'))
        } else {
          reject(new GitError('Unknown', error.message))
        }
      })

      child.on('close', (code) => {
        if (signal?.aborted) {
          reject(new GitError('Cancelled', 'The operation was cancelled.'))
          return
        }
        if (code === 0 || allowFailure) {
          resolve({ stdout, stderr, exitCode: code })
        } else {
          reject(classifyGitError(stderr || stdout, code))
        }
      })
    })
  }
}

export const gitCli = new GitCliProvider()
