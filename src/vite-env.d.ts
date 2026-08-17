interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_TELEMETRY_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
