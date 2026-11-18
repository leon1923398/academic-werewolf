/* ============================================================
   学术狼人杀 · 题库
   四类题目对应四个技能：
     spec   编程规范  → 学术监督员（防火墙）
     review 代码审查  → 代码审核员（身份核验）
     debug  调试排错  → 豆包（好包 / 孬包）
     bug    Bug 识别  → Bug 制造者（暗杀 / 病毒植入）
   每题字段：q 题干 / code 代码片段(可选) / opts 选项 / ans 正确项下标 / why 解析
   ============================================================ */

window.QUESTION_BANK = {

  /* ---------------- 编程规范 ---------------- */
  spec: [
    {
      q: `这段代码的命名最违反哪条规范？`,
      code: `int a, b, c1;   // 分别存学生人数、课程数、平均分`,
      opts: [`命名无法自解释，靠注释兜底，读代码的人必须回头查注释`, `变量声明没有初始化`, `没有写注释`, `不应该用基本类型`],
      ans: 0,
      why: `命名要能自解释。改成 studentCount / courseCount / avgScore 后，注释就是多余的。注释在弥补命名的失职，是坏味道。`
    },
    {
      q: `这段代码最该改的是哪里？`,
      code: `if (elapsed > 86400) {\n    session.expire();\n}`,
      opts: [`把 86400 提取为具名常量 SECONDS_PER_DAY`, `把 if 改成 while`, `给 session 加 try-catch`, `把 86400 改成 86400000`],
      ans: 0,
      why: `裸数字（魔法数）读不出含义，也无法统一修改。const SECONDS_PER_DAY = 24 * 60 * 60; 才是正解——一改全改，含义自明。`
    },
    {
      q: `这个 catch 块的问题是什么？`,
      code: `try {\n    data = JSON.parse(raw);\n} catch (e) { }`,
      opts: [`吞掉异常，故障被静默掩盖，后续拿到 undefined 才崩在更远的地方`, `catch 块不能为空，语法会报错`, `JSON.parse 不会抛异常`, `应该改成 catch(e) { return; }`],
      ans: 0,
      why: `空 catch 是“埋雷”。至少要记录日志，或者转换成一个业务异常往上抛，让故障在发生点附近就暴露。`
    },
    {
      q: `下列函数名中，最需要改的是哪个？`,
      opts: [`handleData()`, `calcTax(amount, rate)`, `isEmailValid(str)`, `saveUser(user)`],
      ans: 0,
      why: `handleData 既没说做什么，也没说输入输出。另外三个都是“动词 + 宾语”，一眼看出行为。`
    },
    {
      q: `这条注释的问题在哪？`,
      code: `// 把 i 加 1\ni++;`,
      opts: [`复述了代码已经表达的内容，没有提供代码本身说不出的信息`, `注释应该写在行尾`, `中文注释不符合规范`, `i++ 应该写成 i = i + 1`],
      ans: 0,
      why: `好注释解释“为什么”，不是“是什么”。代码已经说了 i++，注释该说的是：为什么这里必须加一。`
    },
    {
      q: `布尔变量命名，哪个最不容易被误读？`,
      opts: [`isDeleted`, `deleteFlag2`, `flag`, `status`],
      ans: 0,
      why: `布尔命名用 is/has/can 前缀，读起来就是一个判断句。flag、status 这种名字，过两周自己都要回去看定义。`
    },
    {
      q: `以下 commit message 中，哪条最符合规范？`,
      opts: [`fix: 修复登录态过期后重复跳转的问题`, `改了一下`, `update`, `111`],
      ans: 0,
      why: `好的提交信息 = 类型前缀 + 说清“改了什么、为什么改”。三个月后 git log 是你唯一的现场笔录。`
    },
    {
      q: `这段嵌套最该用哪种重构？`,
      code: `function pay(o){\n  if(o){\n    if(o.user){\n      if(o.user.balance > 0){\n        return doPay(o);\n      }\n    }\n  }\n  return null;\n}`,
      opts: [`用卫语句（提前 return）逐层剥掉 if`, `把三个 if 合并成一个 && 表达式`, `加 try-catch`, `把参数 o 改成全局变量`],
      ans: 0,
      why: `卫语句把“异常分支”提到最前面挡掉，主干逻辑就留在最外层。嵌套层数从 3 降到 0，可读性提升最明显。`
    },
    {
      q: `这段代码在代码审查时会被判定为什么级别的问题？`,
      code: `const API_KEY = "sk-live-9f8a...";\nconst DB_PASS = "root123";`,
      opts: [`高危：密钥入库，仓库一旦泄露即全量失守`, `低危：只是可读性问题`, `中危：只影响性能`, `无问题：常量本来就是这么写的`],
      ans: 0,
      why: `密钥必须走环境变量 / 配置中心 / 密钥管理服务。一旦进了 git 历史，删掉也还在历史里，必须立即轮换。`
    },
    {
      q: `文件顶部 import 了 8 个模块，实际只用了 3 个。审查意见应该怎么写？`,
      opts: [`删除未使用的 5 个导入`, `留着，反正不影响运行`, `加注释说明为什么导入`, `全部改成 require`],
      ans: 0,
      why: `未使用的导入会误导阅读者、拖慢构建、还可能引入不必要的传递依赖。删掉是零成本的改进。`
    },
    {
      q: `一个函数 320 行、承担 7 件事。最该做的第一件事是？`,
      opts: [`按职责拆成若干小函数，每个函数只做一件事`, `加更多注释来分段`, `把变量名改短以节省行数`, `拆成 7 个文件`],
      ans: 0,
      why: `单一职责是重构的第一刀。320 行的函数无法测试、无法复用、改一处要通读全篇。`
    },
    {
      q: `这两行日志的问题在哪？`,
      code: `logger.error("用户点击了按钮");\nlogger.debug("数据库连接失败，重试 3 次后放弃");`,
      opts: [`级别用反了：正常行为打成 error，故障打成 debug`, `日志里不该出现中文`, `应该改用 print`, `error 和 debug 是同义词`],
      ans: 0,
      why: `级别错位会让告警失灵、真故障被淹没在噪音里。error 留给真故障，debug 留给排查细节。`
    },
    {
      q: `这段 Python 代码的经典缺陷是？`,
      code: `def add_item(item, bucket=[]):\n    bucket.append(item)\n    return bucket`,
      opts: [`默认参数在函数定义时只求值一次，多次调用会共享同一个 list`, `list 不能作为参数`, `append 没有返回值`, `应该改成 tuple`],
      ans: 0,
      why: `默认值在 def 执行时就创建了，是可变对象就会被所有调用共享。标准写法是 bucket=None，函数内再 bucket = bucket or []。`
    },
    {
      q: `一个函数有 9 个参数。审查意见最合理的是？`,
      opts: [`把相关参数聚成配置对象 / 结构体传入`, `按字母序重排参数`, `全部改成全局变量`, `拆成 9 个函数`],
      ans: 0,
      why: `参数超过 4 个就该考虑聚合。9 个位置参数调用时几乎必然传错顺序，而且编译器不会告诉你。`
    },
    {
      q: `这三行声明的规范问题是什么？`,
      code: `let userName = "";\nlet user_name2 = "";\nlet UserEmail = "";`,
      opts: [`同一项目里混用了 camelCase / snake_case / PascalCase 三种风格`, `变量名太长`, `不应该用 let`, `下划线是非法字符`],
      ans: 0,
      why: `命名风格必须全项目统一，否则每次看到一个变量都要先猜它是什么类型、什么作用域。`
    }
  ],

  /* ---------------- 代码审查 ---------------- */
  review: [
    {
      q: `代码审查必须指出的问题是？`,
      code: `String sql = "SELECT * FROM users WHERE name='" + name + "'";\nstmt.execute(sql);`,
      opts: [`字符串拼接导致 SQL 注入，应改预编译参数化查询`, `SQL 关键字要小写`, `不应该用 SELECT *`, `execute 改成 executeQuery 就没问题`],
      ans: 0,
      why: `用户输入直接拼进 SQL，输入 ' OR '1'='1 就能绕过条件。必须用 PreparedStatement 占位符 ?，让数据和语句分离。`
    },
    {
      q: `这段代码审查会卡在哪一点？`,
      code: `FileInputStream in = new FileInputStream(f);\nbyte[] buf = new byte[1024];\nin.read(buf);\nreturn parse(buf);`,
      opts: [`流未关闭，异常路径会泄漏文件句柄，应使用 try-with-resources`, `byte 数组应声明为 static`, `parse 应改成 parseData`, `FileInputStream 不能读文件`],
      ans: 0,
      why: `一旦 parse 抛异常，in.close() 永远不执行，句柄慢慢耗尽。try-with-resources 保证任何路径下都释放。`
    },
    {
      q: `这条代码在安全审查中的结论是？`,
      code: `user.setPassword(md5(rawPassword));`,
      opts: [`MD5 无盐已不安全，应改用 bcrypt / Argon2 等慢哈希并加盐`, `MD5 太快，应换成 SHA1`, `应该存明文以支持找回`, `应把密码存进 cookie`],
      ans: 0,
      why: `MD5 算力太快，彩虹表和暴力破解成本极低。慢哈希（bcrypt/scrypt/Argon2）+ 每用户独立盐，才是正确做法。`
    },
    {
      q: `这条 SQL 的性能问题是？`,
      code: `SELECT * FROM orders WHERE order_no LIKE '%20261118%';`,
      opts: [`前导通配符使 B+ 树索引失效，退化为全表扫描`, `SELECT * 会语法错误`, `LIKE 不支持数字`, `orders 表不能建索引`],
      ans: 0,
      why: `索引是有序的，前面加 % 就没法定位起点。要么改成右模糊 '20261118%'，要么上全文索引 / 搜索引擎。`
    },
    {
      q: `这段代码是典型的什么问题？`,
      code: `List<Order> list = orderMapper.selectAll();\nfor (Order o : list) {\n    o.setUser(userMapper.selectById(o.getUserId()));\n}`,
      opts: [`N+1 查询：1 次查列表 + N 次查关联，应改批量 IN 查询或 join`, `死循环`, `内存泄漏`, `事务嵌套`],
      ans: 0,
      why: `1000 条订单就是 1001 次数据库往返。改成一次 selectByIds 批量查回来在内存里拼装，耗时能从秒级降到毫秒级。`
    },
    {
      q: `这段事务使用的问题在哪？`,
      code: `for (Order o : orders) {\n    orderMapper.insert(o);\n    tx.commit();\n}`,
      opts: [`循环内逐条提交，中途失败会留下半批脏数据，应整批一个事务`, `insert 不能放在循环里`, `commit 只能调用一次`, `Order 必须是 final`],
      ans: 0,
      why: `事务的意义就是“要么全成、要么全败”。逐条提交把它变成了 N 个独立事务，失败时无法回滚已提交的部分。`
    },
    {
      q: `支付回调接口没有做幂等处理，会直接导致什么？`,
      opts: [`重复回调导致重复扣款 / 重复发货`, `接口变慢`, `日志变多`, `数据库连接耗尽`],
      ans: 0,
      why: `支付网关按“至少一次”投递，同一个订单号可能回调多次。必须用订单号 + 唯一索引 / 状态机做幂等，保证只处理一次。`
    },
    {
      q: `多线程下这段代码的风险是什么？`,
      code: `Map<String, Integer> m = new HashMap<>();\n// 多个线程同时执行 m.put(k, v)`,
      opts: [`HashMap 非线程安全，并发扩容可能死循环或丢数据，应用 ConcurrentHashMap`, `HashMap 不支持 String 键`, `put 会抛 IOException`, `必须加 final`],
      ans: 0,
      why: `HashMap 在并发 rehash 时链表可能成环（JDK7 经典问题），JDK8 虽改成红黑树但仍会丢数据。并发场景必须 ConcurrentHashMap。`
    },
    {
      q: `这段比较的问题在哪？`,
      code: `if (a.getCreateTime() == b.getCreateTime()) { ... }`,
      opts: [`比较的是对象引用地址而不是时间值，应使用 equals / compareTo`, `时间不能比较`, `应该改成 !=`, `Date 已废弃所以没问题`],
      ans: 0,
      why: `两个内容相同的 Date 对象地址不同，== 永远是 false。要么比 long 时间戳 ==，要么用 equals。`
    },
    {
      q: `这段判断的执行结果是？`,
      code: `if (0.1 + 0.2 == 0.3) {\n    ok();\n} else {\n    fail();\n}`,
      opts: [`走 fail：二进制浮点无法精确表示 0.1/0.2，应用误差范围或 BigDecimal`, `走 ok：数学上成立`, `编译报错`, `取决于 JVM 版本`],
      ans: 0,
      why: `0.1 + 0.2 实际是 0.30000000000000004。金额运算必须用整数分或 BigDecimal，绝不能用 double 直接比较。`
    },
    {
      q: `这段接口的审查结论是？`,
      code: `@GetMapping("/order/{id}")\npublic Order get(@PathVariable Long id) {\n    return orderService.getById(id);\n}`,
      opts: [`缺少归属校验，改 URL 里的 id 就能读他人订单（越权 / IDOR）`, `应该用 POST`, `返回值应为 String`, `路径变量应叫 orderId`],
      ans: 0,
      why: `只校验“登录了”，没校验“这条数据是不是你的”。必须带上当前用户 id 做条件查询，或显式判断归属。`
    },
    {
      q: `这段前端代码的风险是？`,
      code: `document.getElementById('out').innerHTML = userInput;`,
      opts: [`直接把用户输入塞进 innerHTML，可被注入脚本（XSS），应用 textContent 或转义`, `innerHTML 性能差`, `userInput 可能为 null`, `应该用 document.write`],
      ans: 0,
      why: `输入 <img src=x onerror=alert(1)> 就会执行。富文本场景必须过白名单过滤库，纯文本场景直接用 textContent。`
    },
    {
      q: `这条 SQL 的性能问题是？`,
      code: `SELECT * FROM logs ORDER BY id LIMIT 1000000, 20;`,
      opts: [`offset 越大要扫描并丢弃越多行，应改用游标分页（id > 上一页最大 id）`, `LIMIT 最大只能写 1000`, `ORDER BY 不能和 LIMIT 同用`, `20 太小了`],
      ans: 0,
      why: `深翻页时数据库要读取并丢弃前 100 万行。游标分页记住上一页最后一个 id，每次直接从索引位置往后取，代价恒定。`
    },
    {
      q: `更新数据库后不失效缓存，会出现什么？`,
      code: `updateDb(user);\n// 此处没有删除 / 更新缓存`,
      opts: [`读到旧数据（脏读），应删缓存或双写并设置合理过期时间`, `数据库会锁死`, `缓存会越来越大`, `没有影响，缓存会自动同步`],
      ans: 0,
      why: `缓存不会自己知道数据变了。标准做法是“先更新库、再删缓存”，并给缓存设过期时间作为兜底。`
    },
    {
      q: `这条日志的问题在哪？`,
      code: `log.info("login: phone={}, pwd={}", phone, password);`,
      opts: [`明文打印密码，日志一旦落盘或外发即泄露凭据`, `info 级别太低`, `应该用中文`, `phone 不该记录`],
      ans: 0,
      why: `日志是最容易被忽视的泄露面——它会进文件、进 ELK、进第三方监控。密码、身份证、银行卡必须脱敏后再打。`
    }
  ],

  /* ---------------- 调试排错 ---------------- */
  debug: [
    {
      q: `Java 异常堆栈里，最先该看的是哪一条？`,
      opts: [`最上面那条业务代码帧（或最底部的 Caused by），它离故障现场最近`, `最下面的 main 方法`, `行号最大的那一行`, `异常类名字最长的那个`],
      ans: 0,
      why: `堆栈是“调用链的现场笔录”：最上面是出事的那一行，最下面是入口。真正的原因通常藏在最后一个 Caused by 里。`
    },
    {
      q: `线上昨天还好、今天必现，怀疑是某次提交引入。最高效的定位方式是？`,
      opts: [`git bisect 在提交区间里二分，几次就能锁定引入点`, `逐个提交 checkout 手动试`, `把代码全部重读一遍`, `先回滚到上个月`],
      ans: 0,
      why: `100 个提交，二分只需 7 次。git bisect good/bad 会让工具替你完成“一半一半地排除”。`
    },
    {
      q: `循环 10 万次，只想在 id 异常的那一次停下来。应该用？`,
      opts: [`条件断点，条件写 id == 目标值`, `在第 87342 行打断点`, `打日志打印 10 万行`, `改成单步执行`],
      ans: 0,
      why: `条件断点只在表达式为真时中断，其余 99999 次照常跑完。这是调试器最省时间的功能之一。`
    },
    {
      q: `排查一个偶发 bug，第一件该做的事是？`,
      opts: [`找到稳定复现的最小步骤，不能复现的 bug 无法验证修复`, `先猜原因改代码试试`, `先加 20 行日志上线`, `先重启服务`],
      ans: 0,
      why: `没有复现路径，就等于没有验收标准——你永远不知道“改了之后好了”是真好了，还是碰巧没触发。`
    },
    {
      q: `服务运行 3 天后 OOM，重启即恢复。最可能的根因方向是？`,
      opts: [`对象被静态集合 / 缓存 / 监听器长期持有，老年代持续增长无法回收`, `CPU 占用过高`, `磁盘写满`, `网络丢包`],
      ans: 0,
      why: `“重启就好、几天复发”是内存泄漏的典型指纹。用 jmap dump 堆、找支配树里占比最大的那类对象，顺引用链找持有者。`
    },
    {
      q: `线程 dump 里两个线程互相 BLOCKED，各自持有一把对方要的锁。这是？`,
      opts: [`死锁，需打破循环等待（统一加锁顺序或加超时）`, `活锁`, `饥饿`, `正常等待`],
      ans: 0,
      why: `死锁四条件：互斥、占有且等待、不可剥夺、循环等待。工程上最实用的一招是“所有线程按同一顺序获取锁”，直接破坏循环等待。`
    },
    {
      q: `NullPointerException 堆栈指向 a.b.c().d()。最先该确认的是？`,
      opts: [`链式调用中哪一环返回了 null（a / b / c()），拆开逐段打印`, `d() 的内部实现`, `JVM 版本`, `是否开启了断言`],
      ans: 0,
      why: `链式调用一行里可能有四个空指针来源。先拆成四行，哪一行炸了一眼就知道。这也是“别写长链式调用”的实际理由。`
    },
    {
      q: `日志里 A 服务的请求时间比 B 服务收到的时间晚了 3 秒，但网络延迟实测只有 5ms。最可能的原因是？`,
      opts: [`两台机器时钟不同步，应统一 NTP 授时`, `网络抖动`, `磁盘 IO 慢`, `日志框架有 bug`],
      ans: 0,
      why: `跨机日志时间线对不上，九成是时钟漂移。分布式排查前先确认所有节点 NTP 同步，否则你在分析一个不存在的时间差。`
    },
    {
      q: `本机正常、测试环境报错，代码完全一致。优先排查什么？`,
      opts: [`配置、环境变量、依赖版本、数据差异`, `再读一遍源码`, `换一台显示器`, `重装 IDE`],
      ans: 0,
      why: `代码一样而行为不同，差异必然在代码之外。按“配置 → 依赖版本 → 数据 → 系统环境”顺序比对，比读源码快得多。`
    },
    {
      q: `改了数据库但页面还是旧数据，清缓存后立即正常。结论是？`,
      opts: [`缓存未失效 / 未命中更新，属于缓存一致性问题`, `前端浏览器坏了`, `数据库没提交`, `接口返回类型错`],
      ans: 0,
      why: `“清缓存就好”几乎直接指向缓存一致性。要么更新后主动失效，要么给缓存设 TTL 兜底。`
    },
    {
      q: `服务器存的时间比预期少 8 小时。最可能的原因？`,
      opts: [`UTC 与本地时区（东八区）混用，应存储统一 UTC、展示时再转换`, `数据库坏了`, `主板电池没电`, `代码少写了一个 8`],
      ans: 0,
      why: `8 小时正是东八区偏移。时间问题的标准解法：存 UTC 时间戳，展示层按用户时区格式化，永远不存“本地时间字符串”。`
    },
    {
      q: `接口返回的中文全是「锟斤拷」。根因方向是？`,
      opts: [`编码不一致（如 UTF-8 字节被按 GBK 解码），需统一字符集与响应头`, `字体缺失`, `浏览器版本太旧`, `JSON 不支持中文`],
      ans: 0,
      why: `锟斤拷是 UTF-8 被当 GBK 解码的经典产物。检查数据库字符集、连接串、HTTP Content-Type、文件编码四处是否全部 UTF-8。`
    },
    {
      q: `金额累加出现 0.30000000000000004。正确处理方式是？`,
      opts: [`金额用整数分（long）或 BigDecimal / Decimal，禁用 double 累加`, `四舍五入保留 2 位即可`, `改用 float 精度更高`, `加一个 0.0000001 修正`],
      ans: 0,
      why: `浮点误差会累积，四舍五入只是把问题往后推。金融计算的标准做法是用最小货币单位（分）做整数运算。`
    },
    {
      q: `线上某接口偶发 500，但 error 日志里什么都没有。先查什么？`,
      opts: [`异常是否被上层 catch 吞掉，或日志级别被调到 ERROR 以上 / 异步 appender 丢了日志`, `数据库是否宕机`, `是不是用户网络问题`, `重装服务`],
      ans: 0,
      why: `“有故障没日志”通常是日志链路断了：空 catch、级别过滤、异步队列满丢弃。先确认日志管道通不通，再谈定位。`
    },
    {
      q: `接口 P99 从 80ms 涨到 2s，CPU 却不高。下一步最该做的是？`,
      opts: [`抓一次调用链 / 火焰图，看时间花在 IO、锁等待还是下游调用上`, `直接加机器`, `重启服务`, `把所有 SQL 都加索引`],
      ans: 0,
      why: `CPU 不高说明不是算力瓶颈，大概率在等：等 IO、等锁、等下游。先测量再动手，加机器和加索引都是没瞄准的开枪。`
    }
  ],

  /* ---------------- Bug 识别 ---------------- */
  bug: [
    {
      q: `这段代码的 Bug 在哪？`,
      code: `int[] a = new int[5];\nfor (int i = 0; i <= a.length; i++) {\n    a[i] = i;\n}`,
      opts: [`i <= a.length 越界，应为 i < a.length`, `数组不能用 int`, `for 循环不能这样写`, `应该改用 while`],
      ans: 0,
      why: `length 是 5，合法下标 0~4。i 取到 5 时抛 ArrayIndexOutOfBoundsException。这是最经典的差一错误（off-by-one）。`
    },
    {
      q: `count 可能为 0 时，这段整数除法会怎样？`,
      code: `int avg = sum / count;   // count 为 int`,
      opts: [`抛 ArithmeticException（整数除零），需先判 count > 0`, `返回 0`, `返回 Infinity`, `编译不通过`],
      ans: 0,
      why: `整数除零在 Java/C 里是异常或未定义行为（浮点除零才是 Infinity）。做除法前必须显式校验分母。`
    },
    {
      q: `这段 C 代码的问题是什么？`,
      code: `free(p);\nif (p->len > 0) { ... }`,
      opts: [`释放后继续使用悬垂指针（use-after-free），属未定义行为`, `free 不能用于结构体`, `应改用 delete`, `p->len 应写成 (*p).len`],
      ans: 0,
      why: `free 之后 p 指向的内存已归还，内容随时可能被覆写。规范做法是 free(p); p = NULL;，让后续误用立刻崩在明处。`
    },
    {
      q: `为什么 nested 里的内容也被改了？`,
      code: `List<List<String>> b = new ArrayList<>(nested);\nb.get(0).add("x");\n// 结果 nested.get(0) 里也多了 "x"`,
      opts: [`外层只做了浅拷贝，内层 List 仍是同一个引用`, `ArrayList 有 bug`, `String 不可变所以不可能`, `get(0).add 会自动复制`],
      ans: 0,
      why: `new ArrayList<>(list) 只复制了外层容器，元素引用原样搬过来。要真正独立必须逐层深拷贝。`
    },
    {
      q: `level == 1 时，gold 最终增加多少？`,
      code: `switch (level) {\n  case 1: gold += 10;\n  case 2: gold += 20; break;\n}`,
      opts: [`30 —— case 1 没有 break，会贯穿执行 case 2`, `10`, `20`, `0`],
      ans: 0,
      why: `switch 的 case 是“入口”不是“区间”，没有 break 就会一直往下执行（fall-through）。漏写 break 是极常见的生产事故来源。`
    },
    {
      q: `这段代码的隐患是什么？`,
      code: `if (i < len && arr[i++] > 0) { ... }`,
      opts: [`i 的自增依赖短路求值是否执行，i 的最终值不确定，逻辑极难推理`, `&& 不能用于数组`, `i++ 会编译错误`, `没有隐患`],
      ans: 0,
      why: `&& 左侧为 false 时右侧整个不执行，i++ 就不发生。比较条件里带副作用，等于给自己埋了个随机的坑。`
    },
    {
      q: `这段 JS 会输出什么？`,
      code: `for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i));\n}`,
      opts: [`3 3 3 —— var 没有块级作用域，三个回调共享同一个 i`, `0 1 2`, `0 0 0`, `报错`],
      ans: 0,
      why: `var 提升到函数作用域，循环结束时 i 已是 3，回调执行时读到同一个 i。把 var 改成 let 就得到 0 1 2。`
    },
    {
      q: `这段代码会怎样执行？`,
      code: `for (unsigned int i = 5; i >= 0; i--) {\n    // ...\n}`,
      opts: [`死循环 —— 无符号数减到 0 再减一会回绕成 4294967295`, `正常执行 6 次`, `编译报错`, `执行 5 次后退出`],
      ans: 0,
      why: `unsigned 永远 >= 0，循环条件恒真。这是“无符号下界”经典陷阱，编译器给的 warning 千万别忽略。`
    },
    {
      q: `在 C / Java 中，-7 % 3 的结果是多少？`,
      opts: [`-1 —— 结果符号跟被除数走，不能直接拿来当数组下标`, `2`, `1`, `0`],
      ans: 0,
      why: `取模结果的符号跟随被除数，负数取模会得到负数。当索引用必须先 (x % n + n) % n 归一到非负。`
    },
    {
      q: `这段递归缺了什么？`,
      code: `int f(int n) {\n    return f(n - 1) + n;\n}`,
      opts: [`缺少终止条件（n <= 0 时 return 0），会栈溢出`, `缺少 static`, `应该改成循环`, `n 应该改成 long`],
      ans: 0,
      why: `递归必须有两个东西：递推关系 + 终止条件。少了后者就是无限调用，最终 StackOverflowError。`
    },
    {
      q: `这个排序比较函数的问题是什么？`,
      code: `list.sort((a, b) => a.score > b.score ? 1 : -1);`,
      opts: [`相等时返回 -1 破坏传递性，排序结果可能错乱甚至抛异常，应返回 0`, `不能用箭头函数`, `score 应该是字符串`, `没有问题`],
      ans: 0,
      why: `比较函数必须满足自反性（compare(a,a)==0）和传递性。永远不返回 0 会让 TimSort 检测到“非法比较器”直接抛异常。`
    },
    {
      q: `这段代码运行时会发生什么？`,
      code: `for (String s : list) {\n    if (s.isEmpty()) list.remove(s);\n}`,
      opts: [`抛 ConcurrentModificationException，应使用 Iterator.remove 或 removeIf`, `正常删除所有空串`, `什么都不做`, `编译错误`],
      ans: 0,
      why: `foreach 底层是 Iterator，直接改集合会让 modCount 与预期不符。改用 list.removeIf(String::isEmpty) 最简洁安全。`
    },
    {
      q: `这段二分查找的中间值计算有什么隐患？`,
      code: `int mid = (low + high) / 2;   // low、high 均为接近 Integer.MAX_VALUE 的下标`,
      opts: [`low + high 溢出成负数，mid 变负导致越界，应写 low + (high - low) / 2`, `除法会丢失精度`, `应该用 long 存 mid`, `没有隐患`],
      ans: 0,
      why: `两个接近 21 亿的数相加会溢出。这是 JDK 官方修过的真实 bug（binarySearch）。写法 low + (high - low) / 2 永远安全。`
    },
    {
      q: `这段 Java 代码的问题是什么？`,
      code: `if (status == "OK") { ... }`,
      opts: [`== 比较的是引用地址，应使用 "OK".equals(status)`, `应该用 !=`, `status 必须为 null`, `没有问题，字符串常量会驻留`],
      ans: 0,
      why: `字面量在常量池、运行时拼出来的字符串在堆上，地址不同 == 就是 false。用 equals，并把常量放前面避免 NPE。`
    },
    {
      q: `这段扣减库存的代码在并发下会发生什么？`,
      code: `if (stock > 0) {\n    stock = stock - 1;\n}`,
      opts: [`超卖 —— check-then-act 不是原子操作，应用锁 / CAS / 数据库原子更新`, `死循环`, `内存泄漏`, `必然抛异常`],
      ans: 0,
      why: `两个线程可能同时通过 stock > 0 判断，然后各自减一，库存从 1 变成 -1。必须用 UPDATE ... WHERE stock > 0 或 CAS 保证原子性。`
    }
  ]
};

/* 技能 → 题目类别映射 */
window.SKILL_CATEGORY = {
  reviewer:   'review',   // 代码审核员核验
  supervisor: 'spec',     // 学术监督员防火墙
  doubao:     'debug',    // 豆包好包 / 孬包
  bugmaker:   'bug',      // Bug 制造者暗杀 / 病毒植入
  porter:     'bug'       // 备用
};
