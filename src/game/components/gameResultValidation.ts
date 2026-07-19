export interface DisplayNameValidation {
  value: string
  error: string | null
}

const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u

export function validateDisplayName(input: string): DisplayNameValidation {
  const value = input.normalize('NFC').trim()
  const length = Array.from(value).length
  if (length === 0) return { value, error: '请输入名称' }
  if (length > 16) return { value, error: '名称不能超过 16 个字符' }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return { value, error: '名称不能包含控制或格式字符' }
  }
  return { value, error: null }
}
