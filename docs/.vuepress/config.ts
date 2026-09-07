import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { viteBundler } from '@vuepress/bundler-vite'
import { markdownChartPlugin } from '@vuepress/plugin-markdown-chart'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'

const vuepressDir = dirname(fileURLToPath(import.meta.url))

export default defineUserConfig({
  base: '/',
  lang: 'en-US',
  title: 'vixl',
  description: 'Local-first BYOK Agents UI',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
  ],

  alias: {
    '@docs': vuepressDir,
  },

  bundler: viteBundler({
    viteOptions: {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@docs': resolve(vuepressDir),
        },
      },
    },
  }),

  theme: defaultTheme({
    repo: 'vixl-ai/vixl',
    docsDir: 'docs',
    docsBranch: 'main',
    editLink: true,
    lastUpdated: true,
    contributors: false,
    navbar: [
      {
        text: 'Home',
        link: '/',
      },
      {
        text: 'Docs',
        link: '/guide/',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Projects Bar',
          link: '/guide/projects-bar.html',
        },
        {
          text: 'Project',
          collapsible: true,
          children: [
            { text: 'Chats', link: '/guide/chats.html' },
            { text: 'MCP', link: '/guide/mcp.html' },
            { text: 'Graph', link: '/guide/graphs.html' },
            { text: 'Plans', link: '/guide/plans.html' },
            { text: 'Skills', link: '/guide/skills.html' },
            { text: 'Agents', link: '/guide/agents.html' },
            { text: 'Rules', link: '/guide/rules.html' },
          ],
        },
        {
          text: 'Settings',
          collapsible: true,
          children: [
            { text: 'General', link: '/guide/general.html' },
            { text: 'Graphs', link: '/guide/graphs.html' },
            { text: 'MCP', link: '/guide/mcp.html' },
            { text: 'Providers', link: '/guide/providers.html' },
            { text: 'Models', link: '/guide/models.html' },
            { text: 'LSP', link: '/guide/lsp.html' },
            { text: 'Permissions', link: '/guide/permissions.html' },
            { text: 'Plans', link: '/guide/plans.html' },
            { text: 'Skills', link: '/guide/skills.html' },
            { text: 'Agents', link: '/guide/agents.html' },
            { text: 'Rules', link: '/guide/rules.html' },
          ],
        },
        {
          text: 'Chat UI',
          link: '/guide/chat-ui.html',
        },
        {
          text: 'Workbench',
          collapsible: true,
          children: [
            { text: 'Editor', link: '/guide/editor.html' },
            { text: 'Terminal', link: '/guide/terminal.html' },
            { text: 'Changes', link: '/guide/changes.html' },
            { text: 'Plan', link: '/guide/plans.html' },
            { text: 'Agent shell', link: '/guide/agent-shell.html' },
          ],
        },
        {
          text: '.vixl',
          collapsible: true,
          children: [
            { text: 'settings.json', link: '/guide/settings-json.html' },
            { text: 'mcp.json', link: '/guide/mcp.html' },
            { text: 'lsp.json', link: '/guide/lsp.html' },
            { text: 'AGENTS.md', link: '/guide/agents-md.html' },
            { text: 'agents', link: '/guide/agents.html' },
            { text: 'rules', link: '/guide/rules.html' },
            { text: 'skills', link: '/guide/skills.html' },
            { text: 'plans', link: '/guide/plans.html' },
            { text: 'graphs', link: '/guide/graphs.html' },
          ],
        },
      ],
    },
  }),

  plugins: [
    markdownChartPlugin({
      mermaid: true,
    }),
  ],
})
