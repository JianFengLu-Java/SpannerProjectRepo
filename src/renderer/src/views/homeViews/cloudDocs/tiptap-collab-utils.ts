interface TiptapClientEnv {
	collabDocPrefix: string
	collabAppId: string
	collabToken: string
	aiAppId: string
	aiToken: string
}

const env = import.meta.env as Record<string, string | undefined>

export const tiptapClientEnv: TiptapClientEnv = {
	collabDocPrefix: env.VITE_TIPTAP_COLLAB_DOC_PREFIX || '',
	collabAppId: env.VITE_TIPTAP_COLLAB_APP_ID || '',
	collabToken: env.VITE_TIPTAP_COLLAB_TOKEN || '',
	aiAppId: env.VITE_TIPTAP_AI_APP_ID || '',
	aiToken: env.VITE_TIPTAP_AI_TOKEN || '',
}

export const hasTiptapStartEnv = (): boolean => {
	return !!(
		tiptapClientEnv.collabDocPrefix &&
		tiptapClientEnv.collabAppId &&
		tiptapClientEnv.collabToken
	)
}

export const fetchCollabToken = async (): Promise<string> => {
	if (!tiptapClientEnv.collabToken) {
		throw new Error('TIPTAP_COLLAB_TOKEN is missing')
	}
	return tiptapClientEnv.collabToken
}
