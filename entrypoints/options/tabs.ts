// options tab 注册表——共享外壳，F2/F3/F4 各注册自己的 tab，避免装配冲突。
// 每个 tab 提供 render(container) 自行填充；切换时调用。

export interface OptionsTab {
  id: string;
  label: string;
  render: (container: HTMLElement) => void | Promise<void>;
}

const tabs: OptionsTab[] = [];

export function registerTab(tab: OptionsTab): void {
  if (!tabs.some((t) => t.id === tab.id)) tabs.push(tab);
}

export function mountOptions(root: HTMLElement): void {
  root.innerHTML = `
    <aside class="side">
      <div class="brand">ClearConsent<span class="dot">.</span><small>设置</small></div>
      <nav class="nav">${tabs.map((t) => `<button data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
    </aside>
    <main class="content" id="tab-content"></main>`;
  const content = root.querySelector<HTMLElement>('#tab-content')!;
  const buttons = root.querySelectorAll<HTMLButtonElement>('.nav button');

  const activate = async (id: string) => {
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    const tab = tabs.find((t) => t.id === id);
    if (tab) await tab.render(content);
  };
  buttons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.tab!)));
  if (tabs[0]) activate(tabs[0].id);
}
