/**
 * KnowledgeGraphEngine - 知识图谱引擎
 * 
 * 核心功能：
 * 1. WikiLink 语法解析（[[WikiLink]]）
 * 2. 双向链接维护（ForwardLinks 和 Backlinks）
 * 3. 图数据结构管理（邻接表）
 * 4. 图可视化数据生成（Cytoscape.js 格式）
 * 5. 图统计分析
 * 
 * 隐私保证：
 * - 所有图数据在客户端处理
 * - 服务器端只看到加密的笔记 ID
 * - 笔记标题在本地解密后用于渲染
 */

import {
  Note,
  LinkReference,
  WikiLink,
  GraphNode,
  GraphEdge,
  AdjacencyList,
  GraphStats
} from '../types';

// ============================================================================
// WikiLink 解析器
// ============================================================================

/**
 * WikiLink 语法解析器
 * 支持：[[NoteTitle]] 和 [[NoteTitle|Alias]]
 */
class WikiLinkParser {
  private static readonly WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

  /**
   * 解析笔记内容中的所有 WikiLink
   */
  static parse(content: string): WikiLink[] {
    const links: WikiLink[] = [];
    let match;

    while ((match = this.WIKI_LINK_REGEX.exec(content)) !== null) {
      const fullText = match[0];
      const linkContent = match[1];
      
      // 解析别名：[[NoteTitle|Alias]]
      const [title, alias] = linkContent.split('|');
      
      links.push({
        text: fullText,
        targetId: undefined, // 将在解析后解析为具体 ID
        alias: alias?.trim(),
        position: {
          start: match.index,
          end: match.index + fullText.length
        }
      });
    }

    return links;
  }

  /**
   * 将 WikiLink 转换为 LinkReference
   */
  static toLinkReference(
    wikiLink: WikiLink,
    targetNoteId: string,
    content: string
  ): LinkReference {
    // 提取上下文（链接周围的文本）
    const contextStart = Math.max(0, wikiLink.position.start - 50);
    const contextEnd = Math.min(
      content.length,
      wikiLink.position.end + 50
    );
    const context = content.substring(contextStart, contextEnd);

    return {
      targetNoteId,
      targetNoteTitle: wikiLink.alias || wikiLink.text.slice(2, -2),
      context,
      position: wikiLink.position,
      createdAt: Date.now()
    };
  }

  /**
   * 替换内容中的 WikiLink
   */
  static replaceLinks(
    content: string,
    replacements: Map<string, string>
  ): string {
    return content.replace(
      this.WIKI_LINK_REGEX,
      (match, linkContent) => {
        const key = linkContent.split('|')[0].trim();
        return replacements.get(key) || match;
      }
    );
  }
}

// ============================================================================
// 图数据结构
// ============================================================================

/**
 * 图数据结构管理器
 */
class GraphDataStructure {
  private adjacencyList: AdjacencyList = {};

  /**
   * 添加边
   */
  addEdge(sourceId: string, targetId: string): void {
    // 初始化节点（如果不存在）
    if (!this.adjacencyList[sourceId]) {
      this.adjacencyList[sourceId] = {
        forwardLinks: [],
        backlinks: []
      };
    }
    if (!this.adjacencyList[targetId]) {
      this.adjacencyList[targetId] = {
        forwardLinks: [],
        backlinks: []
      };
    }

    // 添加前向链接（避免重复）
    if (!this.adjacencyList[sourceId].forwardLinks.includes(targetId)) {
      this.adjacencyList[sourceId].forwardLinks.push(targetId);
    }

    // 添加反向链接（避免重复）
    if (!this.adjacencyList[targetId].backlinks.includes(sourceId)) {
      this.adjacencyList[targetId].backlinks.push(sourceId);
    }
  }

  /**
   * 移除边
   */
  removeEdge(sourceId: string, targetId: string): void {
    if (this.adjacencyList[sourceId]) {
      this.adjacencyList[sourceId].forwardLinks =
        this.adjacencyList[sourceId].forwardLinks.filter(
          id => id !== targetId
        );
    }

    if (this.adjacencyList[targetId]) {
      this.adjacencyList[targetId].backlinks =
        this.adjacencyList[targetId].backlinks.filter(
          id => id !== sourceId
        );
    }
  }

  /**
   * 移除节点及其所有边
   */
  removeNode(nodeId: string): void {
    // 移除所有指向该节点的边
    for (const sourceId in this.adjacencyList) {
      this.removeEdge(sourceId, nodeId);
    }

    // 移除节点本身
    delete this.adjacencyList[nodeId];
  }

  /**
   * 获取节点的前向链接
   */
  getForwardLinks(nodeId: string): string[] {
    return this.adjacencyList[nodeId]?.forwardLinks || [];
  }

  /**
   * 获取节点的反向链接
   */
  getBacklinks(nodeId: string): string[] {
    return this.adjacencyList[nodeId]?.backlinks || [];
  }

  /**
   * 检查两个节点是否双向链接
   */
  isBidirectional(nodeId1: string, nodeId2: string): boolean {
    const forward1 = this.getForwardLinks(nodeId1);
    const forward2 = this.getForwardLinks(nodeId2);
    return forward1.includes(nodeId2) && forward2.includes(nodeId1);
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): string[] {
    return Object.keys(this.adjacencyList);
  }

  /**
   * 获取所有边
   */
  getAllEdges(): Array<[string, string]> {
    const edges: Array<[string, string]> = [];
    for (const sourceId in this.adjacencyList) {
      for (const targetId of this.adjacencyList[sourceId].forwardLinks) {
        edges.push([sourceId, targetId]);
      }
    }
    return edges;
  }

  /**
   * 计算图的统计信息
   */
  getStats(): GraphStats {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    
    let totalConnections = 0;
    let isolatedNodes = 0;

    for (const nodeId of nodes) {
      const connections =
        this.getForwardLinks(nodeId).length +
        this.getBacklinks(nodeId).length;
      totalConnections += connections;
      
      if (connections === 0) {
        isolatedNodes++;
      }
    }

    const averageConnections =
      nodes.length > 0 ? totalConnections / nodes.length : 0;

    // 计算强连通分量（简化版）
    const stronglyConnectedComponents = this.countSCC();

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      averageConnections,
      isolatedNodes,
      stronglyConnectedComponents
    };
  }

  /**
   * 计算强连通分量数量（使用 Kosaraju 算法）
   */
  private countSCC(): number {
    const nodes = this.getAllNodes();
    if (nodes.length === 0) return 0;

    const visited = new Set<string>();
    const order: string[] = [];

    // 第一次 DFS
    const dfs1 = (nodeId: string) => {
      visited.add(nodeId);
      for (const neighbor of this.getForwardLinks(nodeId)) {
        if (!visited.has(neighbor)) {
          dfs1(neighbor);
        }
      }
      order.push(nodeId);
    };

    for (const nodeId of nodes) {
      if (!visited.has(nodeId)) {
        dfs1(nodeId);
      }
    }

    // 构建反向图
    const reverseAdjList: AdjacencyList = {};
    for (const nodeId of nodes) {
      reverseAdjList[nodeId] = {
        forwardLinks: this.getBacklinks(nodeId),
        backlinks: []
      };
    }

    // 第二次 DFS（在反向图上）
    let sccCount = 0;
    visited.clear();

    const dfs2 = (nodeId: string, adjList: AdjacencyList) => {
      visited.add(nodeId);
      for (const neighbor of adjList[nodeId]?.forwardLinks || []) {
        if (!visited.has(neighbor)) {
          dfs2(neighbor, adjList);
        }
      }
    };

    for (let i = order.length - 1; i >= 0; i--) {
      const nodeId = order[i];
      if (!visited.has(nodeId)) {
        dfs2(nodeId, reverseAdjList);
        sccCount++;
      }
    }

    return sccCount;
  }
}

// ============================================================================
// 知识图谱引擎主类
// ============================================================================

class KnowledgeGraphEngine {
  private graph: GraphDataStructure;
  private notes: Map<string, Note>;
  private titleToIdMap: Map<string, string>;

  constructor() {
    this.graph = new GraphDataStructure();
    this.notes = new Map();
    this.titleToIdMap = new Map();
  }

  // ========================================================================
  // 初始化和加载
  // ========================================================================

  /**
   * 从笔记列表初始化图谱
   */
  async initialize(notes: Note[]): Promise<void> {
    this.notes.clear();
    this.titleToIdMap.clear();
    this.graph = new GraphDataStructure();

    // 构建标题到 ID 的映射
    for (const note of notes) {
      this.notes.set(note.id, note);
      this.titleToIdMap.set(note.title.toLowerCase(), note.id);
    }

    // 构建图
    for (const note of notes) {
      await this.updateNoteLinks(note);
    }
  }

  /**
   * 添加或更新笔记
   */
  async addOrUpdateNote(note: Note): Promise<void> {
    // 移除旧的链接
    const oldNote = this.notes.get(note.id);
    if (oldNote) {
      for (const link of oldNote.forwardLinks) {
        this.graph.removeEdge(note.id, link.targetNoteId);
      }
    }

    // 更新笔记
    this.notes.set(note.id, note);
    this.titleToIdMap.set(note.title.toLowerCase(), note.id);

    // 添加新的链接
    await this.updateNoteLinks(note);
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteId: string): Promise<void> {
    const note = this.notes.get(noteId);
    if (!note) return;

    // 移除所有链接
    for (const link of note.forwardLinks) {
      this.graph.removeEdge(noteId, link.targetNoteId);
    }

    // 从反向链接中移除
    for (const backlink of note.backlinks) {
      this.graph.removeEdge(backlink.targetNoteId, noteId);
    }

    // 移除节点
    this.graph.removeNode(noteId);
    this.notes.delete(noteId);
    this.titleToIdMap.delete(note.title.toLowerCase());
  }

  // ========================================================================
  // 链接管理
  // ========================================================================

  /**
   * 更新笔记的链接
   */
  private async updateNoteLinks(note: Note): Promise<void> {
    // 解析 WikiLink
    const wikiLinks = WikiLinkParser.parse(note.content);

    // 解析为 LinkReference
    const linkReferences: LinkReference[] = [];

    for (const wikiLink of wikiLinks) {
      // 查找目标笔记 ID
      const targetTitle = wikiLink.alias || wikiLink.text.slice(2, -2);
      const targetId = this.titleToIdMap.get(targetTitle.toLowerCase());

      if (targetId) {
        // 找到目标笔记
        const linkRef = WikiLinkParser.toLinkReference(
          wikiLink,
          targetId,
          note.content
        );
        linkReferences.push(linkRef);

        // 添加到图
        this.graph.addEdge(note.id, targetId);
      } else {
        // 目标笔记不存在，可以创建悬空引用
        // 这里暂时忽略，由上层处理
      }
    }

    // 更新笔记的链接
    note.forwardLinks = linkReferences;

    // 更新反向链接
    await this.updateBacklinks(note);
  }

  /**
   * 更新反向链接
   */
  private async updateBacklinks(note: Note): Promise<void> {
    // 清除旧的反向链接
    for (const otherNote of this.notes.values()) {
      if (otherNote.id !== note.id) {
        otherNote.backlinks = otherNote.backlinks.filter(
          bl => bl.targetNoteId !== note.id
        );
      }
    }

    // 添加新的反向链接
    for (const link of note.forwardLinks) {
      const targetNote = this.notes.get(link.targetNoteId);
      if (targetNote) {
        const backlink: LinkReference = {
          targetNoteId: note.id,
          targetNoteTitle: note.title,
          context: link.context,
          position: link.position,
          createdAt: Date.now()
        };
        targetNote.backlinks.push(backlink);
      }
    }
  }

  /**
   * 解析笔记标题到笔记 ID
   */
  resolveTitleToId(title: string): string | undefined {
    return this.titleToIdMap.get(title.toLowerCase());
  }

  // ========================================================================
  // 图可视化
  // ========================================================================

  /**
   * 生成 Cytoscape.js 格式的图数据
   */
  generateCytoscapeData(): {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 生成节点
    for (const note of this.notes.values()) {
      if (note.isDeleted) continue; // 跳过已删除的笔记

      const connections =
        note.forwardLinks.length + note.backlinks.length;

      nodes.push({
        id: note.id,
        title: note.title,
        size: Math.max(20, Math.min(60, 20 + connections * 5)),
        color: this.getNodeColor(connections),
        group: this.getNodeGroup(note)
      });
    }

    // 生成边
    for (const note of this.notes.values()) {
      if (note.isDeleted) continue;

      for (const link of note.forwardLinks) {
        const targetNote = this.notes.get(link.targetNoteId);
        if (targetNote && !targetNote.isDeleted) {
          edges.push({
            source: note.id,
            target: link.targetNoteId,
            weight: 1,
            type: this.graph.isBidirectional(note.id, link.targetNoteId)
              ? 'bidirectional'
              : 'forward'
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 根据连接数获取节点颜色
   */
  private getNodeColor(connections: number): string {
    if (connections === 0) return '#cccccc';
    if (connections <= 2) return '#4a90e2';
    if (connections <= 5) return '#50c878';
    if (connections <= 10) return '#ff6b6b';
    return '#ffd700';
  }

  /**
   * 获取节点分组（基于标签）
   */
  private getNodeGroup(note: Note): string {
    if (note.tags.length === 0) return 'default';
    return note.tags[0];
  }

  /**
   * 生成子图（从指定节点开始）
   */
  generateSubgraph(
    startNodeId: string,
    depth: number = 2
  ): {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    const visited = new Set<string>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const bfs = (nodeId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(nodeId)) return;

      visited.add(nodeId);

      const note = this.notes.get(nodeId);
      if (note && !note.isDeleted) {
        nodes.push({
          id: note.id,
          title: note.title,
          size: 30,
          color: '#4a90e2',
          group: this.getNodeGroup(note)
        });
      }

      // 遍历前向链接
      for (const targetId of this.graph.getForwardLinks(nodeId)) {
        if (!visited.has(targetId)) {
          edges.push({
            source: nodeId,
            target: targetId,
            weight: 1,
            type: 'forward'
          });
          bfs(targetId, currentDepth + 1);
        }
      }

      // 遍历反向链接
      for (const sourceId of this.graph.getBacklinks(nodeId)) {
        if (!visited.has(sourceId)) {
          edges.push({
            source: sourceId,
            target: nodeId,
            weight: 1,
            type: 'forward'
          });
          bfs(sourceId, currentDepth + 1);
        }
      }
    };

    bfs(startNodeId, 0);

    return { nodes, edges };
  }

  // ========================================================================
  // 图分析
  // ========================================================================

  /**
   * 获取图的统计信息
   */
  getStats(): GraphStats {
    return this.graph.getStats();
  }

  /**
   * 查找最相关的笔记（基于链接数量）
   */
  findMostConnectedNotes(limit: number = 10): Note[] {
    const noteConnections = Array.from(this.notes.values())
      .filter(note => !note.isDeleted)
      .map(note => ({
        note,
        connections: note.forwardLinks.length + note.backlinks.length
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);

    return noteConnections.map(nc => nc.note);
  }

  /**
   * 查找孤立笔记（没有链接的笔记）
   */
  findIsolatedNotes(): Note[] {
    return Array.from(this.notes.values())
      .filter(note => !note.isDeleted)
      .filter(
        note =>
          note.forwardLinks.length === 0 && note.backlinks.length === 0
      );
  }

  /**
   * 查找最短路径（BFS）
   */
  findShortestPath(
    startId: string,
    endId: string
  ): string[] | null {
    if (startId === endId) return [startId];

    const queue: string[][] = [[startId]];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const currentId = path[path.length - 1];

      // 检查前向链接
      for (const neighbor of this.graph.getForwardLinks(currentId)) {
        if (neighbor === endId) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }

      // 检查反向链接
      for (const neighbor of this.graph.getBacklinks(currentId)) {
        if (neighbor === endId) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // 没有路径
  }

  /**
   * 查找笔记之间的所有路径（DFS）
   */
  findAllPaths(
    startId: string,
    endId: string,
    maxDepth: number = 5
  ): string[][] {
    const paths: string[][] = [];

    const dfs = (
      currentId: string,
      path: string[],
      visited: Set<string>
    ) => {
      if (path.length > maxDepth) return;

      if (currentId === endId) {
        paths.push([...path]);
        return;
      }

      visited.add(currentId);

      // 遍历所有邻居
      const neighbors = [
        ...this.graph.getForwardLinks(currentId),
        ...this.graph.getBacklinks(currentId)
      ];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor], new Set(visited));
        }
      }
    };

    dfs(startId, [startId], new Set());

    return paths;
  }

  // ========================================================================
  // 导出和导入
  // ========================================================================

  /**
   * 导出图数据为 JSON
   */
  exportGraph(): string {
    const data = {
      nodes: this.generateCytoscapeData().nodes,
      edges: this.generateCytoscapeData().edges,
      stats: this.getStats()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入图数据
   */
  importGraph(jsonData: string): void {
    const data = JSON.parse(jsonData);
    // 这里可以实现导入逻辑
    // 注意：需要重新构建 notes 和 titleToIdMap
  }
}

// ============================================================================
// 导出
// ============================================================================

export default KnowledgeGraphEngine;
export { WikiLinkParser, GraphDataStructure };
