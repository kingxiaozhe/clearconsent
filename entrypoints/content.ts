// content script：isolated world，全站注入。弹窗匹配与执行逻辑由 1.rule-engine 填充。
// 底座只占位入口 + 幂等保护点（SPA 路由变化的重挂载由 T-009 实现）。
export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    // F1 T-007/008/009 在此接管：匹配规则 → 执行策略 → 经 messaging 上报 process-result。
  },
});
