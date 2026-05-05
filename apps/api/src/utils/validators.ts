/**
 * Validation utilities
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function assertUuid(value: string, fieldName = 'id'): void {
  if (!isValidUuid(value)) {
    const err = new Error(`Invalid ${fieldName}: "${value}" is not a valid UUID`)
    ;(err as any).statusCode = 400
    throw err
  }
}
