# 首次 Git 提交之前留存的源码片段

这些文件从项目已有的 `.sites-runtime` 本地快照原样复制，仅供查看和对比。每个文件末尾加了 `.snapshot.txt`，避免作为项目代码参与编译。

| 目录 | 可确认的内容 | 范围 |
| --- | --- | --- |
| `ui-before` | 岗位页面三个不同 UI 调整节点 | 仅主页面 |
| `visual-before` | 视觉调整前的页面、操作组件、PWA 按钮和样式 | 部分文件 |
| `depth-before` | 层次感调整前的页面、操作组件、PWA 按钮和样式 | 部分文件 |
| `polish-before` | 后续精修前的页面、视图组件和样式 | 部分文件 |
| `portal-before` | 新门户首页建立前的工作区主页面和全局样式 | 部分文件 |
| `portal-v2-before` | 门户首页背景和文案调整前的首页及专用样式 | 仅首页相关文件 |

文件夹名称来自原始本地快照。不能据此推断每个文件夹都是一套完整可运行的旧项目，也不能据此补出从未保存过的业务文件。首次 Git 提交以前没有完整项目提交。

完整版本从 Git 提交 `10fda57` 起连续保存。查询完整版本：

```powershell
git log --oneline --reverse
git show 10fda57:app/page.tsx
```

查询首次提交前的源码片段，例如：

```powershell
git show HEAD:history/pre-git-snapshots/portal-before/page.tsx.snapshot.txt
```

不要直接把片段覆盖到现有项目；旧版可能与现在的路由、组件、API 不兼容。需要恢复某段功能时，应先对比相关提交和快照，再做针对性修改。
