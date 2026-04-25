import "dotenv/config";
import "cheerio";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { getEncoding } from "js-tiktoken";

const logDocument = new Document({
  pageContent: `[2024-01-15 10:00:00] INFO: Application started
    [2024-01-15 10:00:05] DEBUG: Loading configuration file
    [2024-01-15 10:00:10] INFO: Database connection established
    [2024-01-15 10:00:15] WARNING: Rate limit approaching
    [2024-01-15 10:00:20] ERROR: Failed to process request
    [2024-01-15 10:00:25] INFO: Retrying operation
    [2024-01-15 10:00:30] SUCCESS: Operation completed
    [2026-01-10 14:30:00] INFO: 系统开始执行大规模数据迁移任务，本次迁移涉及核心业务数据库中的用户表、订单表、商品库存表、物流信息表、支付记录表、评论数据表等共计十二个关键业务表，预计处理数据量约500万条记录，数据总大小预估为280GB，迁移过程将采用分批次增量更新策略以减少对生产环境的影响，同时启用双写机制确保数据一致性，任务预计总耗时约3小时15分钟，迁移完成后将自动触发全面的数据一致性校验流程以及性能基准测试，请相关运维人员和DBA团队密切关注系统资源使用情况、网络带宽占用率以及任务执行进度，如遇异常情况请立即启动应急预案并通知技术负责人
    `,
});

const logTextSplitter = new CharacterTextSplitter({
  separator: "\n",
  chunkSize: 200,
  chunkOverlap: 20,
});

const splitDocuments = await logTextSplitter.splitDocuments([logDocument]);

const enc = getEncoding("cl100k_base");
splitDocuments.forEach((document) => {
  console.log(document);
  console.log("charater length:", document.pageContent.length);
  console.log("token length:", enc.encode(document.pageContent).length);
});




// CharacterTextSplitter = 按指定字符切长文本的基础工具
// 核心配置：separator（分割符）、chunkSize（片段长度）、chunkOverlap（重叠长度）
// 用法：初始化 → 传入文本 → 调用 splitText()/splitDocuments()
// 适合普通纯文本快速分割，是 RAG 项目最常用的基础分割器

// ✅ 适用

//     普通纯文本（文章、笔记、对话、日志）
//     按段落 / 句子 / 简单字符分割
//     快速实现文本切块

// ❌ 不适用

//     Markdown、代码、JSON 等结构化文本（用 RecursiveCharacterTextSplitter）
//     需要严格语义拆分的专业文档
//     超长文本需要精细化切割的场景


// CharacterTextSplitter 的规则：

//     有分隔符 → 尽量拼，拼到上限再切断
//     没分隔符又超长 → 不切断，直接保留原行（并报警告）
