// file_read (safe) + file_write (unsafe)
import type { Tool } from '../src/types.ts'

export const fileRead: Tool = {
  name: 'file_read',
  description: 'Read a file from disk and return its contents',
  safe: true,
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative file path' },
    },
    required: ['path'],
  },
  async run({ path }) {
    return await Bun.file(path as string).text()
  },
}

export const fileWrite: Tool = {
  name: 'file_write',
  description: 'Write (or overwrite) a file on disk',
  safe: false, // can clobber files — unsafe by design
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  async run({ path, content }) {
    await Bun.write(path as string, content as string)
    return `written: ${path}`
  },
}
