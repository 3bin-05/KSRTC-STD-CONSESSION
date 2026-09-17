import nacl from 'tweetnacl'
import { decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util'

// Fixed Master Ed25519 Keypair for ANAVANDI System
// In production, private key stays in secure backend / Cloud Functions, and only public key is bundled in Conductor PWA.
const MASTER_SEED = new Uint8Array([
  42, 108, 215, 89, 14, 203, 77, 19, 88, 12, 145, 67, 230, 99, 120, 15,
  87, 44, 190, 23, 78, 112, 54, 91, 172, 33, 209, 81, 14, 65, 119, 201
])

const MASTER_KEYPAIR = nacl.sign.keyPair.fromSeed(MASTER_SEED)

export const SYSTEM_PUBLIC_KEY = encodeBase64(MASTER_KEYPAIR.publicKey)

/**
 * Generate a new Ed25519 KeyPair
 */
export function generateKeyPair() {
  const kp = nacl.sign.keyPair()
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  }
}

/**
 * Deterministic canonical JSON — sorts object keys recursively so that
 * Firestore round-trips (which may reorder map keys) never break the
 * Ed25519 signature. Array order is preserved.
 */
function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']'
  }
  const keys = Object.keys(value).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}'
}

/**
 * Sign pass payload with Ed25519 — uses canonical JSON so verification
 * is stable even if Firestore reorders keys.
 */
export function signPassPayload(payload) {
  const payloadString = canonicalStringify(payload)
  const messageBytes = decodeUTF8(payloadString)
  const signatureBytes = nacl.sign.detached(messageBytes, MASTER_KEYPAIR.secretKey)
  const signatureBase64 = encodeBase64(signatureBytes)

  return {
    signature: signatureBase64,
    publicKey: SYSTEM_PUBLIC_KEY,
  }
}

/**
 * Generate rotating daily HMAC code from rotationSeed + Date string (YYYY-MM-DD)
 * Uses IST (Asia/Kolkata) as primary — KSRTC Kerala — with UTC fallback for legacy.
 */
export function computeDailyCode(rotationSeed, dateString = null) {
  let dateKey = dateString
  if (!dateKey) {
    // Primary: IST date — avoids UTC midnight mismatch for Kerala users
    try {
      dateKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    } catch (_e) {
      dateKey = new Date().toISOString().split('T')[0]
    }
  }
  const input = `${rotationSeed}_${dateKey}`
  
  // Fast deterministic hash (DJB2)
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash = hash & hash
  }
  
  const hex = Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6).toUpperCase()
  return hex
}

function getISTDateString(offsetDays = 0) {
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  } catch (_e) {
    return d.toISOString().split('T')[0]
  }
}

/**
 * Generate full QR data bundle for Student Card
 */
export function generateStudentQRData(pass) {
  if (!pass || !pass.payload) return ''

  const dailyCode = computeDailyCode(pass.payload.rotationSeed)
  const qrObject = {
    p: pass.payload,
    s: pass.signature,
    c: dailyCode,
    t: Date.now(),
  }

  return JSON.stringify(qrObject)
}

/**
 * Verify scanned pass QR code offline on Conductor PWA — tolerant to
 * legacy signatures (raw JSON order) and IST/UTC clock skew.
 */
export function verifyPassQR(qrRawString) {
  try {
    if (!qrRawString) {
      return { valid: false, reason: 'Empty QR code data' }
    }

    const data = typeof qrRawString === 'object' ? qrRawString : JSON.parse(qrRawString)
    const { p: payload, s: signature, c: dailyCode } = data

    if (!payload || !signature || !dailyCode) {
      return { valid: false, reason: 'Malformed pass data structure — QR must contain payload (p), signature (s) and daily code (c). If you scanned a screenshot, ask student to show live QR.' }
    }

    // 1. Verify Ed25519 Cryptographic Signature — try canonical first, then legacy raw order for old passes
    const tryVerify = (payloadStr) => {
      try {
        const payloadBytes = decodeUTF8(payloadStr)
        const signatureBytes = decodeBase64(signature)
        // Prefer public key embedded in QR (if present), fallback to system key
        const pubKeyB64 = data.k || payload.publicKey || SYSTEM_PUBLIC_KEY
        const publicKeyBytes = decodeBase64(pubKeyB64)
        return nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes)
      } catch (_e) { return false }
    }

    const canonicalStr = canonicalStringify(payload)
    const rawStr = JSON.stringify(payload)
    const isSignatureValid = tryVerify(canonicalStr) || tryVerify(rawStr)

    if (!isSignatureValid) {
      return { valid: false, reason: 'Digital signature invalid (counterfeit pass) — payload was tampered or signed with unknown key. Canonical string tried: ' + canonicalStr.slice(0, 80) + '...' }
    }

    // 2. Check Validity Window — 60s grace for device clock skew
    const now = new Date().getTime()
    const validFrom = new Date(payload.validFrom).getTime()
    const validUntil = new Date(payload.validUntil).getTime()
    const GRACE_MS = 60 * 1000

    if (Number.isNaN(validFrom) || Number.isNaN(validUntil)) {
      return { valid: false, reason: 'Pass has invalid validity dates — re-issue from Admin portal.' }
    }

    if (now + GRACE_MS < validFrom) {
      return { valid: false, reason: 'Pass is not yet active — valid from ' + new Date(payload.validFrom).toLocaleDateString() + '. Device clock may be ahead; wait a minute and retry.' }
    }

    if (now - GRACE_MS > validUntil) {
      return { valid: false, reason: 'Pass expired on ' + new Date(payload.validUntil).toLocaleDateString() + ' — renewal required via Student portal.' }
    }

    // 3. Verify Anti-Screenshot Rotating Daily Code — accept IST today, UTC today, and yesterday for late-night tolerance
    const expectedIST = computeDailyCode(payload.rotationSeed)
    const expectedIST_Yesterday = computeDailyCode(payload.rotationSeed, getISTDateString(-1))
    const expectedUTC = (() => {
      const utcKey = new Date().toISOString().split('T')[0]
      return computeDailyCode(payload.rotationSeed, utcKey)
    })()

    const acceptedCodes = [expectedIST, expectedUTC, expectedIST_Yesterday]
    if (!acceptedCodes.includes(dailyCode)) {
      return { 
        valid: false, 
        reason: 'Stale / expired screenshot detected — daily code mismatch. Expected ' + expectedIST + ' (IST) / ' + expectedUTC + ' (UTC), got ' + dailyCode + '. Ask student to show live rotating QR, not a screenshot from another day.' 
      }
    }

    return {
      valid: true,
      payload,
      reason: 'Pass verified & authentic',
    }
  } catch (err) {
    return { valid: false, reason: 'Invalid pass format: ' + err.message }
  }
}
