// options 入口：装配共享 tab 外壳。F2 注册透明日志；F3 注册偏好/白名单；F4 注册规则库。
import './style.css';
import { mountOptions, registerTab } from './tabs';
import { preferencesTab } from './tab-preferences';
import { whitelistTab } from './tab-whitelist';
import { logTab } from './tab-log';
import { rulesTab } from './tab-rules';

// tab 顺序 = 注册顺序。F3 偏好/信任站点，F2 日志，F4 规则库与关于。
registerTab(preferencesTab);
registerTab(whitelistTab);
registerTab(logTab);
registerTab(rulesTab);

const app = document.querySelector<HTMLDivElement>('#app');
if (app) mountOptions(app);
