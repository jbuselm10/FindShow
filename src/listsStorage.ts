const EMAIL_KEY = 'findshow:email'
const FIRST_NAME_KEY = 'findshow:firstName'

export function loadEmail(): string {
  try {
    const raw = localStorage.getItem(EMAIL_KEY)
    return raw ? raw.trim().toLowerCase() : ''
  } catch {
    return ''
  }
}

export function saveEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  localStorage.setItem(EMAIL_KEY, normalized)
}

export function loadFirstName(): string {
  try {
    const raw = localStorage.getItem(FIRST_NAME_KEY)
    return raw ? raw.trim() : ''
  } catch {
    return ''
  }
}

export function saveFirstName(firstName: string) {
  const trimmed = firstName.trim()
  if (!trimmed) {
    localStorage.removeItem(FIRST_NAME_KEY)
    return
  }
  localStorage.setItem(FIRST_NAME_KEY, trimmed.slice(0, 80))
}

export function clearEmail() {
  localStorage.removeItem(EMAIL_KEY)
  localStorage.removeItem(FIRST_NAME_KEY)
}

export function isValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.length <= 254
}
