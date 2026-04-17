/**
 * Advanced Memory demo — Marie v1
 * Run: bun run examples/memory-demo.ts
 */

import { Agent, Memory, createMemoryMiddleware, createLogger } from '../src/index.ts'
import { config } from 'dotenv'

config()

async function main() {
  console.log('\n🧠 --- Marie Advanced Memory Demo ---\n')

  // 1. Initialize Memory Manager
  // In a real app, you might provide 'persist' methods to save/load from db
  const memory = new Memory({
    recentTurns: 2,           // keep STM extremely tight for demo
    summaryStrategy: 'hybrid', // use hybrid summarizer for STM
    maxContextFacts: 3,       // inject max 3 LTM facts per turn
  })

  // 2. Initialize Agent
  const agent = new Agent({
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    apiKey: process.env.AI_API_KEY!,
    baseUrl: process.env.AI_BASE_URL,
    systemPrompt: 'You are an intelligent assistant with perfect memory.',
    middleware: [
      createLogger({ level: 'info' }),
      createMemoryMiddleware({ memory }),
    ],
  })

  console.log('--- Session 1: Introductions ---\n')
  
  // Note: the heuristics will catch the name and location patterns
  await agent.run("Hello, my name is Ebtisam, I'm a developer and I live in Dhaka. Call me Ebti.")
  await agent.run("I work on a project called Pterobill. I love typescript but I hate java.")
  
  // Print current LTM stats
  console.log('\n--- Internal Memory State After Session 1 ---')
  console.log(memory.stats)
  console.table(memory.query('Ebtisam', { limit: 10 }).map(f => ({ category: f.category, fact: f.content })))
  console.log('-------------------------------------------\n')

  console.log('--- Session 2: Retrieval ---\n')
  
  // The Memory middleware will automatically inject relevant context based on this query
  const reply1 = await agent.run("What's my name? What do I do?")
  console.log('\n🤖 Agent:', reply1, '\n')

  const reply2 = await agent.run("Do I like Java or TypeScript?")
  console.log('\n🤖 Agent:', reply2, '\n')

  const reply3 = await agent.run("Where do I live? And what is the name of my project?")
  console.log('\n🤖 Agent:', reply3, '\n')

  console.log('🎉 Demo completed successfully.')
}

main().catch(console.error)
