// 内置规则快照（随包分发的兜底数据）。F4 拉取的远程快照经 storage 覆盖后优先于此。
// 选择器来自主流 CMP 的公开 DOM 结构。纯数据——无任何可执行代码（CWS 红线）。
// 来源与署名见 scripts/NOTICE-rules.md。

import type { RuleSnapshot } from './rules-format';

export const BUILTIN_SNAPSHOT: RuleSnapshot = {
  version: '2026.07.18',
  source: 'Consent-O-Matic (MIT, cavi-au/Consent-O-Matic) 结构映射 + 手工补充',
  rules: [
    {
      id: 'onetrust',
      name: 'OneTrust',
      detect: '#onetrust-banner-sdk, #onetrust-consent-sdk',
      actions: {
        // OneTrust 的 reject-all 即拒绝所有非必要 = 仅必要
        'essential-only': [
          {
            kind: 'click',
            selector: '#onetrust-reject-all-handler',
            label: '点击「拒绝全部非必要」',
          },
        ],
        'reject-all-first': [
          { kind: 'click', selector: '#onetrust-reject-all-handler', label: '点击「拒绝全部」' },
        ],
        'hide-only': [
          { kind: 'hide', selector: '#onetrust-banner-sdk', label: '隐藏 OneTrust 横幅' },
          { kind: 'hide', selector: '.onetrust-pc-dark-filter', label: '隐藏遮罩', optional: true },
        ],
      },
    },
    {
      id: 'quantcast',
      name: 'Quantcast Choice',
      detect: '.qc-cmp2-container, #qc-cmp2-ui',
      actions: {
        'essential-only': [
          {
            kind: 'click',
            selector: '.qc-cmp2-summary-buttons button[mode="secondary"]',
            label: '点击「拒绝」',
          },
        ],
        'reject-all-first': [
          {
            kind: 'click',
            selector: '.qc-cmp2-summary-buttons button[mode="secondary"]',
            label: '点击「拒绝」',
          },
        ],
        'hide-only': [
          { kind: 'hide', selector: '.qc-cmp2-container', label: '隐藏 Quantcast 横幅' },
          { kind: 'hide', selector: '.qc-cmp-cleanslate', label: '隐藏遮罩', optional: true },
        ],
      },
    },
    {
      id: 'cookiebot',
      name: 'Cookiebot',
      detect: '#CybotCookiebotDialog',
      actions: {
        'essential-only': [
          {
            kind: 'click',
            selector: '#CybotCookiebotDialogBodyButtonDecline',
            label: '点击「仅必要」',
          },
        ],
        'reject-all-first': [
          {
            kind: 'click',
            selector: '#CybotCookiebotDialogBodyButtonDecline',
            label: '点击「拒绝」',
          },
        ],
        'hide-only': [
          { kind: 'hide', selector: '#CybotCookiebotDialog', label: '隐藏 Cookiebot 对话框' },
          {
            kind: 'hide',
            selector: '#CybotCookiebotDialogBodyUnderlay',
            label: '隐藏遮罩',
            optional: true,
          },
        ],
      },
    },
    {
      id: 'didomi',
      name: 'Didomi',
      detect: '#didomi-host, .didomi-popup-open',
      actions: {
        'essential-only': [
          {
            kind: 'click',
            selector: '#didomi-notice-disagree-button, .didomi-continue-without-agreeing',
            label: '点击「拒绝」',
          },
        ],
        'reject-all-first': [
          { kind: 'click', selector: '#didomi-notice-disagree-button', label: '点击「拒绝全部」' },
        ],
        'hide-only': [{ kind: 'hide', selector: '#didomi-host', label: '隐藏 Didomi 弹窗' }],
      },
    },
    {
      id: 'osano',
      name: 'Osano',
      detect: '.osano-cm-dialog, .osano-cm-window',
      actions: {
        'essential-only': [
          { kind: 'click', selector: '.osano-cm-denyAll', label: '点击「拒绝全部」' },
        ],
        'reject-all-first': [
          { kind: 'click', selector: '.osano-cm-denyAll', label: '点击「拒绝全部」' },
        ],
        'hide-only': [{ kind: 'hide', selector: '.osano-cm-dialog', label: '隐藏 Osano 对话框' }],
      },
    },
    {
      id: 'cookieyes',
      name: 'CookieYes',
      detect: '.cky-consent-container, .cky-modal',
      actions: {
        'essential-only': [{ kind: 'click', selector: '.cky-btn-reject', label: '点击「拒绝」' }],
        'reject-all-first': [{ kind: 'click', selector: '.cky-btn-reject', label: '点击「拒绝」' }],
        'hide-only': [
          { kind: 'hide', selector: '.cky-consent-container', label: '隐藏 CookieYes 横幅' },
          { kind: 'hide', selector: '.cky-overlay', label: '隐藏遮罩', optional: true },
        ],
      },
    },
    {
      id: 'trustarc',
      name: 'TrustArc',
      detect: '#truste-consent-track, .truste_box_overlay',
      actions: {
        // TrustArc 无一键拒绝，退化为隐藏（避免误点同意）
        'essential-only': [
          { kind: 'hide', selector: '#truste-consent-track', label: '隐藏 TrustArc（无拒绝路径）' },
        ],
        'reject-all-first': [
          { kind: 'hide', selector: '#truste-consent-track', label: '隐藏 TrustArc（无拒绝路径）' },
        ],
        'hide-only': [
          { kind: 'hide', selector: '#truste-consent-track', label: '隐藏 TrustArc' },
          { kind: 'hide', selector: '.truste_overlay', label: '隐藏遮罩', optional: true },
        ],
      },
    },
  ],
};
