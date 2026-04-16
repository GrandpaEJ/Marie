// shell — run a shell command (safe: false — blocked unless safeMode=false)
import type { Tool } from '../src/types.ts'

export const shell: Tool = {
  name: 'shell',
  description: 'Execute a shell command and return stdout/stderr',
  safe: false, // intentionally unsafe — enable by setting agent safeMode=false
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run' },
    },
    required: ['command'],
  },
  async run({ command }) {
    const proc = Bun.spawn(['sh', '-c', command as string], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const code = await proc.exited
    return [`exit=${code}`, out && `stdout:\n${out}`, err && `stderr:\n${err}`]
      .filter(Boolean)
      .join('\n')
      .trim()
  },
}
