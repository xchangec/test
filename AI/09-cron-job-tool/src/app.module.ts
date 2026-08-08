import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Job } from './job/entities/job.entity';
import {
  CronExpression,
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';
import { CronJob } from 'cron';
import { JobModule } from './job/job.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: Number(configService.get<string>('MAIL_PORT')),
          secure: configService.get<string>('MAIL_SECURE') === 'true',
          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASS'),
          },
        },
        defaults: {
          from: configService.get<string>('MAIL_FROM'),
        },
      }),
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'admin',
      database: 'hello',
      synchronize: true,
      logging: true,
      entities: [User, Job],
    }),
    AiModule,
    UsersModule,
    JobModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  @Inject(SchedulerRegistry)
  private schedulerRegistry: SchedulerRegistry;

  async onApplicationBootstrap() {
    // const job = new CronJob(CronExpression.EVERY_SECOND, () => {
    //   console.log('run job');
    // });
    // this.schedulerRegistry.addCronJob('job1', job);
    // job.start();
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteCronJob('job1');
    //   console.log('job1 deleted');
    // }, 5000);

    // const intervalRef = setInterval(() => {
    //   console.log('run interval');
    // }, 1000);
    // this.schedulerRegistry.addInterval('interval1', intervalRef);
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteInterval('interval1');
    //   console.log('interval1 deleted');
    // }, 5000);

    // const timeoutRef = setTimeout(() => {
    //   console.log('run timeout');
    // }, 3000);
    // this.schedulerRegistry.addTimeout('timeout1', timeoutRef);
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteTimeout('timeout1');
    //   console.log('timeout1 deleted');
    // }, 5000);
  }
}
