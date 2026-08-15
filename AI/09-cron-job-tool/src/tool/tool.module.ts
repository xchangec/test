import { forwardRef, Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { WebSearchToolService } from "./web-search-tool.service";
import { SendMailToolService } from "./send-mail-tool.service";
import { TimeNowToolService } from "./time-now-tool.service";
import { DbUsersCrudToolService } from "./db-users-crud-tool.service";
import { CronJobToolService } from "./cron-job-tool.service";
import { UsersModule } from "src/users/users.module";
import { JobModule } from "src/job/job.module";

@Module({
    imports: [UsersModule, forwardRef(() => JobModule)],
    providers: [
        LlmService,
        WebSearchToolService,
        SendMailToolService,
        TimeNowToolService,
        DbUsersCrudToolService,
        CronJobToolService,
        {
            provide: 'CHAT_MODEL',
            useFactory: (llmService: LlmService) => llmService.getModel(),
            inject: [LlmService],
        },
        {
            provide: 'SEND_MAIL_TOOL',
            useFactory: (svc: SendMailToolService) => svc.tool,
            inject: [SendMailToolService],
        },
        {
            provide: 'WEB_SEARCH_TOOL',
            useFactory: (svc: WebSearchToolService) => {
                return svc.tool;
            },
            inject: [WebSearchToolService],
        },
        {
            provide: 'DB_USERS_CRUD_TOOL',
            useFactory: (svc: DbUsersCrudToolService) => svc.tool,
            inject: [DbUsersCrudToolService],
        },
        {
            provide: 'CRON_JOB_TOOL',
            useFactory: (svc: CronJobToolService) => svc.tool,
            inject: [CronJobToolService],
        },
        {
            provide: 'TIME_NOW_TOOL',
            useFactory: (svc: TimeNowToolService) => {
                return svc.tool;
            },
            inject: [TimeNowToolService],
        }
    ],
    exports: [
        'CHAT_MODEL',
        'SEND_MAIL_TOOL',
        'WEB_SEARCH_TOOL',
        'DB_USERS_CRUD_TOOL',
        'CRON_JOB_TOOL',
        'TIME_NOW_TOOL',
    ],
})

export class ToolModule { }