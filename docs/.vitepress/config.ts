import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Marie v1",
  description: "Minimal, fast agent library for Bun",
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/getting-started' },
      { text: 'GitHub', link: 'https://github.com/GrandpaEJ/Marie' }
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Associative Memory', link: '/memory' },
          { text: 'Tools & Skills', link: '/tools' },
          { text: 'Persistence', link: '/persistence' },
        ]
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Multi-Agent Orchestration', link: '/orchestration' },
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
