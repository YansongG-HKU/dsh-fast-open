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
