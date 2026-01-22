# MemoVault 项目目录结构

```
bianqian/
├── prisma/
│   └── schema.prisma              # Prisma 数据库模型（仅元数据）
│
├── public/                       # 静态资源
│   └── favicon.ico
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── login/route.ts
│   │   │   ├── sync/
│   │   │   │   └── blob/route.ts
│   │   │   └── upload/
│   │   │       └── s3/route.ts
│   │   ├── graph/
│   │   │   └── page.tsx          # 知识图谱视图
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 主页（笔记列表）
│   │   └── globals.css          # 全局样式
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # 主应用外壳
│   │   │   ├── Sidebar.tsx       # 侧边栏
│   │   │   └── Header.tsx        # 顶部导航
│   │   ├── editor/
│   │   │   ├── NoteEditor.tsx    # 笔记编辑器
│   │   │   └── WikiLink.tsx      # WikiLink 组件
│   │   ├── graph/
│   │   │   └── KnowledgeGraph.tsx # Cytoscape 图谱
│   │   ├── search/
│   │   │   ├── CommandPalette.tsx # Cmd+K 搜索
│   │   │   └── SearchResults.tsx  # 搜索结果
│   │   └── ui/                    # Shadcn/UI 组件
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── dialog.tsx
│   │       └── ...
│   │
│   ├── lib/                       # 共享逻辑库
│   │   ├── db.ts                  # Dexie.js 本地数据库
│   │   ├── crypto.ts              # Web Crypto API 加密
│   │   ├── sync.ts                # Y.js 同步引擎
│   │   ├── search.ts              # Orama 搜索
│   │   └── utils.ts               # 工具函数
│   │
│   ├── server/                    # 服务端代码
│   │   ├── socket.ts              # WebSocket 服务器
│   │   ├── auth.ts                # JWT 认证
│   │   └── storage.ts             # S3 存储服务
│   │
│   └── types/
│       └── schema.ts              # 共享类型定义
│
├── .env.local                    # 环境变量
├── .gitignore
├── next.config.js                # Next.js 配置
├── package.json                  # 项目依赖
├── tsconfig.json                 # TypeScript 配置
└── README.md                     # 项目文档
```

## 架构说明

### 数据流
1. **用户操作** → UI 组件
2. **UI** → Dexie.js (IndexedDB) [本地优先]
3. **Dexie** → Y.js (CRDT)
4. **Y.js** → WebSocket → 服务器
5. **服务器** → PostgreSQL (元数据) + S3 (加密 Blob)

### 安全层级
- **客户端加密**: 所有数据在发送前使用 Web Crypto API 加密
- **零知悉服务器**: 服务器仅存储加密后的 Blob，无法解密
- **PBKDF2 密钥派生**: 从用户密码派生主密钥
- **JWT 认证**: 无状态认证机制

### 技术栈
- **前端**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **本地存储**: Dexie.js (IndexedDB), Y.js (CRDT)
- **后端**: Next.js API Routes, Custom WebSocket Server
- **数据库**: PostgreSQL (Prisma) + MinIO/R2 (S3 Compatible)
- **UI**: Shadcn/UI, Lucide React
- **可视化**: Cytoscape.js
- **搜索**: Orama (客户端全文搜索)
