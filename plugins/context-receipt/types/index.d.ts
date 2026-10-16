export type ReceiptItem = { tool: string; label: string; tokens: number }
export type Receipt = { turn: number; delta: number | null; tokens: number; window: number; percent: number; items: ReceiptItem[] }

declare module "claude-code" {
  interface PluginState {
    "context-receipt": { last: Receipt | null; top: ReceiptItem[]; turns: number; hidden: boolean }
  }
}
