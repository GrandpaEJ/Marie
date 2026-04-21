// Safety module - Input filtering, output moderation, and audit logging
// Provides content safety for production deployments

export interface SafetyConfig {
  enableInputFilter?: boolean
  enableOutputFilter?: boolean
  enableAuditLog?: boolean
  blockProfanity?: boolean
  blockPII?: boolean
  blockSuspiciousUrls?: boolean
  strictMode?: boolean
}

export interface SafetyResult {
  passed: boolean
  violations: SafetyViolation[]
  sanitized?: string
}

export interface SafetyViolation {
  type: 'profanity' | 'pii' | 'suspicious_url' | 'harmful_content' | 'injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  matched?: string
}

// Simple profanity detection (would use better library in production)
const PROFANITY_PATTERNS = [
  /\b(spam|scam|fake)\b/i,
  /\b(hack|crack|bypass)\b/i,
]

// PII patterns
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'ssn', description: 'Social Security Number' },
  { pattern: /\b\d{16}\b/, type: 'credit_card', description: 'Credit Card Number' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email', description: 'Email Address' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone', description: 'Phone Number' },
]

// Suspicious URL patterns
const SUSPICIOUS_PATTERNS = [
  /\.exe$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.scr$/i,
  /\.vbs$/i,
  /javascript:/i,
  /data:/i,
]

// Injection patterns
const INJECTION_PATTERNS = [
  /<\s*script/i,
  /<\s*iframe/i,
  /on\w+\s*=/i,
  /\$\{.*\}/,
  /\{\{.*\}\}/,
  /<\?php/i,
  /<\?=/,
]

export class SafetyFilter {
  private config: Required<SafetyConfig>

  constructor(config: SafetyConfig = {}) {
    this.config = {
      enableInputFilter: config.enableInputFilter ?? true,
      enableOutputFilter: config.enableOutputFilter ?? true,
      enableAuditLog: config.enableAuditLog ?? false,
      blockProfanity: config.blockProfanity ?? false,
      blockPII: config.blockPII ?? false,
      blockSuspiciousUrls: config.blockSuspiciousUrls ?? true,
      strictMode: config.strictMode ?? false,
    }
  }

  check(text: string, direction: 'input' | 'output' = 'input'): SafetyResult {
    const violations: SafetyViolation[] = []

    if (direction === 'input' && this.config.enableInputFilter) {
      violations.push(...this.checkInput(text))
    } else if (direction === 'output' && this.config.enableOutputFilter) {
      violations.push(...this.checkOutput(text))
    }

    // Block if critical violations and strict mode
    const hasCritical = violations.some(v => v.severity === 'critical')
    if (hasCritical && this.config.strictMode) {
      return { passed: false, violations }
    }

    return { passed: violations.length === 0, violations }
  }

  private checkInput(text: string): SafetyViolation[] {
    const violations: SafetyViolation[] = []

    // Profanity check
    if (this.config.blockProfanity) {
      for (const pattern of PROFANITY_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          violations.push({
            type: 'profanity',
            severity: 'medium',
            description: 'Potentially inappropriate content detected',
            matched: match[0],
          })
        }
      }
    }

    // PII check
    if (this.config.blockPII) {
      for (const pii of PII_PATTERNS) {
        const match = text.match(pii.pattern)
        if (match) {
          violations.push({
            type: 'pii',
            severity: 'high',
            description: `Personal information detected: ${pii.description}`,
            matched: pii.type,
          })
        }
      }
    }

    // Suspicious URLs
    if (this.config.blockSuspiciousUrls) {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        const match = text.match(pattern)
        if (match) {
          violations.push({
            type: 'suspicious_url',
            severity: 'critical',
            description: 'Potentially dangerous URL pattern detected',
            matched: match[0],
          })
        }
      }
    }

    // Injection patterns
    for (const pattern of INJECTION_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        violations.push({
          type: 'injection',
          severity: 'critical',
          description: 'Potential injection attack detected',
          matched: match[0],
        })
      }
    }

    return violations
  }

  private checkOutput(text: string): SafetyViolation[] {
    // Output filtering is typically less strict
    // This is where you'd add content moderation API calls
    return []
  }

  // Sanitize text by removing/replacing sensitive content
  sanitize(text: string): string {
    let result = text

    // Redact PII
    for (const pii of PII_PATTERNS) {
      result = result.replace(pii.pattern, `[REDACTED: ${pii.type}]`)
    }

    return result
  }
}

// Audit logging
export interface AuditEntry {
  timestamp: number
  userId?: string
  direction: 'input' | 'output'
  content: string
  truncated: boolean
  safetyResult: SafetyResult
  metadata?: Record<string, unknown>
}

export class AuditLogger {
  private entries: AuditEntry[] = []
  private maxEntries: number

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries
  }

  log(entry: Omit<AuditEntry, 'timestamp'>): void {
    this.entries.push({
      ...entry,
      timestamp: Date.now(),
    })

    // Prune old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
  }

  query(filter: {
    userId?: string
    direction?: 'input' | 'output'
    from?: number
    to?: number
    passed?: boolean
  }): AuditEntry[] {
    return this.entries.filter(entry => {
      if (filter.userId && entry.userId !== filter.userId) return false
      if (filter.direction && entry.direction !== filter.direction) return false
      if (filter.from && entry.timestamp < filter.from) return false
      if (filter.to && entry.timestamp > filter.to) return false
      if (filter.passed !== undefined) {
        const passed = entry.safetyResult.passed
        if (filter.passed !== passed) return false
      }
      return true
    })
  }

  export(): AuditEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries = []
  }

  get size(): number {
    return this.entries.length
  }
}

// Safety middleware
import type { Middleware, MiddlewareContext } from './types.ts'

export function createSafetyMiddleware(config: SafetyConfig): Middleware {
  const filter = new SafetyFilter(config)
  const logger = config.enableAuditLog ? new AuditLogger() : undefined

  return {
    name: 'safety',

    async before(ctx: MiddlewareContext) {
      const userMsgs = ctx.messages.filter(m => m.role === 'user')
      for (const msg of userMsgs) {
        if (typeof msg.content !== 'string') continue

        const result = filter.check(msg.content, 'input')
        if (!result.passed && config.strictMode) {
          const critical = result.violations.find(v => v.severity === 'critical')
          if (critical) {
            throw new Error(`Safety violation: ${critical.description}`)
          }
        }

        if (logger) {
          logger.log({
            userId: ctx.metadata?.userId as string | undefined,
            direction: 'input',
            content: msg.content.slice(0, 1000), // Truncate for storage
            truncated: msg.content.length > 1000,
            safetyResult: result,
          })
        }
      }
    },
  }
}