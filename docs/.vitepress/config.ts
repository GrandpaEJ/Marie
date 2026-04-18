import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Marie v1",
  description: "The high-performance, cost-optimized agent framework for Bun.",
  cleanUrls: true,
  base: '/',
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'The Book', link: '/introduction' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/GrandpaEJ/Marie' }
    ],
    sidebar: [
      {
        text: 'The Basics',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'The Agent', link: '/the-agent' },
          { text: 'Skills & Tools', link: '/tools' },
        ]
      },
      {
        text: 'The Mind (Memory)',
        items: [
          { text: 'Associative Memory', link: '/memory' },
          { text: 'Multi-User Isolation', link: '/memory#multi-user-scoping' },
          { text: 'Persistence Adapters', link: '/persistence' },
        ]
      },
      {
        text: 'Economy & Speed',
        items: [
          { text: 'Model Routing', link: '/economics' },
          { text: 'Semantic Caching', link: '/economics#semantic-caching' },
          { text: 'Budget Enforcement', link: '/economics#budgets' },
        ]
      },
      {
        text: 'Orchestration',
        items: [
          { text: 'Multi-Agent Teams', link: '/orchestration' },
          { text: 'Telegram Tutorial', link: '/telegram-tutorial' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Quick API Lookup', link: '/api-reference' },
          { text: 'API Encyclopedia', link: '/api-encyclopedia' },
          { text: 'Full API (Auto-Gen)', link: '/api/' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/GrandpaEJ/Marie' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Marie Project'
    }
  }
})
