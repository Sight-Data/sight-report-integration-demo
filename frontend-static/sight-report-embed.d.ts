/**
 * sight-report-embed.js 类型声明
 */
export interface HostEventEnvelope {
  protocol: 'sight-report'
  name: string
  payload: Record<string, unknown>
  /** 定位字段按报表类型给，都是可选的：按 name 分发后只读你关心的那几个 */
  source: {
    reportId: string
    /** grid：单元格名与实例 cid（cid 形如 A2-3-1，区分展开后的第几行） */
    cellName?: string
    cid?: string
    /** document：组件实例（cid 形如 comp:cmp1-2，区分分组展开的第几份） */
    componentId?: string
    componentType?: string
    rowIndex?: number
    /** dashboard：区块与页签 */
    blockId?: string
    blockType?: string
    tabId?: string
  }
  /**
   * 事件发生时**生效**的查询条件。只有自定义事件带。
   * 放在信封而不是 payload 里：payload 的键名由报表设计者自定，混在一起会撞名。
   */
  context?: { parameters: Record<string, unknown> }
  timestamp: number
}

export interface ReportState {
  reportId: string
  /** 当前报表类型——决定哪些方法可用 */
  fileType: 'grid' | 'document' | 'dashboard' | 'datawall'
  loading: boolean
  /** grid / document */
  parameters?: Record<string, unknown>
  variables?: Record<string, unknown>
  currentPage?: number
  totalPages?: number
  activeSheetId?: string
  /** dashboard */
  activeTabId?: string
  crossFilter?: { field?: string; value?: unknown; values?: unknown[]; sourceBlockId?: string } | null
  lastUpdatedAt?: string | null
}

export interface CellValue {
  cid: string
  text: string
}

export interface MountOptions {
  /** 后端生成的签名嵌入地址（与 getEmbedUrl 二选一） */
  embedUrl?: string
  /** 异步获取签名地址（reload 换签名的基础） */
  getEmbedUrl?: () => string | Promise<string>
  /** 报表系统 origin，缺省从 embedUrl 解析 */
  origin?: string
  /** ready/invoke 超时毫秒，默认 30000 */
  timeoutMs?: number
}

export interface SightReportInstance {
  /** 等首次加载完成（loaded 事件 + getState 轮询兜底，加载失败或超时 reject） */
  ready(): Promise<HostEventEnvelope>
  /** 事件监听；过程性事件（report:query/query-done/export/print/resize）自动订阅 */
  on(name: string, handler: (envelope: HostEventEnvelope) => void): this
  once(name: string, handler: (envelope: HostEventEnvelope) => void): this
  off(name: string, handler: (envelope: HostEventEnvelope) => void): this
  onAny(handler: (envelope: HostEventEnvelope) => void): this

  /** 合并参数；opts.query!==false 时立即重新出数并等完成 */
  setParameters(params: Record<string, unknown>, opts?: { query?: boolean }): Promise<{ queried: boolean; success?: boolean }>
  /**
   * 读参数。names 省略＝全给；挑不到的键**不出现**在结果里，可据此判存在性。
   * raw 只对仪表盘有区别：缺省是含日期展开与联动叠加的**生效值**，raw 才是控件原始值。
   */
  getParameters(names?: string[], opts?: { raw?: boolean }): Promise<Record<string, unknown>>
  query(): Promise<{ success: boolean; error?: string }>
  reset(): Promise<{ success: boolean }>
  /** 受理即回；完成/失败监听 report:export / report:error */
  export(format: 'excel' | 'pdf' | 'word' | 'csv' | 'ofd' | string): Promise<{ accepted: boolean }>
  print(command?: string): Promise<{ accepted: boolean }>
  getState(): Promise<ReportState>
  setSheet(sheetId: string): Promise<{ activeSheetId: string }>
  /** 取单元格渲染后显示值（首个匹配；**仅 grid**，单据与仪表盘回 unsupported） */
  getCellValue(cellName: string): Promise<CellValue>
  getCellValues(cellName: string): Promise<CellValue[]>
  /** 仪表盘页签（相当于 grid 的 setSheet）；其他类型回 unsupported */
  getTabs(): Promise<Array<{ id: string; name: string }>>
  setTab(tabId: string): Promise<{ activeTabId: string }>
  /** 泛化调用（协议新增方法时旧 SDK 无需升级） */
  invoke(method: string, ...args: unknown[]): Promise<unknown>

  /** 重新获取签名 URL 并重载（需提供 getEmbedUrl） */
  reload(): Promise<void>
  destroy(): void
}

export function mount(container: string | HTMLElement, options: MountOptions): SightReportInstance
export function connect(iframeEl: HTMLIFrameElement, options?: MountOptions): SightReportInstance
export const PROTOCOL: 'sight-report'
