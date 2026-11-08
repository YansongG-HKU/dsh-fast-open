# 安装事务与客户端生命周期强化（1.1.2）
Issue: https://github.com/YansongG-HKU/dsh-fast-open/issues/1

安装先验证包与profile，再建立暂存junction，备份原junction，最后原子提交配置；失败恢复旧链接与配置。普通目录与共享node_modules链接拒绝操作，不递归删除未知目录。profile内排他安装锁阻止并行安装；异常退出遗留锁与暂存文件需人工核对。卸载失败不静默吞掉。

样式与DOMContentLoaded监听器绑定ctx.effect，卸载只移除本实例拥有的样式；重新加载无残留。14项测试通过，包含配置提交失败注入、普通目录保护和生命周期清理。CSS的真实桌面收益仍未被证明，不作为稳定性修复的性能承诺。
