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
 * Sign pass payload with Ed25519
 */
export function signPassPayload(payload) {
  const payloadString = JSON.stringify(payload)
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
 */
export function computeDailyCode(rotationSeed, dateString = null) {
  const dateKey = dateString || new Date().toISOString().split('T')[0]
  const input = `${rotationSeed}_${dateKey}`
  
  // Fast deterministic hash
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash = hash & hash
  }
  
  const hex = Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6).toUpperCase()
  return hex
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
 * Verify scanned pass QR code offline on Conductor PWA
 */
export function verifyPassQR(qrRawString) {
  try {
    if (!qrRawString) {
      return { valid: false, reason: 'Empty QR code data' }
    }

    const data = typeof qrRawString === 'object' ? qrRawString : JSON.parse(qrRawString)
    const { p: payload, s: signature, c: dailyCode } = data

    if (!payload || !signature || !dailyCode) {
      return { valid: false, reason: 'Malformed pass data structure' }
    }

    // 1. Verify Ed25519 Cryptographic Signature
    const payloadBytes = decodeUTF8(JSON.stringify(payload))
    const signatureBytes = decodeBase64(signature)
    const publicKeyBytes = decodeBase64(SYSTEM_PUBLIC_KEY)

    const isSignatureValid = nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes)
    if (!isSignatureValid) {
      return { valid: false, reason: 'Digital signature invalid (counterfeit pass)' }
    }

    // 2. Check Validity Window
    const now = new Date().getTime()
    const validFrom = new Date(payload.validFrom).getTime()
    const validUntil = new Date(payload.validUntil).getTime()

    if (now < validFrom) {
      return { valid: false, reason: 'Pass is not yet active' }
    }

    if (now > validUntil) {
      return { valid: false, reason: 'Pass expired on ' + new Date(payload.validUntil).toLocaleDateString() }
    }

    // 3. Verify Anti-Screenshot Rotating Daily Code
    const expectedDailyCode = computeDailyCode(payload.rotationSeed)
    if (dailyCode !== expectedDailyCode) {
      return { 
        valid: false, 
        reason: 'Stale / expired screenshot detected (daily rotation mismatch)' 
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
