# MemoVault - Phase 2: 知识图谱与二进制处理

## 项目概述

MemoVault 是一个零知识、本地优先的笔记应用，专注于隐私保护和数据安全。Phase 2 扩展了基础功能，增加了知识图谱、安全文件附件和语义搜索能力。

### 核心特性

- 🔒 **零知识架构**：服务器永远无法访问用户数据
- 🔗 **双向链接**：支持 WikiLink 语法的知识图谱
- 📎 **安全附件**：流式加密的大文件处理
- 🔍 **语义搜索**：本地向量搜索，无需云端 AI
- 🔗 **零信任共享**：URL 哈希片段密钥传递

---

## 技术栈

### 前端
- **TypeScript** - 类型安全
- **React** - UI 框架
- **Cytoscape.js** - 图可视化
- **Orama** - 本地搜索引擎
- **Transformers.js** - WebAssembly 嵌入模型

### 存储
- **IndexedDB** - 本地数据存储
- **S3** - 加密文件存储

### 加密
- **Web Crypto API** - 浏览器原生加密
- **AES-GCM** - 对称加密
- **PBKDF2** - 密钥派生

---

## 项目结构

```
bianqian/
├── src/
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义
│   ├── services/
│   │   └── StreamEncryptionService.ts  # 流式加密服务
│   ├── core/
│   │   ├── KnowledgeGraphEngine.ts    # 知识图谱引擎
│   │   └── VectorSearchEngine.ts      # 向量搜索引擎
│   └── ...
├── docs/
│   ├── dangling-reference-solution.md  # 悬空引用解决方案
│   └── zero-trust-sharing-mechanism.md # 零信任共享机制
└── README.md
```

---

## 核心模块

### 1. 知识图谱引擎 ([`KnowledgeGraphEngine.ts`](src/core/KnowledgeGraphEngine.ts))

**功能：**
- WikiLink 语法解析（`[[WikiLink]]`）
- 双向链接维护（ForwardLinks 和 Backlinks）
- 图数据结构管理（邻接表）
- Cytoscape.js 可视化数据生成
- 图统计分析（强连通分量、最短路径等）

**使用示例：**
```typescript
const engine = new KnowledgeGraphEngine();
await engine.initialize(notes);

// 生成可视化数据
const graphData = engine.generateCytoscapeData();

// 查找最短路径
const path = engine.findShortestPath(noteId1, noteId2);
```

---

### 2. 流式加密服务 ([`StreamEncryptionService.ts`](src/services/StreamEncryptionService.ts))

**功能：**
- 大文件分块加密（1MB 块）
- 流式处理（TransformStream）
- Web Worker 支持（保持 60fps UI）
- S3 分块上传/下载
- 文件完整性验证（SHA-256）

**使用示例：**
```typescript
const service = new StreamEncryptionService();
await service.initialize(masterKey);

// 加密并上传文件
const attachment = await service.encryptAndUploadFile(
  file,
  noteId,
  (progress) => console.log(progress)
);

// 下载并解密文件
const blobUrl = await service.downloadAndDecryptFile(attachment);
```

---

### 3. 向量搜索引擎 ([`VectorSearchEngine.ts`](src/core/VectorSearchEngine.ts))

**功能：**
- Transformers.js 嵌入模型（all-MiniLM-L6-v2）
- Web Worker 嵌入生成
- IndexedDB 向量存储
- 本地余弦相似度搜索
- 混合搜索（向量 + 关键词）

**使用示例：**
```typescript
const engine = new VectorSearchEngine();
await engine.initialize(notes);

// 批量索引笔记
await engine.indexNotes(notes, (status) => console.log(status));

// 执行搜索
const results = await engine.search({
  query: '如何使用知识图谱',
  limit: 10,
  threshold: 0.7,
  useVectorSearch: true,
  useKeywordSearch: true
});
```

---

### 4. 零信任共享机制

**功能：**
- URL 哈希片段密钥传递
- 服务器零知识
- 过期时间和访问次数限制
- 密码保护（可选）

**URL 格式：**
```
https://memovault.com/share/{EncryptedNoteID}#{EphemeralKey}
```

**使用示例：**
```typescript
// 创建共享链接
const shareUrl = await createShareLink(note);

// 访问共享笔记
const note = await accessSharedNote(shareUrl);
```

---

## 类型定义

完整的 TypeScript 类型定义位于 [`src/types/index.ts`](src/types/index.ts)，包括：

- **笔记类型**：`Note`, `LinkReference`, `WikiLink`
- **附件类型**：`Attachment`, `EncryptedChunk`, `UploadProgress`
- **加密类型**：`EncryptionConfig`, `EncryptedData`
- **图谱类型**：`GraphNode`, `GraphEdge`, `AdjacencyList`
- **搜索类型**：`EmbeddingResult`, `SearchResult`, `SearchOptions`
- **共享类型**：`ShareLink`, `ShareMetadata`, `SharePermissions`
- **同步类型**：`SyncEvent`, `SyncStatus`, `ConflictResolution`

---

## 悬空引用问题解决方案

详细的解决方案文档位于 [`docs/dangling-reference-solution.md`](docs/dangling-reference-solution.md)。

**核心策略：**
1. **软删除 + 引用追踪**（推荐）
2. **引用自动修复**
3. **分布式引用协议**（高级）

**实现要点：**
- 永不真正删除笔记，标记为 `isDeleted: true`
- 维护全局引用图
- 自动更新所有引用该笔记的链接
- 支持恢复已删除笔记

---

## 零信任共享机制

详细的实现说明位于 [`docs/zero-trust-sharing-mechanism.md`](docs/zero-trust-sharing-mechanism.md)。

**核心原则：**
1. **服务器零知识**：服务器只存储加密数据
2. **密钥隔离**：密钥存储在 URL 哈希片段中
3. **临时性**：可设置过期和访问限制

**安全性保证：**
- ✅ 服务器永远无法解密用户数据
- ✅ 密钥从未发送到服务器
- ✅ 使用 HTTPS 确保传输安全
- ✅ 支持密码保护和访问限制

---

## 性能优化

### 1. Web Workers
- 加密/解密操作在 Worker 中执行
- 嵌入生成在 Worker 中执行
- 保持 UI 在 60fps

### 2. 流式处理
- 使用 TransformStream 处理大文件
- 分块加密避免内存溢出
- 增量更新索引

### 3. 缓存策略
- 嵌入向量缓存
- 图数据缓存
- IndexedDB 持久化

---

## 隐私保证

### 1. 服务器零知识
- 服务器只存储加密数据
- 笔记标题在本地解密后用于渲染
- 服务器看不到任何明文内容

### 2. 本地优先
- 所有数据处理在本地完成
- IndexedDB 存储本地数据
- 可离线使用

### 3. 端到端加密
- 使用 Web Crypto API
- AES-GCM 对称加密
- PBKDF2 密钥派生

---

## 开发指南

### 环境要求
- Node.js 18+
- TypeScript 5+
- 现代浏览器（支持 Web Crypto API）

### 安装依赖
```bash
npm install
```

### 运行开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

---

## 未来计划

### Phase 3 - 协作功能
- 实时协作编辑
- 冲突解决机制
- 版本历史

### Phase 4 - AI 助手
- 本地 AI 助手
- 自动摘要
- 智能推荐

### Phase 5 - 移动端
- React Native 应用
- 离线同步
- 生物识别解锁

---

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 联系方式

- 项目主页：https://github.com/yourusername/memovault
- 问题反馈：https://github.com/yourusername/memovault/issues
- 邮箱：support@memovault.com

---

## 致谢

感谢以下开源项目：
- [Cytoscape.js](https://js.cytoscape.org/) - 图可视化
- [Orama](https://orama.com/) - 本地搜索引擎
- [Transformers.js](https://huggingface.co/docs/transformers.js) - WebAssembly AI 模型
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - 浏览器加密

---

**MemoVault - 您的隐私，我们的承诺。** 🔒
