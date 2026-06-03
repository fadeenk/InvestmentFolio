import type { EncryptedTokenRecord, TokenEnvelope, WorkerEnv } from '../types/auth'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let cachedKeyMaterial: string | null = null
let cachedCryptoKey: CryptoKey | null = null

async function getCryptoKey(env: WorkerEnv): Promise<CryptoKey> {
	if (cachedCryptoKey !== null && cachedKeyMaterial === env.TOKEN_ENCRYPTION_KEY) {
		return cachedCryptoKey
	}

	const seed = encoder.encode(env.TOKEN_ENCRYPTION_KEY)
	const digest = await crypto.subtle.digest('SHA-256', seed)
	const key = await crypto.subtle.importKey(
		'raw',
		digest,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)

	cachedKeyMaterial = env.TOKEN_ENCRYPTION_KEY
	cachedCryptoKey = key
	return key
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i])
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): Uint8Array {
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
	const paddingLength = (4 - (normalized.length % 4)) % 4
	const padded = normalized + '='.repeat(paddingLength)
	const binary = atob(padded)
	const bytes = new Uint8Array(binary.length)

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i)
	}

	return bytes
}

export async function encryptTokenEnvelope(
	env: WorkerEnv,
	envelope: TokenEnvelope,
): Promise<string> {
	const key = await getCryptoKey(env)
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const payload = encoder.encode(JSON.stringify(envelope))
	const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
	const cipher = new Uint8Array(cipherBuffer)

	const record: EncryptedTokenRecord = {
		v: 1,
		alg: 'A256GCM',
		iv: toBase64Url(iv),
		ct: toBase64Url(cipher),
		createdAt: new Date().toISOString(),
	}

	return JSON.stringify(record)
}

export async function decryptTokenEnvelope(
	env: WorkerEnv,
	recordJson: string,
): Promise<TokenEnvelope> {
	let record: EncryptedTokenRecord

	try {
		record = JSON.parse(recordJson) as EncryptedTokenRecord
	} catch {
		throw new Error('Invalid encrypted token payload')
	}

	if (record.v !== 1 || record.alg !== 'A256GCM' || !record.iv || !record.ct) {
		throw new Error('Unsupported encrypted token format')
	}

	const key = await getCryptoKey(env)
	const iv = fromBase64Url(record.iv)
	const cipher = fromBase64Url(record.ct)

	try {
		const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
		return JSON.parse(decoder.decode(clearBuffer)) as TokenEnvelope
	} catch {
		throw new Error('Unable to decrypt token payload')
	}
}
