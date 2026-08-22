// BadRequestException: NestJS 内置异常之一，抛出后会自动转成 HTTP 400 响应，
// 常用于"客户端请求参数错误/缺失"的场景（语义比直接抛 Error 更明确）。
// 其他同类异常：UnauthorizedException(401)、ForbiddenException(403)、NotFoundException(404) 等。
import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
// FileInterceptor: 拦截器，基于 multer 封装，专门用于"单个文件上传"场景。
// 它会从 multipart/form-data 请求中提取指定字段的文件，挂到 request 上，供 @UploadedFile 取用。
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';

// @Controller: 声明该类是一个 NestJS 控制器，路径前缀为 'speech'。
// 本类内所有路由都会以 /speech 开头。
@Controller('speech')
export class SpeechController {
    // 依赖注入：NestJS 实例化本类时自动注入 SpeechService 实例。
    constructor(private readonly speechService: SpeechService) { }

    // @Post('asr'): 映射 POST /speech/asr 请求到本方法。
    @Post('asr')
    // @UseInterceptors: 在本路由上挂载拦截器。拦截器在"路由处理函数前后"都能介入，
    // 常见用途：日志、缓存、转换响应、文件上传预处理等。
    // 这里挂的是 FileInterceptor，专门处理 multipart/form-data 中的文件部分。
    // FileInterceptor('audio'): 参数 'audio' 指的是 FormData 中对应的字段名，
    // 即前端必须用 formData.append('audio', fileBlob) 这样上传；字段名不一致就拿不到文件。
    @UseInterceptors(FileInterceptor('audio'))
    // @UploadedFile(): 参数装饰器，从请求中取出由 FileInterceptor 拦截后挂载的单个上传文件对象。
    // 拿到的 file 是 multer 的 File 对象（内存模式下含 buffer），这里手动标注了其结构。
    async recognize(@UploadedFile() file: {
        buffer: Buffer;      // 文件二进制内容（因为使用 memoryStorage 才有这个字段）
        originalname: string; // 上传时的原始文件名
        mimetype: string;     // MIME 类型，如 audio/wav、audio/mpeg
        size: number;         // 文件字节数
    }) {
        // 前置校验：如果 buffer 不存在或长度为 0，说明前端没正确上传文件。
        // 直接抛 BadRequestException，NestJS 会返回 HTTP 400 + 错误信息给客户端，
        // 比让下游 service 拿到空数据再报错更清晰、也更省资源。
        if (!file?.buffer?.length) {
            throw new BadRequestException('请通过 FormData 的 audio 字段上传音频文件');
        }
        // 校验通过，交给 service 做语音识别（按句子级别识别），返回识别出的文本。
        const text = await this.speechService.recognizeBySentence(file);
        return { text };
    }
}
