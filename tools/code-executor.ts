// Safe code execution tool - runs Python/JS in isolated subprocess
// WARNING: This is inherently dangerous. Only use with safeMode=false and trusted inputs.
import type { Tool } from '../src/types.ts'

interface ExecutorOptions {
  language: 'python' | 'javascript' | 'bun'
  timeout?: number
  memoryLimit?: number // MB
}

const PYTHON_TIMEOUT = 30_000
const JS_TIMEOUT = 10_000

async function runPython(code: string, timeout: number): Promise<string> {
  const proc = Bun.spawn(['python3', '-c', code], {
    timeout,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = await new Response(proc.stdout).text()
  const error = await new Response(proc.stderr).text()

  if (error && !error.includes('Traceback')) {
    return `Error:\n${error}`
  }
  return output || '(no output)'
}

async function runJavaScript(code: string, timeout: number): Promise<string> {
  const proc = Bun.spawn(['bun', '-e', code], {
    timeout,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = await new Response(proc.stdout).text()
  const error = await new Response(proc.stderr).text()

  if (error) {
    return `Error:\n${error}`
  }
  return output || '(no output)'
}

export const codeExecutor: Tool = {
  name: 'execute_code',
  description: 'Execute Python or JavaScript code and return the output. Use for calculations, data processing, or running algorithms. Returns stdout. WARNING: Only use with trusted inputs.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to execute',
      },
      language: {
        type: 'string',
        enum: ['python', 'javascript'],
        description: 'Programming language',
        default: 'javascript',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (max 60000)',
        default: 10000,
      },
    },
    required: ['code'],
  },
  safe: false, // Requires safeMode=false

  async run(params: Record<string, unknown>) {
    const code = params.code as string
    if (!code) return 'Error: missing code parameter'

    const language = (params.language as string) || 'javascript'
    const timeout = Math.min((params.timeout as number) || JS_TIMEOUT, 60_000)

    // Security: basic code inspection
    const dangerous = [
      'import subprocess',
      'import os',
      '__import__',
      'eval(',
      'exec(',
      'spawn',
      'fork',
      'rm -',
      'wget',
      'curl ',
      'open(',
      'write(',
      'fs.',
      'process.',
    ]

    const codeLower = code.toLowerCase()
    for (const pattern of dangerous) {
      if (codeLower.includes(pattern.toLowerCase())) {
        return `Error: Potentially dangerous code pattern detected: "${pattern}". For safety, this operation is blocked.`
      }
    }

    try {
      if (language === 'python') {
        return await runPython(code, timeout)
      } else {
        return await runJavaScript(code, timeout)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `Execution error: ${msg}`
    }
  },
  timeoutMs: 60_000,
  retries: 0,
}