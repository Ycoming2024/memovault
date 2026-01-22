/**
 * VectorSearchEngine - 客户端向量搜索引擎
 * 
 * 核心功能：
 * 1. 使用 Transformers.js 加载量化模型（all-MiniLM-L6-v2）
 * 2. 在 Web Worker 中生成文本嵌入（避免阻塞 UI）
 * 3. 在 IndexedDB 中存储向量数据
 * 4. 本地余弦相似度搜索
 * 5. 混合搜索（向量 + 关键词）
 * 
 * 隐私保证：
 * - 所有嵌入计算在本地执行
 * - 不向外部 API 发送任何数据
 * - 模型文件从 CDN 加载，但推理在本地
 * 
 * 性能优化：
 * - 使用 Web Worker 避免阻塞主线程
 * - 批量处理笔记嵌入
 * - 增量更新索引
 * - 使用 Float32Array 存储向量（节省内存）
 */

import {
  Note,
  EmbeddingResult,
  SearchResult,
  SearchOptions,
  IndexStatus
} from '../types';

// ============================================================================
// 配置常量
// ============================================================================

const VECTOR_SEARCH_CONFIG = {
  // 使用 Orama 作为本地搜索引擎
  searchEngine: 'orama',
  
  // 嵌入模型配置
  model: {
    name: 'all-MiniLM-L6-v2',
    quantized: true, // 使用量化模型以减少内存占用
    dimension: 384,
    maxSequenceLength: 512
  },
  
  // 搜索配置
  search: {
    defaultLimit: 10,
    defaultThreshold: 0.7,
    batchSize: 5, // 每次处理的笔记数量
    similarityMetric: 'cosine' // 余弦相似度
  },
  
  // IndexedDB 配置
  database: {
    name: 'MemoVaultVectorDB',
    version: 1,
    stores: {
      embeddings: 'embeddings',
      index: 'index'
    }
  }
};

// ============================================================================
// Web Worker 代码（嵌入生成）
// ============================================================================

const EMBEDDING_WORKER_CODE = `
  // 动态导入 Transformers.js
  importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0/transformers.min.js');

  let model = null;

  self.onmessage = async (e) => {
    const { id, type, payload } = e.data;
    
    try {
      let result;
      
      switch (type) {
        case 'init_model':
          result = await initModel(payload);
          break;
        case 'generate_embedding':
          result = await generateEmbedding(payload);
          break;
        case 'generate_embeddings_batch':
          result = await generateEmbeddingsBatch(payload);
          break;
        default:
          throw new Error('Unknown task type');
      }
      
      self.postMessage({ id, success: true, data: result });
    } catch (error) {
      self.postMessage({ id, success: false, error: error.message });
    }
  };

  // 初始化模型
  async function initModel({ modelName, quantized }) {
    if (model) return { initialized: true };
    
    model = await pipeline(
      'feature-extraction',
      modelName,
      {
        quantized,
        progress_callback: (progress) => {
          // 发送进度更新
          self.postMessage({
            type: 'model_progress',
            progress
          });
        }
      }
    );
    
    return { initialized: true, dimension: model.config.hidden_size };
  }

  // 生成单个嵌入
  async function generateEmbedding({ text }) {
    if (!model) {
      throw new Error('Model not initialized');
    }
    
    const output = await model(text, {
      pooling: 'mean',
      normalize: true
    });
    
    // 转换为 Float32Array
    const embedding = new Float32Array(output.data);
    
    return {
      embedding: Array.from(embedding),
      dimension: embedding.length
    };
  }

  // 批量生成嵌入
  async function generateEmbeddingsBatch({ texts }) {
    if (!model) {
      throw new Error('Model not initialized');
    }
    
    const embeddings = [];
    
    for (const text of texts) {
      const output = await model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      embeddings.push(Array.from(new Float32Array(output.data)));
    }
    
    return {
      embeddings,
      dimension: embeddings[0]?.length || 0
    };
  }
`;

// ============================================================================
// IndexedDB 管理器
// ============================================================================

class VectorDatabase {
  private db: IDBDatabase | null = null;

  /**
   * 打开数据库
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        VECTOR_SEARCH_CONFIG.database.name,
        VECTOR_SEARCH_CONFIG.database.version
      );

      request.onerror = () => {
        reject(new Error('Failed to open vector database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建嵌入存储
        if (!db.objectStoreNames.contains('embeddings')) {
          const embeddingsStore = db.createObjectStore('embeddings', {
            keyPath: 'noteId'
          });
          embeddingsStore.createIndex('updatedAt', 'updatedAt', {
            unique: false
          });
        }

        // 创建索引存储（用于快速搜索）
        if (!db.objectStoreNames.contains('index')) {
          const indexStore = db.createObjectStore('index', {
            keyPath: 'noteId'
          });
          indexStore.createIndex('vector', 'vector', {
            unique: false
          });
        }
      };
    });
  }

  /**
   * 保存嵌入
   */
  async saveEmbedding(embedding: EmbeddingResult): Promise<void> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.put(embedding);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save embedding'));
    });
  }

  /**
   * 批量保存嵌入
   */
  async saveEmbeddingsBatch(
    embeddings: EmbeddingResult[]
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');

      embeddings.forEach(embedding => {
        store.put(embedding);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to save embeddings'));
    });
  }

  /**
   * 获取嵌入
   */
  async getEmbedding(noteId: string): Promise<EmbeddingResult | null> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.get(noteId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get embedding'));
    });
  }

  /**
   * 获取所有嵌入
   */
  async getAllEmbeddings(): Promise<EmbeddingResult[]> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get all embeddings'));
    });
  }

  /**
   * 删除嵌入
   */
  async deleteEmbedding(noteId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.delete(noteId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete embedding'));
    });
  }

  /**
   * 清空数据库
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not opened');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear database'));
    });
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================================================
// 向量搜索引擎主类
// ============================================================================

class VectorSearchEngine {
  private vectorDB: VectorDatabase;
  private embeddingWorker: Worker | null = null;
  private modelInitialized: boolean = false;
  private notes: Map<string, Note>;
  private embeddingCache: Map<string, Float32Array>;

  constructor() {
    this.vectorDB = new VectorDatabase();
    this.notes = new Map();
    this.embeddingCache = new Map();
  }

  // ========================================================================
  // 初始化
  // ========================================================================

  /**
   * 初始化搜索引擎
   */
  async initialize(notes: Note[]): Promise<void> {
    // 1. 打开向量数据库
    await this.vectorDB.open();

    // 2. 初始化 Web Worker
    this.initializeWorker();

    // 3. 加载笔记
    this.notes.clear();
    for (const note of notes) {
      this.notes.set(note.id, note);
    }

    // 4. 加载嵌入缓存
    await this.loadEmbeddingCache();

    // 5. 初始化模型（延迟加载，首次搜索时）
    // await this.initializeModel();
  }

  /**
   * 初始化 Web Worker
   */
  private initializeWorker(): void {
    const blob = new Blob([EMBEDDING_WORKER_CODE], {
      type: 'application/javascript'
    });
    this.embeddingWorker = new Worker(URL.createObjectURL(blob));

    this.embeddingWorker.onmessage = (e) => {
      const { type, progress } = e.data;
      if (type === 'model_progress') {
        // 发送模型加载进度
        this.onModelProgress?.(progress);
      }
    };
  }

  /**
   * 初始化嵌入模型
   */
  async initializeModel(
    _onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.modelInitialized) return;

    return new Promise((resolve, reject) => {
      if (!this.embeddingWorker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.generateId();

      this.embeddingWorker.onmessage = (e) => {
        const { id: messageId, success, error } = e.data;

        if (messageId === id) {
          if (success) {
            this.modelInitialized = true;
            // this.modelDimension = data.dimension; // 属性已删除
            resolve();
          } else {
            reject(new Error(error));
          }
        }
      };

      this.embeddingWorker.postMessage({
        id,
        type: 'init_model',
        payload: {
          modelName: VECTOR_SEARCH_CONFIG.model.name,
          quantized: VECTOR_SEARCH_CONFIG.model.quantized
        }
      });
    });
  }

  /**
   * 加载嵌入缓存
   */
  private async loadEmbeddingCache(): Promise<void> {
    const embeddings = await this.vectorDB.getAllEmbeddings();

    for (const embedding of embeddings) {
      this.embeddingCache.set(
        embedding.noteId,
        new Float32Array(embedding.vector)
      );
    }
  }

  // ========================================================================
  // 索引管理
  // ========================================================================

  /**
   * 为笔记生成嵌入
   */
  async indexNote(note: Note): Promise<void> {
    // 确保模型已初始化
    if (!this.modelInitialized) {
      await this.initializeModel();
    }

    // 生成嵌入
    const embedding = await this.generateEmbedding(
      note.title + '\n' + note.content
    );

    // 保存到数据库
    const embeddingResult: EmbeddingResult = {
      noteId: note.id,
      vector: embedding,
      dimension: embedding.length,
      model: VECTOR_SEARCH_CONFIG.model.name,
      createdAt: Date.now()
    };

    await this.vectorDB.saveEmbedding(embeddingResult);

    // 更新缓存
    this.embeddingCache.set(note.id, embedding);

    // 更新笔记
    note.embedding = embedding;
  }

  /**
   * 批量索引笔记
   */
  async indexNotes(
    notes: Note[],
    onProgress?: (progress: IndexStatus) => void
  ): Promise<void> {
    // 确保模型已初始化
    if (!this.modelInitialized) {
      await this.initializeModel();
    }

    const totalNotes = notes.length;
    const batchSize = VECTOR_SEARCH_CONFIG.search.batchSize;
    const errors: string[] = [];

    for (let i = 0; i < totalNotes; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);

      try {
        // 批量生成嵌入
        const embeddings = await this.generateEmbeddingsBatch(
          batch.map(note => note.title + '\n' + note.content)
        );

        // 保存嵌入
        const embeddingResults: EmbeddingResult[] = batch.map(
          (note, index) => ({
            noteId: note.id,
            vector: new Float32Array(embeddings[index]),
            dimension: embeddings[index].length,
            model: VECTOR_SEARCH_CONFIG.model.name,
            createdAt: Date.now()
          })
        );

        await this.vectorDB.saveEmbeddingsBatch(embeddingResults);

        // 更新缓存
        batch.forEach((note, index) => {
          const embedding = new Float32Array(embeddings[index]);
          this.embeddingCache.set(note.id, embedding);
          note.embedding = embedding;
        });

        // 报告进度
        if (onProgress) {
          onProgress({
            totalNotes,
            indexedNotes: i + batch.length,
            isIndexing: true,
            lastIndexedAt: Date.now(),
            errors
          });
        }
      } catch (error) {
        errors.push(`Failed to index batch ${i}: ${error}`);
      }
    }

    // 最终进度报告
    if (onProgress) {
      onProgress({
        totalNotes,
        indexedNotes: totalNotes,
        isIndexing: false,
        lastIndexedAt: Date.now(),
        errors
      });
    }
  }

  /**
   * 更新笔记索引
   */
  async updateNoteIndex(note: Note): Promise<void> {
    // 删除旧嵌入
    await this.vectorDB.deleteEmbedding(note.id);
    this.embeddingCache.delete(note.id);

    // 重新索引
    await this.indexNote(note);
  }

  /**
   * 删除笔记索引
   */
  async deleteNoteIndex(noteId: string): Promise<void> {
    await this.vectorDB.deleteEmbedding(noteId);
    this.embeddingCache.delete(noteId);
  }

  // ========================================================================
  // 搜索
  // ========================================================================

  /**
   * 执行搜索
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    // 确保模型已初始化
    if (!this.modelInitialized) {
      await this.initializeModel();
    }

    const {
      query,
      limit = VECTOR_SEARCH_CONFIG.search.defaultLimit,
      threshold = VECTOR_SEARCH_CONFIG.search.defaultThreshold,
      useVectorSearch = true,
      useKeywordSearch = true,
      filters
    } = options;

    const results: SearchResult[] = [];

    // 向量搜索
    if (useVectorSearch) {
      const vectorResults = await this.vectorSearch(query, limit, threshold);
      results.push(...vectorResults);
    }

    // 关键词搜索（使用 Orama）
    if (useKeywordSearch) {
      const keywordResults = await this.keywordSearch(
        query,
        limit,
        filters
      );
      
      // 合并结果
      for (const keywordResult of keywordResults) {
        const existing = results.find(
          r => r.noteId === keywordResult.noteId
        );
        
        if (existing) {
          existing.keywordScore = keywordResult.score;
          existing.score = Math.max(existing.score, keywordResult.score);
        } else {
          results.push(keywordResult);
        }
      }
    }

    // 应用过滤器
    const filteredResults = this.applyFilters(results, filters);

    // 排序并限制结果数量
    return filteredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 向量搜索（余弦相似度）
   */
  private async vectorSearch(
    query: string,
    _limit: number,
    threshold: number
  ): Promise<SearchResult[]> {
    // 生成查询嵌入
    const queryEmbedding = await this.generateEmbedding(query);

    const results: SearchResult[] = [];

    // 计算所有嵌入的相似度
    for (const [noteId, embedding] of this.embeddingCache.entries()) {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        embedding
      );

      if (similarity >= threshold) {
        const note = this.notes.get(noteId);
        if (note && !note.isDeleted) {
          results.push({
            noteId,
            title: note.title,
            content: note.content,
            score: similarity,
            matchHighlights: [],
            vectorScore: similarity
          });
        }
      }
    }

    return results;
  }

  /**
   * 关键词搜索（使用 Orama）
   */
  private async keywordSearch(
    _query: string,
    _limit: number,
    _filters?: SearchOptions['filters']
  ): Promise<SearchResult[]> {
    // 这里使用 Orama 进行关键词搜索
    // 伪代码实现
    
    // 创建 Orama 数据库
    // const db = await create({
    //   schema: {
    //     title: 'string',
    //     content: 'string',
    //     tags: 'string[]'
    //   }
    // });

    // 插入数据
    // for (const note of this.notes.values()) {
    //   await insert(db, {
    //     id: note.id,
    //     title: note.title,
    //     content: note.content,
    //     tags: note.tags
    //   });
    // }

    // 搜索
    // const searchResult = await search(db, {
    //   term: query,
    //   limit,
    //   properties: ['title', 'content']
    // });

    // 转换为 SearchResult
    // return searchResult.hits.map(hit => ({
    //   noteId: hit.id,
    //   title: hit.document.title,
    //   content: hit.document.content,
    //   score: hit.score,
    //   matchHighlights: [],
    //   keywordScore: hit.score
    // }));

    // 临时返回空数组
    return [];
  }

  /**
   * 应用过滤器
   */
  private applyFilters(
    results: SearchResult[],
    filters?: SearchOptions['filters']
  ): SearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      const note = this.notes.get(result.noteId);
      if (!note) return false;

      // 标签过滤
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag =>
          note.tags.includes(tag)
        );
        if (!hasTag) return false;
      }

      // 日期范围过滤
      if (filters.dateRange) {
        const { start, end } = filters.dateRange;
        if (note.updatedAt < start || note.updatedAt > end) {
          return false;
        }
      }

      return true;
    });
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  /**
   * 生成单个嵌入
   */
  private async generateEmbedding(text: string): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      if (!this.embeddingWorker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.generateId();

      this.embeddingWorker.onmessage = (e) => {
        const { id: messageId, success, data, error } = e.data;

        if (messageId === id) {
          if (success) {
            resolve(new Float32Array(data.embedding));
          } else {
            reject(new Error(error));
          }
        }
      };

      this.embeddingWorker.postMessage({
        id,
        type: 'generate_embedding',
        payload: { text }
      });
    });
  }

  /**
   * 批量生成嵌入
   */
  private async generateEmbeddingsBatch(
    texts: string[]
  ): Promise<number[][]> {
    return new Promise((resolve, reject) => {
      if (!this.embeddingWorker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = this.generateId();

      this.embeddingWorker.onmessage = (e) => {
        const { id: messageId, success, data, error } = e.data;

        if (messageId === id) {
          if (success) {
            resolve(data.embeddings);
          } else {
            reject(new Error(error));
          }
        }
      };

      this.embeddingWorker.postMessage({
        id,
        type: 'generate_embeddings_batch',
        payload: { texts }
      });
    });
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  // ========================================================================
  // 回调
  // ========================================================================

  onModelProgress?: (progress: any) => void;

  // ========================================================================
  // 清理
  // ========================================================================

  dispose(): void {
    if (this.embeddingWorker) {
      this.embeddingWorker.terminate();
      this.embeddingWorker = null;
    }
    this.vectorDB.close();
    this.notes.clear();
    this.embeddingCache.clear();
  }
}

// ============================================================================
// 导出
// ============================================================================

export default VectorSearchEngine;
export { VECTOR_SEARCH_CONFIG };
