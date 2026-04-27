# Pattern: Lombok 使用规范

正确用法:
```java
@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order { }
```

禁止:
```java
// @Data 在 @Entity 上会导致 equals/hashCode 问题
@Data
@Entity
public class Order { }
```
