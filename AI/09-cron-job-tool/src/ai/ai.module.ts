import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { UserService } from './user.service';
import z, { email } from 'zod';
import { tool } from '@langchain/core/tools';
import { MailerService } from '@nestjs-modules/mailer';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { JobModule } from 'src/job/job.module';
import { JobService } from 'src/job/job.service';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [UsersModule, ToolModule],
  controllers: [AiController],
  providers: [
    UserService,
    AiService,
  ],
})
export class AiModule { }
