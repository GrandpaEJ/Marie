// JSON Persistence Adapter
// Saves and loads MemorySnapshot to a local JSON file using Bun's native file API.

import type { MemoryPersist, MemorySnapshot } from '../types.ts'

export class JSONAdapter implements MemoryPersist {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    await Bun.write(this.filePath, JSON.stringify(snapshot, null, 2))
  }

  async load(): Promise<MemorySnapshot | null> {
    const file = Bun.file(this.filePath)
    if (!(await file.exists())) return null

    try {
      const text = await file.text()
      return JSON.parse(text) as MemorySnapshot
    } catch {
      return null
    }
  }
}
