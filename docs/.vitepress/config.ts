import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Amail',
  description: '自托管邮件代理网关',
  srcExclude: ['superpowers/**'],
  themeConfig: {
    nav: [
      { text: '开始', link: '/guide/getting-started' },
      { text: 'API', link: '/api/http' },
      { text: 'SDK', link: '/sdk/node' },
      { text: '部署', link: '/deploy/docker' },
    ],
    sidebar: [
      {
        text: '使用',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '配置', link: '/guide/configuration' },
          { text: '结构', link: '/architecture' },
        ],
      },
      {
        text: '参考',
        items: [
          { text: 'HTTP API', link: '/api/http' },
          { text: 'Node SDK', link: '/sdk/node' },
          { text: 'Docker 部署', link: '/deploy/docker' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Moonrend/Amail' },
    ],
    search: {
      provider: 'local',
    },
  },
})
