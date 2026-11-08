# dsh-fast-open（会话冷启动加速）

给长会话的时间线行启用 `content-visibility: auto` + `contain-intrinsic-size`：屏幕外的行跳过布局与绘制，压缩首次打开时的渲染成本。纯客户端、纯 CSS，一个 `<style>`，没有 observer、没有逐帧 JS、不触网、不改官方包。

## 安装（profile 层）

1. `node_modules` 里放链接：`mklink /J "<profile>\node_modules\dsh-fast-open" "F:\dsh插件创造\workspace\dsh-fast-open"`
2. 在 `<profile>\package.json` 的 `dependencies` 加 `"dsh-fast-open": "link:F:/dsh插件创造/workspace/dsh-fast-open"`，并把它加入 `dsh.profile.bundles`
3. 重启 DSH（bundle 列表在启动时读取）

## 撤销

1. 从 `dsh.profile.bundles` 删除 `dsh-fast-open`
2. 从 `dependencies` 删除同名项
3. 删除 `node_modules\dsh-fast-open` junction
4. 重启 DSH

## 验证

```bash
npm test
```

打开一个大会话，DevTools 里确认样式表存在：

```js
document.getElementById('dsh-fast-open-style') !== null
getComputedStyle(document.querySelector('[data-chat-flow] > *')).contentVisibility === 'auto'
```

## 实测（隔离实例，11.37 MB / 17,190 事件会话，冷启动）

见 `F:\dsh插件创造\_report\DSH会话打开时间压缩-20261108.md`。

## 真实 Electron 桌面测量

`scripts/measure-desktop.mjs` 仅连接已经开启的本机 Electron CDP 入口；它不重启应用、不改插件开关、不发送模型提示、不生成认证 cookie。需先确认没有真实任务运行，再正常退出 DSH，使用本机回环诊断端口启动。测完退出诊断实例，按正常方式启动应用以关闭诊断入口。

```powershell
node scripts/measure-desktop.mjs --endpoint=http://127.0.0.1:9334 --title=逆向AI客户端优化交互界面并开源 --label=on-idle-cold --out=desktop-results.jsonl
```

测量前在侧边栏展开目标工作区，并切换到其他会话。脚本要求目标在侧边栏中唯一可见，点击后同时核对目标标题、正文变化及加载状态，每 100 ms 采样。结果是目标正文可读取的时间，不代表首次绘制或全部离屏内容已经布局完成；自动化和轮询也会带来误差。已经打开目标时不可将重复点击记为一次有效测量。

桌面验收需区分冷开（正常退出并重新启动；保留缓存）、热开（同一实例切走再切回）、后台工具任务运行、模型正在生成四种情况。隔离 web A/B 数据不能代替真实 Electron 对照，也不能仅由 long task 数量推出耗时全部来自布局/绘制。

### 当前核验状态（v1.1.1）

- v1.1.0 已移除 MutationObserver；本地语法及安装/撤销回归测试通过。
- 真实桌面交替三轮：OFF/ON 冷开中位数 3994/4134 ms，热开 1394/1336 ms，尚未证明稳定加速收益。
- 模型运行时另一冷会话曾等待 48844 ms；续查修复了 `dsh-tool-ondemand` 的跨 Agent 反馈循环，复测三个会话约 3004/1254/1513 ms。稳定性改善不能归功于 CSS；详见 [桌面验收记录](docs/DESKTOP-VALIDATION-20261108.md)。
- v1.1.1 修复安装 CLI 默认路径错误：省略插件路径时现在链接包根目录，并在写入 profile 前校验包。实际桌面 junction 已修复并验证样式生效。
- `overflow-anchor:auto` 允许浏览器采用默认锚定策略，不保证所有滚动跳转和页面查找场景无回归。


See [2026-11-08 hardening and validation](docs/HARDENING-20261108.md).
