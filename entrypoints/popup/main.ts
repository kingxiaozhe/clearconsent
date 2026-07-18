// popup 入口占位。F2 T-011 用 design-baseline/V3 收据 UI 接管。
// popup 失焦即销毁——不放长任务，只读状态（经 get-site-state）。
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) app.textContent = 'ClearConsent';
