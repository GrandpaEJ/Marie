// Parallel (split-and-merge) orchestration.
// Splits a task into N sub-tasks, runs them in parallel, merges results.
//
// Usage:
//   const parallel = new Parallel({ splitter, worker, merger })
//   const result = await parallel.run('Research 3 competitors and compare them')

import type { Agent } from '../agent.ts'

export interface ParallelConfig {
  // Splits the main task into an array of sub-tasks
  splitter: Agent
  // Executes each sub-task (same agent runs all in parallel by default)
  worker: Agent
  // Synthesizes the array of worker results into a final answer
  merger: Agent
  // Concurrency limit (default: all in parallel)
  concurrency?: number
}

export class Parallel {
  private splitter: Agent
  private worker: Agent
  private merger: Agent
  private concurrency: number

  constructor(cfg: ParallelConfig) {
    this.splitter = cfg.splitter
    this.worker = cfg.worker
    this.merger = cfg.merger
    this.concurrency = cfg.concurrency ?? Infinity
  }

  async run(task: string): Promise<string> {
    // Step 1: Split
    const splitResponse = await this.splitter.run(
      `Break this task into independent sub-tasks. Return ONLY a JSON array of strings, no explanation.
Task: ${task}`,
    )

    let subTasks: string[]
    try {
      // Parse sub-tasks from JSON, handling markdown code blocks
      const cleaned = splitResponse.replace(/```json?|```/g, '').trim()
      subTasks = JSON.parse(cleaned)
      if (!Array.isArray(subTasks)) throw new Error('Not an array')
    } catch {
      // Fallback: treat the whole task as a single sub-task
      subTasks = [task]
    }

    // Step 2: Run workers in parallel (with concurrency limit)
    const results: string[] = new Array(subTasks.length)
    const concurrency = isFinite(this.concurrency) ? this.concurrency : subTasks.length
    const chunks: Array<Array<{ st: string; idx: number }>> = []
    for (let i = 0; i < subTasks.length; i += concurrency) {
      chunks.push(
        subTasks.slice(i, i + concurrency).map((st, j) => ({ st, idx: i + j })),
      )
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async ({ st, idx }) => {
          try {
            results[idx] = await this.worker.run(st)
          } catch (err) {
            // Isolate per-worker failures — record error in results so merger
            // can still synthesize what it received from the other workers.
            const msg = err instanceof Error ? err.message : String(err)
            results[idx] = `[Sub-task failed: ${msg}]`
          }
        }),
      )
    }

    // Step 3: Merge
    const mergePrompt = [
      `Synthesize these sub-task results into a comprehensive final answer.`,
      `Original task: ${task}`,
      ``,
      ...results.map((r, i) => `--- Sub-task ${i + 1} ---\n${r}`),
    ].join('\n')

    return this.merger.run(mergePrompt)
  }
}
