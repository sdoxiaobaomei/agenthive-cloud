/**
 * Nuxt 3 Client Plugin - 前端遥测
 * 
 * 可选实现：Grafana Faro 或标准 OTel Web SDK
 * 当前使用轻量级方案：Performance API + 错误捕获 + 关键事件上报
 * 
 * 如需完整 RUM，可替换为 Faro Web SDK。
 */

export default defineNuxtPlugin(() => {
  // 只在浏览器端执行
  if (process.server) return;

  const otelEndpoint = window.__NUXT__?.config?.public?.otelEndpoint || 'http://localhost:4318/v1/traces';

  // 简单的性能追踪
  const observePerformance = () => {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // 只上报关键指标到 console（后续可接入 Faro）
            if (entry.entryType === 'web-vitals' || entry.entryType === 'navigation') {
              // eslint-disable-next-line no-console
              console.debug('[RUM]', entry.name, entry.duration || entry.startTime);
            }
          }
        });
        observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
      } catch {
        // PerformanceObserver 不支持某些 entryTypes
      }
    }
  };

  // 全局错误捕获
  const observeErrors = () => {
    window.addEventListener('error', (event) => {
      // eslint-disable-next-line no-console
      console.error('[RUM] JS Error:', event.message, event.filename, event.lineno);
    });
    window.addEventListener('unhandledrejection', (event) => {
      // eslint-disable-next-line no-console
      console.error('[RUM] Unhandled Promise Rejection:', event.reason);
    });
  };

  // 路由变化追踪
  const observeRouting = () => {
    const router = useRouter();
    router.afterEach((to, from) => {
      const start = performance.now();
      // 页面完全渲染后记录
      nextTick(() => {
        const duration = performance.now() - start;
        // eslint-disable-next-line no-console
        console.debug('[RUM] Route change:', from.fullPath, '→', to.fullPath, `${duration.toFixed(2)}ms`);
      });
    });
  };

  observePerformance();
  observeErrors();
  observeRouting();

  // eslint-disable-next-line no-console
  console.log('[Telemetry] Client telemetry initialized');
});

function nextTick(fn: () => void) {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => setTimeout(fn, 0));
  } else {
    setTimeout(fn, 0);
  }
}
