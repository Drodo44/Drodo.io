const STORED_KEY_PREFIX = 'enc:'

export function encryptKey(plaintext: string): string {
  // Simple XOR + base64 obfuscation for local storage protection
  // Not military grade but prevents plain text exposure
  const key = 'drodo_k3y_s4lt_2024'
  let result = ''
  for (let i = 0; i < plaintext.length; i++) {
    result += String.fromCharCode(plaintext.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

export function decryptKey(encrypted: string): string {
  const key = 'drodo_k3y_s4lt_2024'
  const decoded = atob(encrypted)
  let result = ''
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

export function encryptStoredKey(plaintext: string): string {
  if (!plaintext) return ''
  return `${STORED_KEY_PREFIX}${encryptKey(plaintext)}`
}

export function decryptStoredKey(value: string): string {
  if (!value) return ''
  if (!value.startsWith(STORED_KEY_PREFIX)) return value
  return decryptKey(value.slice(STORED_KEY_PREFIX.length))
}

const SECRET_FIELD_NAMES = new Set(['apiKey', 'api_key', 'tavilyApiKey', 'key'])

export function encryptSecretFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => encryptSecretFields(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([field, fieldValue]) => {
        if (typeof fieldValue === 'string' && SECRET_FIELD_NAMES.has(field)) {
          return [field, encryptStoredKey(decryptStoredKey(fieldValue))]
        }
        return [field, encryptSecretFields(fieldValue)]
      })
    ) as T
  }

  return value
}

export function decryptSecretFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => decryptSecretFields(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([field, fieldValue]) => {
        if (typeof fieldValue === 'string' && SECRET_FIELD_NAMES.has(field)) {
          return [field, decryptStoredKey(fieldValue)]
        }
        return [field, decryptSecretFields(fieldValue)]
      })
    ) as T
  }

  return value
}
