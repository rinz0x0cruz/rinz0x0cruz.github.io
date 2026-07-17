/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ANALYTICS_ENDPOINT?: string;
  readonly PUBLIC_ANALYTICS_ENGAGEMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}