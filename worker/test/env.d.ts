declare module 'cloudflare:test' {
	interface ProvidedEnv {
		TOKENS: import('@cloudflare/workers-types').KVNamespace
	}
}
