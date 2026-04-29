# Episode: TICKET.yaml 编码损坏事件

## 时间
2026-04-27

## 触发
Platform 工程师反馈：workspace 中大量 TICKET.yaml 存在编码问题，Python YAML 解析器无法读取，Agent 任务分发可能失败。

## 调查过程
1. Python `yaml.safe_load` 验证发现 22 个文件解析失败
2. 初始误判为 GBK/GB2312 编码问题（Platform 工程师建议）
3. 深入分析发现两类损坏：
   - **单行化**：19 个文件的换行符全部丢失（文件变成 1 行）
   - **UTF-8 字节损坏**：三字节序列的第三个字节被替换为 `?` (0x3F)
4. 追溯根源：Lead 在批量更新 `status: pending → approved` 时使用了 PowerShell 命令：
   ```powershell
   (Get-Content $path) -replace '...' | Set-Content $path -NoNewline
   ```
   - `-NoNewline` 删除了所有换行符
   - PowerShell 5.1 默认编码导致 UTF-8 字节损坏

## 修复尝试
- 中文全角冒号 `：`→ `:` 替换：全部 22 个文件 ✅
- LEAD_REVIEW.yaml BOM 修复：19 个文件 ✅
- 单行结构自动恢复：14/19 成功，6 个因列表项内嵌套 flow mapping 失败

## 决策
用户选择 **方案 C**：保留现状，不修复剩余 6 个损坏的 TICKET.yaml。

理由：
- 损坏的全部是已完成的任务（status = approved/completed）
- 所有待执行任务的 TICKET.yaml 均完好（15 个 pending ticket 验证通过）
- RESPONSE.yaml（35 个完好）和 LEAD_REVIEW.yaml 保留了完整的完成记录
- 手动修复 6 个复杂结构的成本 > 收益

## 影响
- **Agent 扫描**：无影响（pending ticket 全部完好）
- **历史追溯**：轻微影响（损坏的 TICKET.yaml 不可读，但 RESPONSE.yaml 可替代）
- **团队信任**：需警惕未来批量文件操作

## 预防措施
1. 禁止使用 PowerShell `Set-Content -NoNewline` 修改 YAML/文本文件
2. 批量文件修改优先使用 `StrReplaceFile` 工具或 Python + UTF-8 no BOM
3. 修改前先用 Python `yaml.safe_load` 验证文件完整性
4. 如需 PowerShell，显式指定编码：`[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))`
