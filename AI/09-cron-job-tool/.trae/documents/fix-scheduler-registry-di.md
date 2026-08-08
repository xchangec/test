# 修复 SchedulerRegistry 依赖注入错误

## Summary（概述）

启动服务时报错 `UnknownDependenciesException: Nest can't resolve dependencies of the AppModule. Please make sure that the "schedulerRegistry" property is available in the current context.`

根因：[app.module.ts](file:///e:/project/test/AI/09-cron-job-tool/src/app.module.ts) 中通过 `@Inject(SchedulerRegistry)` 注入了 `SchedulerRegistry`，并在 `onApplicationBootstrap()` 中使用它注册 Cron / Interval / Timeout 任务，但 `@Module` 的 `imports` 数组里**没有引入 `ScheduleModule.forRoot()`**。

`SchedulerRegistry` 是由 `@nestjs/schedule` 的 `ScheduleModule` 提供的 provider，只有在 `ScheduleModule.forRoot()` 被 import 后，DI 容器里才存在这个 provider，才能被注入。

修复方式：在 `AppModule` 的 `imports` 中加入 `ScheduleModule.forRoot()`，并补充相应 import。这是官方标准做法，改动单一、无歧义。

## Current State Analysis（现状分析）

- 依赖已安装并声明：
  - [package.json](file:///e:/project/test/AI/09-cron-job-tool/package.json#L31) 已声明 `@nestjs/schedule` `^6.1.3`、`cron` `^4.4.0`。
  - 实测 `node_modules/@nestjs/schedule` 与 `node_modules/cron` 均已安装（INSTALLED）。
- [app.module.ts](file:///e:/project/test/AI/09-cron-job-tool/src/app.module.ts#L12) 当前仅从 `@nestjs/schedule` 导入了 `CronExpression` 和 `SchedulerRegistry`，**未导入 `ScheduleModule`**。
- [app.module.ts](file:///e:/project/test/AI/09-cron-job-tool/src/app.module.ts#L16-L54) 的 `imports` 数组包含 `ServeStaticModule`、`ConfigModule`、`MailerModule`、`TypeOrmModule`、`AiModule`、`UsersModule`，**缺少 `ScheduleModule.forRoot()`**。
- [app.module.ts](file:///e:/project/test/AI/09-cron-job-tool/src/app.module.ts#L58-L87) 的 `onApplicationBootstrap()` 已写好完整的调度演示逻辑（添加并在 5 秒后删除 cron / interval / timeout），逻辑本身不需要改动。

## Proposed Changes（具体改动）

### 文件：src/app.module.ts

**改动 1：补充 `ScheduleModule` 的 import**

- What：将第 12 行的导入语句改为同时导入 `ScheduleModule`。
- Why：`ScheduleModule.forRoot()` 是提供 `SchedulerRegistry` 的模块，必须先导入这个符号才能在 `imports` 中使用。
- How：
  - 现状：`import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';`
  - 修改为：`import { CronExpression, ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';`

**改动 2：在 `imports` 数组中加入 `ScheduleModule.forRoot()`**

- What：在 `@Module({ imports: [...] })` 数组中添加 `ScheduleModule.forRoot()`（建议放在数组靠前位置，例如 `ServeStaticModule.forRoot(...)` 之前或之后均可，位置不影响功能）。
- Why：`forRoot()` 会向全局 DI 容器注册 `SchedulerRegistry` 等调度相关 provider，注册后 `AppModule` 内的 `@Inject(SchedulerRegistry)` 才能解析成功。
- How：在 `imports: [` 之后新增一行 `ScheduleModule.forRoot(),`。

## Assumptions & Decisions（假设与决策）

- 假设：`@nestjs/schedule` 版本 6.x 的 API 与代码用法一致（`ScheduleModule.forRoot()`、`SchedulerRegistry.addCronJob/addInterval/addTimeout/deleteXxx`）。这是该库的稳定公开 API，无需改动业务逻辑。
- 决策：仅补充缺失的模块导入，不修改 `onApplicationBootstrap()` 中的调度逻辑，遵循"最小改动"原则。
- 不改动 `package.json`：依赖已安装且版本满足，无需重新安装。
- 与数据库无关：此前的数据库 `ECONNREFUSED` 是另一个独立的运行环境问题（MySQL 未启动），不在本次修复范围内。若数据库仍未启动，服务会通过 DI 阶段但在 TypeORM 连接阶段继续重试——本次修复只负责消除 `SchedulerRegistry` 的 DI 错误。

