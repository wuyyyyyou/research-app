# Issue tracker：本地 Markdown

本仓库的 issues 和 PRD 以 markdown 文件形式存放在 `.scratch/` 中。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件路径：`.scratch/<feature-slug>/PRD.md`
- 实现 issue 文件路径：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号
- Triage 状态记录在每个 issue 文件靠前位置的 `Status:` 行中；可用状态见 `triage-labels.md`
- 评论和讨论历史追加到文件底部的 `## Comments` 小节

## 当 skill 说“publish to the issue tracker”

在 `.scratch/<feature-slug>/` 下创建新的 markdown 文件；如果目录不存在，先创建目录。

## 当 skill 说“fetch the relevant ticket”

读取用户提供的相关 markdown 文件路径。用户通常会直接提供文件路径或 issue 编号。
