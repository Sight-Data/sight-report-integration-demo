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

/** 显示比例：'fitWidth'（适应宽度，整体缩放铺满 iframe 宽度）或 10~300 的百分比 */
export type ViewZoom = 'fitWidth' | number

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
  /** grid / document：显示比例设定值（'fitWidth' 或百分比，100 为原始大小） */
  zoom?: ViewZoom
  /** grid / document：实际缩放比（适应宽度时随窗口变化，如 0.68） */
  scale?: number
  /** dashboard */
  activeTabId?: string
  crossFilter?: { field?: string; value?: unknown; values?: unknown[]; sourceBlockId?: string } | null
  lastUpdatedAt?: string | null
}

export interface CellValue {
  cid: string
  text: string
}

/** getExportFile 的结果 */
export interface ExportFile {
  /** 文件内容；经 postMessage 传过来只传引用、不复制字节 */
  blob: Blob
  /** 取自 Content-Disposition，缺省为 报表_{reportId}.{扩展名} */
  fileName: string
  contentType: string
  /** 字节数 */
  size: number
  /** 实际导出格式：pdf / excel / word / csv / ofd */
  format: string
}

export interface GetExportFileOptions {
  /** 上限字节数，默认 100 MB，0 不限。超了 reject `too-large:`，报表侧不会把整份读进内存 */
  maxBytes?: number
  /** 默认 120000。到点报表侧中断请求并 reject `timeout:` */
  timeoutMs?: number
}

/** 与工具栏导出菜单同一套命令名 */
export type ExportCommand =
  | 'pdf' | 'pdfCurrent' | 'pdfCurrentSheet'
  | 'word' | 'wordCurrent' | 'wordCurrentSheet'
  | 'excel' | 'excelCurrent' | 'excelCurrentSheet'
  | 'csv' | 'csvCurrent'
  | 'ofd' | 'ofdCurrent'

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
  /**
   * 取导出文件内容（不下载），用于发远程打印、归档、上传。与工具栏导出是同一份文件。
   * 失败前缀：too-large: / timeout: / busy: / unsupported:（仪表盘、大屏、大数据量明细 Excel）/
   * session-expired: / export-failed: / invalid format: / not-ready
   */
  getExportFile(format?: ExportCommand | string, options?: GetExportFileOptions): Promise<ExportFile>
  print(command?: string): Promise<{ accepted: boolean }>
  getState(): Promise<ReportState>
  setSheet(sheetId: string): Promise<{ activeSheetId: string }>
  /** 取单元格渲染后显示值（首个匹配；**仅 grid**，单据与仪表盘回 unsupported） */
  getCellValue(cellName: string): Promise<CellValue>
  getCellValues(cellName: string): Promise<CellValue[]>
  /**
   * 显示比例（grid / document）：'fitWidth' 或百分比（数字或 '75%'），与工具栏「显示比例」下拉同一状态，
   * 工具栏隐藏时也可调；只影响屏幕显示。大屏与仪表盘回 unsupported，取值认不出回 invalid zoom。
   */
  setZoom(zoom: ViewZoom | string): Promise<{ zoom: ViewZoom }>
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
