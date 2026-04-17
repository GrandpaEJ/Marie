// Cost-tracking middleware.
// Accumulates token usage and calculates USD cost per run.
// Emits budget:warning and throws BudgetExceededError when limits are hit.

import type { Middleware, MiddlewareContext, Budget, TokenUsage } from '../types.ts'
import { BudgetExceededError } from '../core/errors.ts'
import { MODEL_COSTS, estimateCost } from '../routing/models.ts'

export interface CostTrackerState {
  totalTokens: TokenUsage
  totalCostUsd: number
  steps: number
  cachedSteps: number
  startedAt: number
}

export function createCostTracker(
  budget: Budget = {},
  onEvent?: (event: string, data: unknown) => void,
): Middleware & { state: CostTrackerState } {
  const warnAt = budget.warnAt ?? 0.8
  let warnedTokens = false
  let warnedCost = false
  let warnedDuration = false

  const state: CostTrackerState = {
    totalTokens: { prompt: 0, completion: 0, total: 0 },
    totalCostUsd: 0,
    steps: 0,
    cachedSteps: 0,
    startedAt: Date.now(),
  }

  const emit = (event: string, data: unknown) => onEvent?.(event as any, data)

  function check(kind: 'tokens' | 'cost' | 'duration', used: number, limit: number | undefined) {
    if (!limit) return
    const ratio = used / limit
    const warned = kind === 'tokens' ? warnedTokens : kind === 'cost' ? warnedCost : warnedDuration
    if (ratio >= warnAt && !warned) {
      emit('budget:warning', { kind, used, limit, ratio })
      if (kind === 'tokens') warnedTokens = true
      else if (kind === 'cost') warnedCost = true
      else warnedDuration = true
    }
    if (used >= limit) {
      emit('budget:exceeded', { kind, used, limit })
      throw new BudgetExceededError({ kind, used, limit })
    }
  }

  return {
    name: 'cost-tracker',
    state,

    before(ctx: MiddlewareContext) {
      state.steps++
      if (ctx.cached) state.cachedSteps++

      // Check step budget before the call
      if (budget.maxSteps && state.steps > budget.maxSteps) {
        throw new BudgetExceededError({ kind: 'steps', used: state.steps, limit: budget.maxSteps })
      }
      // Check duration
      const durationMs = Date.now() - state.startedAt
      check('duration', durationMs, budget.maxDurationMs)
    },

    after(ctx: MiddlewareContext) {
      // Accumulate token usage from this step
      state.totalTokens.prompt += ctx.usage.prompt
      state.totalTokens.completion += ctx.usage.completion
      state.totalTokens.total += ctx.usage.total

      // Accumulate cost
      const stepCost = estimateCost(ctx.model, ctx.usage.prompt, ctx.usage.completion)
      state.totalCostUsd += stepCost

      // Sync to context for downstream middleware (like logger)
      ctx.costUsd = stepCost
      ctx.totalCostUsd = state.totalCostUsd
      ctx.totalUsage = { ...state.totalTokens }

      // Check token + cost budgets
      check('tokens', state.totalTokens.total, budget.maxTokens)
      check('cost', state.totalCostUsd, budget.maxCostUsd)

      // Check duration
      check('duration', Date.now() - state.startedAt, budget.maxDurationMs)
    },
  }
}
