import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/components/layout/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: {
          title: '仪表板',
          icon: 'Odometer',
        },
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/AgentDetail.vue'),
        meta: {
          title: 'Agent 管理',
          icon: 'UserFilled',
        },
      },
      {
        path: 'agents/:id',
        name: 'AgentDetail',
        component: () => import('@/views/AgentDetail.vue'),
        props: true,
        meta: {
          title: 'Agent 详情',
          hidden: true,
        },
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/TaskBoard.vue'),
        meta: {
          title: '任务看板',
          icon: 'List',
        },
      },
      {
        path: 'sprints',
        name: 'Sprints',
        component: () => import('@/views/SprintBoard.vue'),
        meta: {
          title: 'Sprint',
          icon: 'Calendar',
        },
      },
      {
        path: 'code',
        name: 'Code',
        component: () => import('@/views/CodeViewer.vue'),
        meta: {
          title: '代码查看',
          icon: 'Document',
        },
      },
      {
        path: 'terminal',
        name: 'Terminal',
        component: () => import('@/views/TerminalView.vue'),
        meta: {
          title: '终端',
          icon: 'Monitor',
        },
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/ChatView.vue'),
        meta: {
          title: '对话',
          icon: 'ChatDotRound',
        },
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: {
          title: '设置',
          icon: 'Setting',
        },
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      public: true,
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面不存在',
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - AgentHive Cloud`
  }
  
  // TODO: 添加登录验证
  // const isAuthenticated = useAuthStore().isAuthenticated
  // if (!to.meta.public && !isAuthenticated) {
  //   next('/login')
  //   return
  // }
  
  next()
})

export default router
