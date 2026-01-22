# 零信任共享机制 (Zero-Trust Sharing Mechanism)

## 概述

MemoVault 的零信任共享机制确保服务器永远无法访问用户共享的笔记内容。通过使用 URL 哈希片段（`#`）传递加密密钥，我们实现了真正的端到端加密共享。

---

## 核心原则

### 1. 服务器零知识

服务器只存储加密的数据，永远无法解密：
- ✅ 服务器知道：加密的笔记 ID、加密的数据 blob
- ❌ 服务器不知道：笔记内容、解密密钥、访问者身份

### 2. 密钥隔离

解密密钥永远不会发送到服务器：
- 密钥存储在 URL 的哈希片段中（`#` 之后）
- 浏览器不会将哈希片段发送到服务器
- 只有接收方的浏览器可以访问密钥

### 3. 临时性

共享链接可以设置过期时间和访问次数限制：
- 过期后链接自动失效
- 达到访问次数限制后链接失效
- 可以随时撤销共享

---

## 架构设计

### URL 结构

```
https://memovault.com/share/{EncryptedNoteID}#{EphemeralKey}
```

**示例：**
```
https://memovault.com/share/a1b2c3d4e5f6g7h8i9j0#k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**组成部分：**
- `https://memovault.com/share/` - 共享端点
- `{EncryptedNoteID}` - 服务器端存储的加密笔记 ID
- `#{EphemeralKey}` - 临时解密密钥（仅客户端可见）

---

## 实现流程

### 1. 创建共享链接

#### 步骤 1：生成加密密钥

```typescript
/**
 * 生成共享专用的临时密钥
 */
async function generateShareKey(): Promise<CryptoKey> {
  // 生成随机密钥
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  return key;
}
```

#### 步骤 2：加密笔记

```typescript
/**
 * 使用共享密钥加密笔记
 */
async function encryptNoteForSharing(
  note: Note,
  shareKey: CryptoKey
): Promise<EncryptedData> {
  // 序列化笔记
  const noteData = JSON.stringify({
    title: note.title,
    content: note.content,
    attachments: note.attachments
  });
  
  const encoder = new TextEncoder();
  const data = encoder.encode(noteData);
  
  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 加密
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    shareKey,
    data
  );
  
  return {
    data: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    keyDerivation: {
      salt: '',
      iterations: 0,
      algorithm: 'AES-GCM',
      hash: 'SHA-256'
    },
    algorithm: 'AES-GCM'
  };
}
```

#### 步骤 3：导出密钥

```typescript
/**
 * 导出密钥为 Base64 字符串（用于 URL）
 */
async function exportShareKey(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(rawKey);
}
```

#### 步骤 4：上传到服务器

```typescript
/**
 * 上传加密笔记到服务器
 */
async function uploadSharedNote(
  encryptedData: EncryptedData
): Promise<string> {
  const response = await fetch('/api/share/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedData: encryptedData.data,
      iv: encryptedData.iv,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 天后过期
      maxAccessCount: 10 // 最多访问 10 次
    })
  });
  
  const data = await response.json();
  return data.encryptedNoteId;
}
```

#### 步骤 5：生成共享 URL

```typescript
/**
 * 生成完整的共享 URL
 */
function generateShareURL(
  encryptedNoteId: string,
  shareKey: string
): string {
  return `https://memovault.com/share/${encryptedNoteId}#${shareKey}`;
}

// 完整流程
async function createShareLink(note: Note): Promise<string> {
  // 1. 生成共享密钥
  const shareKey = await generateShareKey();
  
  // 2. 加密笔记
  const encryptedData = await encryptNoteForSharing(note, shareKey);
  
  // 3. 导出密钥
  const shareKeyBase64 = await exportShareKey(shareKey);
  
  // 4. 上传到服务器
  const encryptedNoteId = await uploadSharedNote(encryptedData);
  
  // 5. 生成 URL
  return generateShareURL(encryptedNoteId, shareKeyBase64);
}
```

---

### 2. 访问共享笔记

#### 步骤 1：解析 URL

```typescript
/**
 * 从 URL 中提取加密笔记 ID 和密钥
 */
function parseShareURL(url: string): {
  encryptedNoteId: string;
  shareKey: string;
} {
  const urlObj = new URL(url);
  
  // 从路径中提取加密笔记 ID
  const encryptedNoteId = urlObj.pathname.split('/').pop();
  
  // 从哈希片段中提取密钥（浏览器不会发送到服务器）
  const shareKey = urlObj.hash.slice(1); // 移除 '#'
  
  return { encryptedNoteId, shareKey };
}
```

#### 步骤 2：从服务器获取加密数据

```typescript
/**
 * 从服务器获取加密的笔记数据
 */
async function fetchSharedNote(
  encryptedNoteId: string
): Promise<ShareMetadata> {
  const response = await fetch(`/api/share/${encryptedNoteId}`);
  
  if (!response.ok) {
    throw new Error('Shared note not found or expired');
  }
  
  return await response.json();
}
```

#### 步骤 3：导入密钥

```typescript
/**
 * 从 Base64 字符串导入密钥
 */
async function importShareKey(
  shareKeyBase64: string
): Promise<CryptoKey> {
  const rawKey = base64ToArrayBuffer(shareKeyBase64);
  
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}
```

#### 步骤 4：解密笔记

```typescript
/**
 * 解密共享的笔记
 */
async function decryptSharedNote(
  encryptedData: EncryptedData,
  shareKey: CryptoKey
): Promise<Note> {
  // 解密
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToArrayBuffer(encryptedData.iv)
    },
    shareKey,
    base64ToArrayBuffer(encryptedData.data)
  );
  
  // 反序列化
  const decoder = new TextDecoder();
  const noteData = JSON.parse(decoder.decode(decrypted));
  
  return {
    id: crypto.randomUUID(),
    title: noteData.title,
    content: noteData.content,
    attachments: noteData.attachments,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    forwardLinks: [],
    backlinks: [],
    tags: [],
    isDeleted: false,
    version: 1
  };
}
```

#### 步骤 5：完整流程

```typescript
/**
 * 访问共享笔记的完整流程
 */
async function accessSharedNote(url: string): Promise<Note> {
  // 1. 解析 URL
  const { encryptedNoteId, shareKey } = parseShareURL(url);
  
  // 2. 从服务器获取加密数据
  const shareMetadata = await fetchSharedNote(encryptedNoteId);
  
  // 3. 导入密钥
  const key = await importShareKey(shareKey);
  
  // 4. 解密笔记
  const encryptedData: EncryptedData = {
    data: shareMetadata.encryptedData,
    iv: shareMetadata.iv,
    keyDerivation: {
      salt: '',
      iterations: 0,
      algorithm: 'AES-GCM',
      hash: 'SHA-256'
    },
    algorithm: 'AES-GCM'
  };
  
  const note = await decryptSharedNote(encryptedData, key);
  
  return note;
}
```

---

## 服务器端实现

### API 端点

#### 1. 创建共享

```typescript
// POST /api/share/create
async function createShare(req: Request, res: Response) {
  const { encryptedData, iv, expiresAt, maxAccessCount } = req.body;
  
  // 生成加密的笔记 ID
  const encryptedNoteId = crypto.randomUUID();
  
  // 存储元数据（服务器永远看不到解密密钥）
  const shareMetadata: ShareMetadata = {
    encryptedNoteId,
    encryptedData,
    iv,
    createdAt: Date.now(),
    expiresAt,
    accessCount: 0,
    maxAccessCount
  };
  
  // 保存到数据库
  await db.shares.insert(shareMetadata);
  
  // 返回加密笔记 ID
  res.json({ encryptedNoteId });
}
```

#### 2. 获取共享笔记

```typescript
// GET /api/share/:encryptedNoteId
async function getShare(req: Request, res: Response) {
  const { encryptedNoteId } = req.params;
  
  // 从数据库获取共享元数据
  const share = await db.shares.findOne({ encryptedNoteId });
  
  if (!share) {
    return res.status(404).json({ error: 'Share not found' });
  }
  
  // 检查是否过期
  if (share.expiresAt && share.expiresAt < Date.now()) {
    return res.status(410).json({ error: 'Share expired' });
  }
  
  // 检查访问次数
  if (share.maxAccessCount && share.accessCount >= share.maxAccessCount) {
    return res.status(410).json({ error: 'Share access limit reached' });
  }
  
  // 增加访问计数
  share.accessCount += 1;
  await db.shares.update({ encryptedNoteId }, share);
  
  // 返回加密数据（不包含密钥）
  res.json({
    encryptedData: share.encryptedData,
    iv: share.iv,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt
  });
}
```

#### 3. 撤销共享

```typescript
// DELETE /api/share/:encryptedNoteId
async function revokeShare(req: Request, res: Response) {
  const { encryptedNoteId } = req.params;
  const userId = req.user.id; // 需要身份验证
  
  // 验证用户权限
  const share = await db.shares.findOne({ encryptedNoteId });
  if (!share || share.createdBy !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // 删除共享
  await db.shares.deleteOne({ encryptedNoteId });
  
  res.json({ success: true });
}
```

---

## 安全性分析

### 1. 密钥传输安全

**问题：** 密钥如何安全传输？

**解决方案：**
- 密钥存储在 URL 的哈希片段中（`#` 之后）
- 浏览器不会将哈希片段发送到服务器
- 只有接收方的浏览器可以访问密钥

**验证：**
```javascript
// 服务器端日志
console.log(req.url); // 输出: /share/a1b2c3d4e5f6g7h8i9j0
// 注意：# 之后的密钥不会出现在日志中
```

### 2. 中间人攻击防护

**问题：** 攻击者能否拦截并修改共享 URL？

**解决方案：**
- 使用 HTTPS 确保传输安全
- 密钥从未发送到服务器，无法被拦截
- 即使 URL 被截获，没有密钥也无法解密

### 3. 前向安全性

**问题：** 如果主密钥泄露，旧的共享链接是否安全？

**解决方案：**
- 每个共享链接使用独立的临时密钥
- 主密钥与共享密钥完全隔离
- 撤销主密钥不影响现有共享链接

### 4. 重放攻击防护

**问题：** 攻击者能否重放共享 URL？

**解决方案：**
- 设置过期时间（如 7 天）
- 限制访问次数（如 10 次）
- 可以随时撤销共享链接

---

## 用户体验设计

### 1. 创建共享链接

```typescript
// UI 组件
function ShareDialog({ note }: { note: Note }) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const createShare = async () => {
    setLoading(true);
    try {
      const url = await createShareLink(note);
      setShareUrl(url);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>分享笔记</DialogTitle>
      </DialogHeader>
      
      <DialogContent>
        {!shareUrl ? (
          <Button onClick={createShare} disabled={loading}>
            {loading ? '生成中...' : '创建共享链接'}
          </Button>
        ) : (
          <div>
            <Label>共享链接</Label>
            <Input value={shareUrl} readOnly />
            <Button onClick={() => copyToClipboard(shareUrl)}>
              复制链接
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 2. 访问共享笔记

```typescript
// 页面组件
function SharedNotePage() {
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    const url = window.location.href;
    
    accessSharedNote(url)
      .then(setNote)
      .catch(err => setError(err.message));
  }, []);
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>无法访问笔记</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  if (!note) {
    return <div>加载中...</div>;
  }
  
  return (
    <div>
      <h1>{note.title}</h1>
      <p>{note.content}</p>
    </div>
  );
}
```

### 3. 共享设置

```typescript
// 共享设置组件
function ShareSettings() {
  const [expiresIn, setExpiresIn] = useState(7); // 天
  const [maxAccessCount, setMaxAccessCount] = useState(10);
  
  return (
    <div>
      <Label>过期时间</Label>
      <Select value={expiresIn} onChange={setExpiresIn}>
        <option value={1}>1 天</option>
        <option value={7}>7 天</option>
        <option value={30}>30 天</option>
        <option value={0}>永不过期</option>
      </Select>
      
      <Label>最大访问次数</Label>
      <Input
        type="number"
        value={maxAccessCount}
        onChange={(e) => setMaxAccessCount(Number(e.target.value))}
      />
    </div>
  );
}
```

---

## 高级功能

### 1. 密码保护

```typescript
/**
 * 创建带密码保护的共享链接
 */
async function createPasswordProtectedShare(
  note: Note,
  password: string
): Promise<string> {
  // 从密码派生密钥
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassword(password, salt);
  
  // 加密笔记
  const encryptedData = await encryptNoteForSharing(note, key);
  
  // 上传到服务器
  const encryptedNoteId = await uploadSharedNote(encryptedData);
  
  // 生成 URL（不包含密钥）
  return `https://memovault.com/share/${encryptedNoteId}`;
}

/**
 * 访问带密码保护的共享笔记
 */
async function accessPasswordProtectedShare(
  url: string,
  password: string
): Promise<Note> {
  const { encryptedNoteId } = parseShareURL(url);
  
  // 获取加密数据
  const shareMetadata = await fetchSharedNote(encryptedNoteId);
  
  // 从密码派生密钥
  const key = await deriveKeyFromPassword(
    password,
    base64ToArrayBuffer(shareMetadata.salt)
  );
  
  // 解密笔记
  const note = await decryptSharedNote(shareMetadata, key);
  
  return note;
}
```

### 2. 只读 vs 可编辑

```typescript
/**
 * 创建可编辑的共享链接
 */
async function createEditableShare(
  note: Note
): Promise<string> {
  // 生成加密密钥对（公钥用于加密，私钥用于解密）
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 使用公钥加密笔记
  const encryptedData = await encryptNoteWithPublicKey(note, keyPair.publicKey);
  
  // 上传到服务器
  const encryptedNoteId = await uploadSharedNote(encryptedData);
  
  // 导出私钥并编码为 URL
  const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);
  
  return `https://memovault.com/share/${encryptedNoteId}#${privateKeyBase64}`;
}
```

### 3. 批量共享

```typescript
/**
 * 批量创建共享链接
 */
async function createBatchShares(
  notes: Note[]
): Promise<string[]> {
  const shareUrls: string[] = [];
  
  for (const note of notes) {
    const shareUrl = await createShareLink(note);
    shareUrls.push(shareUrl);
  }
  
  return shareUrls;
}
```

---

## 最佳实践

### 1. 密钥管理

- ✅ 每个共享链接使用独立的临时密钥
- ✅ 密钥只存储在 URL 哈希片段中
- ✅ 永远不要将密钥发送到服务器
- ❌ 不要在日志中记录完整的 URL

### 2. 过期策略

- ✅ 设置合理的过期时间（如 7 天）
- ✅ 限制访问次数（如 10 次）
- ✅ 提供撤销功能
- ✅ 定期清理过期的共享链接

### 3. 用户体验

- ✅ 提供清晰的错误提示
- ✅ 显示剩余访问次数和过期时间
- ✅ 支持一键复制链接
- ✅ 提供密码保护选项

### 4. 安全性

- ✅ 始终使用 HTTPS
- ✅ 验证用户身份（创建共享时）
- ✅ 记录访问日志（不包含敏感信息）
- ✅ 实施速率限制

---

## 总结

MemoVault 的零信任共享机制通过以下方式确保安全性：

1. **服务器零知识**：服务器只存储加密数据，无法解密
2. **密钥隔离**：解密密钥从未发送到服务器
3. **临时性**：共享链接可以设置过期和访问限制
4. **可撤销**：用户可以随时撤销共享链接

这种设计确保了即使服务器被入侵，用户的共享内容仍然是安全的。
