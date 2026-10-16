declare module "claude-code" {
  interface PluginState {
    "context-brake": { percent: number | null; armed: boolean; fired: boolean }
  }
}
export type ContextBrakeState = { percent: number | null; armed: boolean; fired: boolean }
