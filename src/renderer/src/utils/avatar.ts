const DEFAULT_AVATAR_DATA_URI =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc5NicgaGVpZ2h0PSc5Nicgdmlld0JveD0nMCAwIDk2IDk2Jz4KICA8cmVjdCB3aWR0aD0nOTYnIGhlaWdodD0nOTYnIHJ4PSc0OCcgZmlsbD0nI0U1RTdFQicvPgogIDxjaXJjbGUgY3g9JzQ4JyBjeT0nMzYnIHI9JzE4JyBmaWxsPScjOUNBM0FGJy8+CiAgPHBhdGggZD0nTTE4IDgyYzUtMTYgMTktMjQgMzAtMjRzMjUgOCAzMCAyNCcgZmlsbD0nIzlDQTNBRicvPgo8L3N2Zz4K'

export const resolveAvatarUrl = (avatarUrl?: string | null): string => {
	const normalized = avatarUrl?.trim()
	return normalized || DEFAULT_AVATAR_DATA_URI
}

export const isDicebearAvatarUrl = (avatarUrl?: string | null): boolean => {
	const normalized = avatarUrl?.trim() || ''
	return normalized.startsWith('https://api.dicebear.com/7.x/avataaars/svg')
}

export const isDefaultAvatarUrl = (avatarUrl?: string | null): boolean => {
	const normalized = avatarUrl?.trim() || ''
	return normalized === DEFAULT_AVATAR_DATA_URI
}
