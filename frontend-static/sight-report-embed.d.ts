/**
 * sight-report-embed.js 类型声明
 */
export interface HostEventEnvelope {
  protocol: 'sight-report'
  name: string
  payload: Record<string, unknown>
  source: { reportId: string; cellName?: string; cid?: string }
  timestamp: number
}

export interface ReportState {
  reportId: string
  parameters: Record<string, unknown>
  variables: Record<string, unknown>
  loading: boolean
  currentPage: number
  totalPages: number
  activeSheetId: string
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
  query(): Promise<{ success: boolean; error?: string }>
  reset(): Promise<{ success: boolean }>
  /** 受理即回；完成/失败监听 report:export / report:error */
  export(format: 'excel' | 'pdf' | 'word' | 'csv' | 'ofd' | string): Promise<{ accepted: boolean }>
  print(command?: string): Promise<{ accepted: boolean }>
  getState(): Promise<ReportState>
  setSheet(sheetId: string): Promise<{ activeSheetId: string }>
  /** 取单元格渲染后显示值（首个匹配；仅 grid 报表当前渲染内容） */
  getCellValue(cellName: string): Promise<CellValue>
  getCellValues(cellName: string): Promise<CellValue[]>
  /** 泛化调用（协议新增方法时旧 SDK 无需升级） */
  invoke(method: string, ...args: unknown[]): Promise<unknown>

  /** 重新获取签名 URL 并重载（需提供 getEmbedUrl） */
  reload(): Promise<void>
  destroy(): void
}

export function mount(container: string | HTMLElement, options: MountOptions): SightReportInstance
export function connect(iframeEl: HTMLIFrameElement, options?: MountOptions): SightReportInstance
export const PROTOCOL: 'sight-report'
