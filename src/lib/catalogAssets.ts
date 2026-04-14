const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

function buildCatalogUrl(relativePath: string): string {
  return `${baseUrl}catalog/${relativePath.replace(/^\/+/, '')}`
}

const jsonCache = new Map<string, Promise<unknown>>()
const textCache = new Map<string, Promise<string>>()

export function getCatalogAssetUrl(relativePath: string): string {
  return buildCatalogUrl(relativePath)
}

export async function fetchCatalogJson<T>(relativePath: string): Promise<T> {
  const key = buildCatalogUrl(relativePath)
  if (!jsonCache.has(key)) {
    jsonCache.set(key, (async () => {
      const response = await fetch(key)
      if (!response.ok) {
        throw new Error(`Failed to load catalog JSON: ${relativePath}`)
      }
      return response.json() as Promise<T>
    })())
  }

  return jsonCache.get(key) as Promise<T>
}

export async function fetchCatalogText(relativePath: string): Promise<string> {
  const key = buildCatalogUrl(relativePath)
  if (!textCache.has(key)) {
    textCache.set(key, (async () => {
      const response = await fetch(key)
      if (!response.ok) {
        throw new Error(`Failed to load catalog text: ${relativePath}`)
      }
      return response.text()
    })())
  }

  return textCache.get(key) as Promise<string>
}
