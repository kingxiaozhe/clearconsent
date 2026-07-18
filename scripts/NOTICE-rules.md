# 规则库来源与署名

内置规则快照（`utils/builtin-rules.ts`）的 CMP 探测器与动作选择器，参照以下开源项目的规则结构映射而来：

- **Consent-O-Matic** — MIT License, © Aarhus University CAVI (cavi-au/Consent-O-Matic)
  https://github.com/cavi-au/Consent-O-Matic

映射方式见 `convert-rules.mjs`。**覆盖边界（诚实声明）**：本转换器覆盖 Consent-O-Matic 规则的探测器（`detectors[].presentMatcher.target.selector`）与简化拒绝/隐藏方法（REJECT_ALL / HIDE_CMP）。C-o-M 的按类目逐项授权（多步 consent 切换）不在覆盖内，此类规则退化为 hide-only 兜底——由 T-021 覆盖率抽测把关。

内置快照中另有手工补充的选择器（CookieYes、Didomi 的部分路径），非源自 C-o-M。

许可义务：保留本 NOTICE，注明来源与许可证。ClearConsent 本体亦为 MIT。
