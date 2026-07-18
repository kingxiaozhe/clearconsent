// options 入口：装配共享 tab 外壳。F2 注册透明日志；F3 注册偏好/白名单；F4 注册规则库。
import './style.css';
import { mountOptions, registerTab } from './tabs';
import { logTab } from './tab-log';

// F2：透明日志（F3/F4 会在此追加 registerTab(...)，各自独立文件，不改本入口的既有行）
registerTab(logTab);

const app = document.querySelector<HTMLDivElement>('#app');
if (app) mountOptions(app);
