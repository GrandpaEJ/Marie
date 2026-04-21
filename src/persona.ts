// Persona Engine - Personality customization and voice modes
// Transforms agent responses based on configured persona

export type VoiceType = 'formal' | 'casual' | 'humorous' | 'technical' | 'friendly' | 'concise'
export type EmojiLevel = 'none' | 'sparse' | 'normal' | 'heavy'
export type SentenceLength = 'short' | 'medium' | 'long'
export type TechnicalLevel = 'beginner' | 'intermediate' | 'expert'

export interface SpeakingStyle {
  emojiUsage: EmojiLevel
  sentenceLength: SentenceLength
  humorLevel: number // 0-10
  technicalDepth: TechnicalLevel
  formality: number // 0-10 (0 = very casual, 10 = very formal)
  politeness: number // 0-10
}

export interface Persona {
  name: string
  description: string
  voice: VoiceType
  traits: string[]
  backstory?: string
  speakingStyle: SpeakingStyle
  systemPrompt?: string
}

export interface PersonaConfig {
  defaultPersona?: Persona
  allowUserPersona?: boolean
  styleTransfer?: boolean
}

// Pre-built personas
export const PERSONAS: Record<string, Persona> = {
  assistant: {
    name: 'Assistant',
    description: 'Default helpful assistant',
    voice: 'friendly',
    traits: ['helpful', 'clear', 'concise'],
    speakingStyle: {
      emojiUsage: 'sparse',
      sentenceLength: 'medium',
      humorLevel: 2,
      technicalDepth: 'intermediate',
      formality: 4,
      politeness: 8,
    },
  },

  developer: {
    name: 'Developer',
    description: 'Technical coding assistant',
    voice: 'technical',
    traits: ['precise', 'efficient', 'code-focused'],
    speakingStyle: {
      emojiUsage: 'none',
      sentenceLength: 'short',
      humorLevel: 1,
      technicalDepth: 'expert',
      formality: 6,
      politeness: 5,
    },
  },

  friend: {
    name: 'Friend',
    description: 'Casual friendly companion',
    voice: 'casual',
    traits: ['warm', 'supportive', 'casual'],
    speakingStyle: {
      emojiUsage: 'heavy',
      sentenceLength: 'short',
      humorLevel: 7,
      technicalDepth: 'beginner',
      formality: 1,
      politeness: 6,
    },
  },

  expert: {
    name: 'Expert',
    description: 'Professional expert advisor',
    voice: 'formal',
    traits: ['authoritative', 'thorough', 'professional'],
    speakingStyle: {
      emojiUsage: 'none',
      sentenceLength: 'long',
      humorLevel: 0,
      technicalDepth: 'expert',
      formality: 10,
      politeness: 9,
    },
  },

  teacher: {
    name: 'Teacher',
    description: 'Patient educational guide',
    voice: 'friendly',
    traits: ['patient', 'encouraging', 'educational'],
    speakingStyle: {
      emojiUsage: 'normal',
      sentenceLength: 'medium',
      humorLevel: 4,
      technicalDepth: 'beginner',
      formality: 3,
      politeness: 9,
    },
  },
}

// Generate system prompt from persona
export function generateSystemPrompt(persona: Persona, basePrompt?: string): string {
  const parts: string[] = []

  // Base
  parts.push(basePrompt || 'You are a helpful AI assistant.')

  // Name and description
  parts.push(`Your name is ${persona.name}. ${persona.description}`)

  // Traits
  if (persona.traits.length > 0) {
    parts.push(`Key traits: ${persona.traits.join(', ')}.`)
  }

  // Backstory
  if (persona.backstory) {
    parts.push(`Background: ${persona.backstory}`)
  }

  // Speaking style
  const style = persona.speakingStyle
  const styleHints: string[] = []

  // Formality hints
  if (style.formality >= 8) {
    styleHints.push('Use formal language and proper grammar')
  } else if (style.formality <= 2) {
    styleHints.push('Use casual, conversational language')
  }

  // Emoji hints
  if (style.emojiUsage === 'heavy') {
    styleHints.push('Use emojis liberally to express emotions')
  } else if (style.emojiUsage === 'sparse') {
    styleHints.push('Use emojis sparingly, only when they add meaning')
  } else if (style.emojiUsage === 'none') {
    styleHints.push('Do not use emojis')
  }

  // Sentence length hints
  if (style.sentenceLength === 'short') {
    styleHints.push('Keep responses concise and to the point')
  } else if (style.sentenceLength === 'long') {
    styleHints.push('Provide thorough, detailed responses')
  }

  // Technical depth
  if (style.technicalDepth === 'beginner') {
    styleHints.push('Explain concepts in simple terms, avoid jargon')
  } else if (style.technicalDepth === 'expert') {
    styleHints.push('Use technical terminology and provide detailed explanations')
  }

  // Humor
  if (style.humorLevel >= 7) {
    styleHints.push('Feel free to be playful and humorous')
  } else if (style.humorLevel <= 2) {
    styleHints.push('Be serious and professional')
  }

  // Politeness
  if (style.politeness >= 8) {
    styleHints.push('Be polite and courteous')
  }

  if (styleHints.length > 0) {
    parts.push(`Communication style: ${styleHints.join('. ')}.`)
  }

  return parts.join('\n\n')
}

// Transform text based on style preferences
export function transformText(text: string, style: Partial<SpeakingStyle>): string {
  let result = text

  // Truncate if sentence length is short
  if (style.sentenceLength === 'short') {
    const sentences = result.split(/[.!?]+/).filter(s => s.trim())
    if (sentences.length > 3) {
      result = sentences.slice(0, 2).join('. ').trim() + '.'
    }
  }

  // Add emoji placeholders (would need emoji library in real impl)
  if (style.emojiUsage === 'heavy' && !result.includes('😊')) {
    result += ' 😊'
  }

  return result
}

// Detect user's communication style from their messages
export function detectUserStyle(messages: string[]): Partial<SpeakingStyle> {
  const combined = messages.join(' ').toLowerCase()
  const style: Partial<SpeakingStyle> = {}

  // Emoji density
  const emojiCount = (combined.match(/[😀-🙏🌀-🗿🚀-🛿]/g) || []).length
  if (emojiCount > messages.length * 0.5) {
    style.emojiUsage = 'heavy'
  } else if (emojiCount > messages.length * 0.1) {
    style.emojiUsage = 'normal'
  }

  // Average message length
  const avgLength = messages.reduce((sum, m) => sum + m.length, 0) / messages.length
  if (avgLength < 50) {
    style.sentenceLength = 'short'
  } else if (avgLength > 200) {
    style.sentenceLength = 'long'
  }

  // Formality indicators
  const formalWords = ['please', 'thank you', 'would you', 'could you', 'appreciate']
  const casualWords = ['hey', 'yeah', 'nah', 'cool', 'awesome', 'lol']
  const formalCount = formalWords.filter(w => combined.includes(w)).length
  const casualCount = casualWords.filter(w => combined.includes(w)).length

  if (formalCount > casualCount) {
    style.formality = 8
  } else if (casualCount > formalCount) {
    style.formality = 2
  }

  return style
}

// Persona Manager - handles persona switching and user preferences
export class PersonaManager {
  private personas: Map<string, Persona> = new Map()
  private userPersonas: Map<string, Persona> = new Map()

  constructor(config: PersonaConfig = {}) {
    // Register default personas
    for (const [key, persona] of Object.entries(PERSONAS)) {
      this.personas.set(key, persona)
    }

    this.config = config
  }

  private config: PersonaConfig

  // Register custom persona
  register(name: string, persona: Persona): void {
    this.personas.set(name, persona)
  }

  // Get persona by name
  get(name: string): Persona | undefined {
    return this.personas.get(name) || this.userPersonas.get(name)
  }

  // Set user's preferred persona
  setUserPersona(userId: string, persona: Persona): void {
    this.userPersonas.set(userId, persona)
  }

  // Get persona for user (user preference or default)
  getForUser(userId: string): Persona {
    return this.userPersonas.get(userId) || this.config.defaultPersona || PERSONAS.assistant
  }

  // Generate system prompt for user
  generatePromptForUser(userId: string, basePrompt?: string): string {
    const persona = this.getForUser(userId)
    return generateSystemPrompt(persona, basePrompt)
  }
}