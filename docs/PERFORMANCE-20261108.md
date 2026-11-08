# 纯 CSS 性能复查

Issue: https://github.com/YansongG-HKU/dsh-fast-open/issues/3

当前客户端只注入一个 style，无 MutationObserver、逐帧扫描、轮询和网络请求；卸载时清理自有样式及 DOMContentLoaded 监听器。未发现需要额外 JS 缓存或调度器解决的已测瓶颈，本轮保留运行时代码。

此前真实 Electron A/B 的冷开中位数 OFF 3994ms、ON 4134ms，没有证明 CSS 冷开加速。最近正常重启后的最大会话 2732.7ms 是单轮成功打开证据，不能代替 A/B 或性能保证。14 项既有测试和入口语法检查本轮复跑通过。

选择器依赖 [data-chat-flow]，content-visibility 的页面内查找与滚动锚点仍需观察。只有真实渲染 trace 显示布局/绘制持续主导、且运行任务时可复现，才在隔离环境评估官方级时间线虚拟化；不在本插件重新加入已造成回归的 observer 全量扫描。诊断方法与脚本仍见 README 和 docs/HARDENING-20261108.md。
