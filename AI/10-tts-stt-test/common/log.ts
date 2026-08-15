import * as fs from 'fs';
import * as path from 'path';

export class Log {
  fileName: string;
  logFile: string;
  logFileFormat: string;
  constructor(fileName: string = 'temp') {
    this.fileName = fileName;
    this.logFile = path.resolve(
      process.cwd(),
      'logs',
      `${this.fileName}.log`,
    );
    this.logFileFormat = path.resolve(
      process.cwd(),
      'logs',
      `${this.fileName}-format.log`,
    );
    const logDir = path.dirname(this.logFile);
    const logDirFormat = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    if (!fs.existsSync(logDirFormat)) {
      fs.mkdirSync(logDirFormat, { recursive: true });
    }
    fs.writeFileSync(this.logFile, '', 'utf8');
    fs.writeFileSync(this.logFileFormat, '', 'utf8');
  }
  appendLog(msg: string | Object) {
    // console.log('typeof msg:',typeof msg);
    const content = typeof msg === 'object' ? JSON.stringify(msg) : msg;
    const contentForamt =
      typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const line = `[${dateStr}] ${content}\n`;
    const lineFormat = `${contentForamt}\n`;
    try {
      fs.appendFileSync(this.logFile, line, 'utf8');
      fs.appendFileSync(this.logFileFormat, lineFormat, 'utf8');
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }
}
