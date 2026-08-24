interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_TELEMETRY_ENABLED?: string
  readonly VITE_BASE_PAY_NETWORK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_CONFIG__: unknown
