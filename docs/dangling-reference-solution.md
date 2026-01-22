# 悬空引用问题解决方案 (Dangling Reference Problem)

## 问题定义

在 MemoVault 的双向链接系统中，当用户删除一个笔记时，可能出现以下情况：

1. **笔记 A** 包含指向 **笔记 B** 的链接：`[[笔记 B]]`
2. 用户删除了 **笔记 B**
3. **笔记 A** 中的链接现在指向一个不存在的笔记
4. 这就是"悬空引用"（Dangling Reference）

在分布式/同步环境中，这个问题更加复杂，因为：
- 多个设备可能同时操作
- 网络延迟可能导致状态不一致
- 删除操作可能被撤销

---

## 解决方案架构

### 方案一：软删除 + 引用追踪（推荐）

#### 核心思想

- **永不真正删除笔记**，而是标记为 `isDeleted: true`
- 维护一个全局的引用图，追踪所有链接关系
- 在删除时自动更新所有引用该笔记的链接

#### 实现细节

```typescript
// 1. 扩展 Note 接口
interface Note {
  id: string;
  title: string;
  content: string;
  isDeleted: boolean;
  deletedAt?: number;
  // ... 其他字段
}

// 2. 引用追踪服务
class ReferenceTracker {
  private adjacencyList: AdjacencyList;
  
  /**
   * 当笔记被删除时
   */
  async handleNoteDeletion(noteId: string): Promise<void> {
    // 1. 获取所有引用该笔记的笔记
    const backlinks = await this.getBacklinks(noteId);
    
    // 2. 更新所有引用笔记
    for (const ref of backlinks) {
      await this.updateReference(
        ref.sourceNoteId,
        noteId,
        'dangling'
      );
    }
    
    // 3. 标记笔记为已删除
    await this.markNoteAsDeleted(noteId);
  }
  
  /**
   * 更新引用状态
   */
  private async updateReference(
    sourceNoteId: string,
    targetNoteId: string,
    status: 'valid' | 'dangling'
  ): Promise<void> {
    const note = await this.getNote(sourceNoteId);
    
    // 更新链接状态
    note.forwardLinks = note.forwardLinks.map(link => {
      if (link.targetNoteId === targetNoteId) {
        return {
          ...link,
          status,
          updatedAt: Date.now()
        };
      }
      return link;
    });
    
    // 如果是悬空引用，在内容中添加标记
    if (status === 'dangling') {
      note.content = this.markDanglingLinks(note.content, targetNoteId);
    }
    
    await this.saveNote(note);
  }
  
  /**
   * 在内容中标记悬空链接
   */
  private markDanglingLinks(content: string, targetNoteId: string): string {
    // 将 [[已删除笔记]] 替换为 [[已删除笔记]]^dangling
    return content.replace(
      new RegExp(`\\[\\[([^\\]]+)\\]\\]`),
      (match, title) => {
        // 检查是否是指向已删除笔记的链接
        if (this.isTargetDeleted(targetNoteId)) {
          return `${match}^dangling`;
        }
        return match;
      }
    );
  }
}
```

#### 优势

- ✅ 完全可逆：可以恢复已删除的笔记，所有链接自动恢复
- ✅ 完整的审计追踪：知道何时删除、谁删除
- ✅ 用户体验好：悬空链接有视觉标记
- ✅ 适合分布式环境：软删除操作是幂等的

#### 劣势

- ❌ 存储开销：已删除笔记仍占用空间
- ❌ 需要定期清理：可以添加"永久删除"功能

---

### 方案二：引用自动修复

#### 核心思想

当检测到悬空引用时，自动修复或提示用户：

1. **自动移除链接**：删除指向不存在笔记的链接
2. **转换为纯文本**：`[[已删除笔记]]` → `已删除笔记（已删除）`
3. **重定向到存档**：创建一个"已删除笔记"的存档页面

#### 实现细节

```typescript
class ReferenceAutoFixer {
  /**
   * 自动修复悬空引用
   */
  async fixDanglingReferences(note: Note): Promise<Note> {
    let hasDangling = false;
    
    // 检查每个链接
    for (const link of note.forwardLinks) {
      const targetExists = await this.noteExists(link.targetNoteId);
      
      if (!targetExists) {
        hasDangling = true;
        // 修复策略：转换为纯文本
        note.content = this.convertToPlainText(note.content, link);
      }
    }
    
    if (hasDangling) {
      // 移除无效链接
      note.forwardLinks = note.forwardLinks.filter(
        link => this.noteExists(link.targetNoteId)
      );
      
      await this.saveNote(note);
    }
    
    return note;
  }
  
  /**
   * 转换为纯文本
   */
  private convertToPlainText(
    content: string,
    link: LinkReference
  ): string {
    const placeholder = `${link.targetNoteTitle}（已删除）`;
    return content.replace(
      `\\[\\[${link.targetNoteTitle}\\]\\]`,
      placeholder
    );
  }
}
```

#### 优势

- ✅ 保持图谱整洁：没有悬空引用
- ✅ 减少存储：可以真正删除笔记

#### 劣势

- ❌ 不可逆：一旦修复，无法恢复原始链接
- ❌ 用户体验差：用户可能不希望链接被自动修改

---

### 方案三：分布式引用协议（高级）

#### 核心思想

使用 CRDT（Conflict-free Replicated Data Types）或类似技术处理分布式环境中的引用一致性。

#### 实现细节

```typescript
/**
 * 引用状态机
 */
interface ReferenceState {
  sourceNoteId: string;
  targetNoteId: string;
  status: 'active' | 'deleted' | 'dangling';
  version: number;
  timestamp: number;
  deviceId: string;
}

/**
 * 分布式引用管理器
 */
class DistributedReferenceManager {
  private referenceStates: Map<string, ReferenceState>;
  
  /**
   * 处理删除操作（CRDT 风格）
   */
  async handleDeletion(
    noteId: string,
    deviceId: string
  ): Promise<void> {
    // 1. 获取所有引用该笔记的状态
    const references = await this.getReferencesTo(noteId);
    
    // 2. 更新引用状态（使用版本号）
    for (const ref of references) {
      const newState: ReferenceState = {
        ...ref,
        status: 'dangling',
        version: ref.version + 1,
        timestamp: Date.now(),
        deviceId
      };
      
      // 3. 使用最后写入胜出（LWW）策略
      await this.mergeReferenceState(newState);
    }
    
    // 4. 标记笔记为已删除
    await this.markNoteAsDeleted(noteId);
  }
  
  /**
   * 合并引用状态（CRDT 合并）
   */
  private async mergeReferenceState(
    newState: ReferenceState
  ): Promise<void> {
    const existing = this.referenceStates.get(this.getKey(newState));
    
    if (!existing) {
      this.referenceStates.set(this.getKey(newState), newState);
      return;
    }
    
    // LWW：基于时间戳
    if (newState.timestamp > existing.timestamp) {
      this.referenceStates.set(this.getKey(newState), newState);
    } else if (newState.timestamp === existing.timestamp) {
      // 时间戳相同，使用设备 ID 作为决胜条件
      if (newState.deviceId > existing.deviceId) {
        this.referenceStates.set(this.getKey(newState), newState);
      }
    }
  }
  
  /**
   * 同步引用状态
   */
  async syncReferenceStates(
    remoteStates: ReferenceState[]
  ): Promise<void> {
    for (const state of remoteStates) {
      await this.mergeReferenceState(state);
    }
  }
}
```

#### 优势

- ✅ 完全分布式：无需中央协调
- ✅ 最终一致性：保证所有设备最终达成一致
- ✅ 冲突解决：内置冲突解决机制

#### 劣势

- ❌ 复杂度高：需要实现 CRDT
- ❌ 存储开销：需要维护额外的状态

---

## 推荐的混合方案

结合上述方案的优点，推荐以下混合方案：

### 阶段 1：软删除 + 引用追踪

```typescript
class HybridReferenceManager {
  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<void> {
    // 1. 标记为软删除
    await this.softDeleteNote(noteId);
    
    // 2. 更新所有引用
    await this.updateReferences(noteId, 'dangling');
    
    // 3. 记录删除事件（用于同步）
    await this.recordDeletionEvent(noteId);
  }
  
  /**
   * 恢复笔记
   */
  async restoreNote(noteId: string): Promise<void> {
    // 1. 取消软删除标记
    await this.unmarkNoteAsDeleted(noteId);
    
    // 2. 恢复所有引用
    await this.updateReferences(noteId, 'valid');
    
    // 3. 记录恢复事件
    await this.recordRestorationEvent(noteId);
  }
  
  /**
   * 永久删除（可选）
   */
  async permanentDelete(noteId: string): Promise<void> {
    // 1. 检查是否有引用
    const backlinks = await this.getBacklinks(noteId);
    
    if (backlinks.length > 0) {
      // 提示用户
      throw new Error(
        `该笔记被 ${backlinks.length} 个笔记引用，是否继续永久删除？`
      );
    }
    
    // 2. 真正删除
    await this.hardDeleteNote(noteId);
  }
}
```

### 阶段 2：用户可配置的修复策略

```typescript
interface ReferenceFixConfig {
  strategy: 'auto_remove' | 'convert_to_text' | 'keep_dangling';
  notifyUser: boolean;
}

class ConfigurableReferenceFixer {
  async handleDanglingReference(
    noteId: string,
    danglingLink: LinkReference,
    config: ReferenceFixConfig
  ): Promise<void> {
    switch (config.strategy) {
      case 'auto_remove':
        await this.removeLink(noteId, danglingLink);
        break;
        
      case 'convert_to_text':
        await this.convertToPlainText(noteId, danglingLink);
        break;
        
      case 'keep_dangling':
        // 保持悬空状态，但添加视觉标记
        await this.markAsDangling(noteId, danglingLink);
        break;
    }
    
    if (config.notifyUser) {
      await this.notifyUser(noteId, danglingLink);
    }
  }
}
```

### 阶段 3：分布式同步支持

```typescript
class DistributedSyncHandler {
  /**
   * 处理远程删除事件
   */
  async handleRemoteDeletion(event: SyncEvent): Promise<void> {
    const { noteId, deviceId } = event;
    
    // 1. 检查本地是否有冲突
    const localNote = await this.getNote(noteId);
    
    if (localNote && !localNote.isDeleted) {
      // 冲突：本地未删除，远程已删除
      await this.handleDeletionConflict(localNote, event);
    } else {
      // 无冲突，应用远程删除
      await this.applyRemoteDeletion(noteId);
    }
  }
  
  /**
   * 处理删除冲突
   */
  private async handleDeletionConflict(
    localNote: Note,
    remoteEvent: SyncEvent
  ): Promise<void> {
    // 1. 比较时间戳
    if (localNote.updatedAt > remoteEvent.timestamp) {
      // 本地更新，保留本地版本
      await this.propagateLocalState(localNote);
    } else {
      // 远程更新，应用远程删除
      await this.applyRemoteDeletion(localNote.id);
      
      // 2. 可选：提示用户
      await this.notifyConflict(localNote, remoteEvent);
    }
  }
}
```

---

## 实现检查清单

### 必须实现

- [ ] 软删除机制（`isDeleted` 标记）
- [ ] 引用追踪服务（`ReferenceTracker`）
- [ ] 悬空引用检测
- [ ] 悬空引用视觉标记
- [ ] 删除/恢复操作

### 应该实现

- [ ] 用户可配置的修复策略
- [ ] 删除确认提示（当有引用时）
- [ ] 批量删除支持
- [ ] 已删除笔记回收站
- [ ] 定期清理机制（永久删除）

### 可以实现

- [ ] 分布式引用协议（CRDT）
- [ ] 引用统计和分析
- [ ] 引用历史记录
- [ ] 引引用搜索和导航

---

## 用户体验设计

### 1. 删除笔记时的提示

```
⚠️ 该笔记被 3 个笔记引用：
  - [[项目计划]]（2 处引用）
  - [[会议记录]]（1 处引用）

删除后，这些链接将显示为"悬空引用"。
是否继续删除？

[取消] [删除] [删除并移除所有引用]
```

### 2. 悬空链接的视觉样式

```css
/* 正常链接 */
.wiki-link {
  color: #0066cc;
  text-decoration: underline;
}

/* 悬空链接 */
.wiki-link.dangling {
  color: #999;
  text-decoration: line-through;
  cursor: not-allowed;
}

.wiki-link.dangling::after {
  content: "（已删除）";
  font-size: 0.8em;
  color: #666;
}
```

### 3. 回收站界面

```
🗑️ 回收站

已删除笔记（30 天后自动永久删除）

[ ] [[项目计划]]（2024-01-15 删除）
    被 3 个笔记引用
    [恢复] [永久删除]

[ ] [[会议记录]]（2024-01-10 删除）
    无引用
    [恢复] [永久删除]
```

---

## 性能考虑

### 1. 索引优化

```typescript
// 为反向链接创建索引
interface BacklinkIndex {
  [targetNoteId: string]: {
    sourceNoteId: string;
    linkPosition: number;
  }[];
}

// 使用 IndexedDB 存储索引
async function buildBacklinkIndex(): Promise<void> {
  const notes = await getAllNotes();
  const index: BacklinkIndex = {};
  
  for (const note of notes) {
    for (const link of note.forwardLinks) {
      if (!index[link.targetNoteId]) {
        index[link.targetNoteId] = [];
      }
      index[link.targetNoteId].push({
        sourceNoteId: note.id,
        linkPosition: link.position.start
      });
    }
  }
  
  await saveBacklinkIndex(index);
}
```

### 2. 增量更新

```typescript
// 只更新受影响的笔记
async function updateBacklinksIncrementally(
  noteId: string
): Promise<void> {
  const note = await getNote(noteId);
  const oldLinks = await getOldLinks(noteId);
  const newLinks = note.forwardLinks;
  
  // 计算差异
  const addedLinks = diff(newLinks, oldLinks);
  const removedLinks = diff(oldLinks, newLinks);
  
  // 只更新受影响的反向链接
  for (const link of addedLinks) {
    await addBacklink(link.targetNoteId, noteId);
  }
  
  for (const link of removedLinks) {
    await removeBacklink(link.targetNoteId, noteId);
  }
}
```

---

## 总结

推荐使用**软删除 + 引用追踪**作为基础方案，并添加以下增强功能：

1. **用户可配置的修复策略**：让用户选择如何处理悬空引用
2. **删除确认提示**：当有引用时提示用户
3. **回收站功能**：方便用户恢复已删除笔记
4. **分布式同步支持**：使用 LWW 策略处理冲突

这种方案在用户体验、实现复杂度和分布式一致性之间取得了良好的平衡。
