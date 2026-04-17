// Supervisor-Worker orchestration pattern.
// The supervisor agent routes each task to the best specialist worker agent.
// 
// Usage:
//   const team = new Supervisor({ supervisorAgent, workers: { coder, researcher } })
//   const result = await team.run('Build a website for my bakery')

import type { Agent } from '../agent.ts'

export interface SupervisorConfig {
  // The orchestrator agent — decides which worker to call and synthesizes output
  supervisor: Agent
  // Named specialist agents
  workers: Record<string, Agent>
  // Max rounds of delegation (prevents infinite loops)
  maxRounds?: number
}

export class Supervisor {
  private supervisor: Agent
  private workers: Record<string, Agent>
  private maxRounds: number

  constructor(cfg: SupervisorConfig) {
    this.supervisor = cfg.supervisor
    this.workers = cfg.workers
    this.maxRounds = cfg.maxRounds ?? 5
  }

  async run(task: string): Promise<string> {
    const workerNames = Object.keys(this.workers).join(', ')

    // Give the supervisor knowledge of its workers via system prompt injection
    const delegationPrompt = `
You are a supervisor coordinating a team of specialists: [${workerNames}].
To delegate a task, respond with EXACTLY this format on a single line:
DELEGATE:<worker_name>:<task_description>
To return a final answer to the user, respond normally.
`.trim()

    let currentMessage = task
    let history: { role: 'user' | 'assistant'; content: string }[] = []

    for (let round = 0; round < this.maxRounds; round++) {
      // Ask the supervisor what to do
      const response = await this.supervisor.run(
        round === 0 ? currentMessage : currentMessage,
        {
          history: [
            { role: 'user', content: delegationPrompt },
            { role: 'assistant', content: 'Understood. I will coordinate the team.' },
            ...history,
          ],
        },
      )

      // Check if supervisor wants to delegate
      const delegateMatch = response.match(/^DELEGATE:(\w+):(.+)$/m)
      if (!delegateMatch) {
        // Supervisor is giving a final answer
        return response
      }

      const [, workerName, workerTask] = delegateMatch
      const worker = this.workers[workerName]

      if (!worker) {
        // Worker not found — tell supervisor and continue
        history.push(
          { role: 'user', content: `Delegate to ${workerName}: ${workerTask}` },
          { role: 'assistant', content: `Worker "${workerName}" not found. Available: ${workerNames}` },
        )
        continue
      }

      // Execute the worker
      const workerResult = await worker.run(workerTask)

      // Feed result back to supervisor
      history.push(
        { role: 'user', content: `Task: ${workerTask}` },
        { role: 'assistant', content: `DELEGATE:${workerName}:${workerTask}` },
        { role: 'user', content: `${workerName} result: ${workerResult}` },
      )

      currentMessage = `Synthesize the result from ${workerName} and decide next steps for the original task: "${task}"`
    }

    // Max rounds reached — ask supervisor for best-effort response
    return this.supervisor.run(
      `Max delegation rounds reached. Based on everything so far, give your best answer for: "${task}"`,
      { history },
    )
  }
}
