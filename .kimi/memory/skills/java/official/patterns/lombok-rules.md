> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Lombok 浣跨敤瑙勮寖

姝ｇ‘鐢ㄦ硶:
```java
@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order { }
```

绂佹:
```java
// @Data 鍦?@Entity 涓婁細瀵艰嚧 equals/hashCode 闂
@Data
@Entity
public class Order { }
```
