# Reflection: TICKET-JAVA-004 — Credits 提现与手续费系统

## 任务概述
实现 Credits → 法币提现能力，包含申请、冻结、审批、手续费计算、风控限额、管理员审批接口。

## 架构决策

### 1. 冻结/解冻模型（在 CreditsAccount 上扩展）
- 新增 `frozen_balance` 字段到 `t_credits_account`
- 三个原子 SQL 操作：`freezeBalance`（balance→frozen）、`unfreezeBalance`（frozen→balance）、`deductFrozenBalance`（frozen扣除，total_withdrawn增加）
- 全部使用乐观锁（version 字段），失败时抛 BusinessException

### 2. 流水记录时机
- `type=WITHDRAW` 和 `type=FEE` 的 `credits_transaction` 在**审批通过时**写入
- 申请阶段只冻结，不产生流水，避免申请后取消产生脏数据

### 3. 自动审批
- 申请金额 ≤ `autoApproveThreshold`（默认 5000 credits）时同步自动审批
- 大额保持 PENDING，等待管理员审批

### 4. 管理员接口安全
- payment-service 无 Spring Security，沿用 `X-Internal-Token` 模式
- `AdminWithdrawalController` 每个方法校验 `InternalApiConfig.validate(token)`

### 5. account_info 加密
- 自研 `WithdrawalAccountEncryptor`：AES-256-GCM，密钥从 `WITHDRAWAL_ENCRYPT_KEY` 环境变量读取
- 不引入 Jasypt 依赖，保持自包含
- 启动时 `@PostConstruct` 强制校验密钥长度（32 字符）

## 测试策略
- CreditsAccountServiceImpl：新增 7 个测试（freeze/unfreeze/deductFrozen 各 2-3 个场景）
- WithdrawalServiceImpl：13 个测试覆盖申请、自动审批、余额不足、风控限额、审批、拒绝、完成、失败、查询
- 全部 66 个 payment-service 测试通过

## 遇到的坑

1. **MyBatis Plus BaseMapper.insert() Mockito 歧义**
   - `insert(T)` 与 `insert(Collection<T>)` 重载导致 `any()` 推断失败
   - 解决：`any(CreditsTransaction.class)` 显式指定类型

2. **BigDecimal 比较**
   - `new BigDecimal("600")` ≠ `new BigDecimal("600.0000")`
   - 解决：断言使用 `compareTo` 而非 `equals`

3. **TransactionTemplate 注入优于 PlatformTransactionManager**
   - 测试中可直接 mock `TransactionTemplate.execute()` 并让它执行 callback

## 代码规范检查
- [x] Lombok: `@Getter @Setter`，无 `@Data` on `@Entity`
- [x] 异常: `BusinessException` 全局处理
- [x] 日志: SLF4J 结构化 JSON，无 System.out
- [x] API 响应: 统一 `Result<T>`
- [x] 数据库: MyBatis Plus `#{}` 参数绑定
- [x] Auth: Admin 接口 `X-Internal-Token` 校验
- [x] Secrets: 密码密钥从环境变量读取，无 hardcode

## 文件清单
- schema.sql: 新增 frozen_balance + t_withdrawal_record
- application.yml: 新增 withdrawal 配置段
- 新建: WithdrawalRecord, WithdrawalStatus, WithdrawalRecordMapper, WithdrawalService, WithdrawalServiceImpl
- 新建: WithdrawalConfig, WithdrawalAccountEncryptor, WithdrawalController, AdminWithdrawalController
- 修改: CreditsAccount, CreditsAccountMapper, CreditsAccountService, CreditsAccountServiceImpl, CreditsBalanceVO
- 测试: CreditsAccountServiceImplTest (+7), WithdrawalServiceImplTest (13)
