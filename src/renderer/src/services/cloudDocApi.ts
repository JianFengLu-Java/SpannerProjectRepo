import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export interface PageData<T> {
	records?: T[]
	page?: number
	size?: number
	total?: number
	totalPages?: number
	hasMore?: boolean
}

export interface CloudDocSummaryDto {
	id: string
	title?: string
	snippet?: string
	createdAt?: string
	updatedAt?: string
	lastSavedAt?: string | null
	version?: number
	deleted?: boolean
}

export interface CloudDocDetailDto extends CloudDocSummaryDto {
	contentHtml?: string
	contentJson?: string
	ownerAccount?: string
	editable?: boolean
}

export interface CloudDocSaveResponseDto {
	id: string
	updatedAt?: string
	lastSavedAt?: string | null
	version?: number
}

export const cloudDocApi = {
	listDocs(params?: {
		page?: number
		size?: number
		keyword?: string
		sort?: string
	}) {
		const safePage = Math.max(1, Number(params?.page) || 1)
		const safeSize = Math.max(1, Math.min(100, Number(params?.size) || 20))
		return request.get<ApiResponse<PageData<CloudDocSummaryDto>>>('/cloud-docs', {
			params: {
				page: safePage,
				size: safeSize,
				keyword: params?.keyword?.trim() || undefined,
				sort: params?.sort || 'updatedAt_desc',
			},
		})
	},

	createDoc(title?: string) {
		const nextTitle = title?.trim()
		const payload = nextTitle ? { title: nextTitle } : undefined
		return request.post<ApiResponse<CloudDocDetailDto>>('/cloud-docs', payload)
	},

	getDoc(docId: string) {
		return request.get<ApiResponse<CloudDocDetailDto>>(`/cloud-docs/${docId}`)
	},

	saveDoc(
		docId: string,
		payload: {
			title: string
			contentHtml: string
			contentJson: string
			baseVersion: number
		},
	) {
		return request.put<ApiResponse<CloudDocSaveResponseDto>>(
			`/cloud-docs/${docId}`,
			payload,
		)
	},

	deleteDoc(docId: string) {
		return request.delete<ApiResponse<Record<string, never>>>(`/cloud-docs/${docId}`)
	},
}
