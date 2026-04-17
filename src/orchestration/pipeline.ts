// Sequential pipeline — chains agents where each output feeds the next.
//
// Usage:
//   const pipe = new Pipeline([analyzeAgent, planAgent, writeAgent])
//   const result = await pipe.run('Refactor this function: ...')

import type { Agent } from '../agent.ts'

export interface PipelineStage {
  agent: Agent
  // Optional: transform the previous output before passing to this agent.
  // Useful for adding instructions, trimming, or reformatting.
  transform?: (previousOutput: string, stage: number) => string
}

export class Pipeline {
  private stages: PipelineStage[]

  constructor(agents: Agent[] | PipelineStage[]) {
    this.stages = agents.map(a =>
      a instanceof Object && 'agent' in a ? a as PipelineStage : { agent: a as Agent },
    )
  }

  async run(input: string): Promise<string> {
    let current = input
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i]
      const message = stage.transform ? stage.transform(current, i) : current
      current = await stage.agent.run(message)
    }
    return current
  }

  // Streaming version — yields chunks from the final stage
  async *stream(input: string): AsyncGenerator<string> {
    let current = input
    // Run all but last stage synchronously
    for (let i = 0; i < this.stages.length - 1; i++) {
      const stage = this.stages[i]
      const message = stage.transform ? stage.transform(current, i) : current
      current = await stage.agent.run(message)
    }
    // Stream final stage
    const lastStage = this.stages[this.stages.length - 1]
    const finalMessage = lastStage.transform ? lastStage.transform(current, this.stages.length - 1) : current
    yield* lastStage.agent.chat(finalMessage)
  }
}
