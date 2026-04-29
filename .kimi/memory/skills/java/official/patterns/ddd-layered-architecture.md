> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: DDD 鍒嗗眰鏋舵瀯

```
com.agenthive.{service}/
鈹溾攢鈹€ application/          # 搴旂敤鏈嶅姟锛岀紪鎺掗鍩熷璞?
鈹?  鈹溾攢鈹€ service/          # ApplicationService
鈹?  鈹斺攢鈹€ dto/              # DTO / Command / Query
鈹溾攢鈹€ domain/               # 棰嗗煙灞傦紝鏍稿績涓氬姟閫昏緫
鈹?  鈹溾攢鈹€ entity/           # 鑱氬悎鏍?+ 瀹炰綋
鈹?  鈹溾攢鈹€ valueobject/      # 鍊煎璞?
鈹?  鈹溾攢鈹€ repository/       # 浠撳偍鎺ュ彛
鈹?  鈹斺攢鈹€ service/          # 棰嗗煙鏈嶅姟
鈹溾攢鈹€ infrastructure/       # 鍩虹璁炬柦
鈹?  鈹溾攢鈹€ mapper/           # MyBatis Mapper
鈹?  鈹溾攢鈹€ repository/       # 浠撳偍瀹炵幇
鈹?  鈹斺攢鈹€ config/           # 閰嶇疆绫?
鈹斺攢鈹€ interfaces/           # 鎺ュ彛閫傞厤灞?
    鈹溾攢鈹€ controller/       # REST API
    鈹斺攢鈹€ facade/           # 瀵瑰Facade
```

瑙勫垯:
- Controller 鍙礋璐ｈВ鏋愯姹傘€佽皟鐢?Service銆佽繑鍥?Result<T>
- Service 鍙礋璐ｇ紪鎺掞紝涓嶅啓涓氬姟閫昏緫
- 涓氬姟閫昏緫鍦?domain/service/ 鎴?entity 鍐呴儴
- 绂佹璺ㄥ眰璋冪敤锛圕ontroller 鐩存帴璋?Mapper锛?
