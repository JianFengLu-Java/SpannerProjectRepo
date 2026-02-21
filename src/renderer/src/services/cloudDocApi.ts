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

export interface CloudDocShareResponseDto {
	shareNo?: string
	docId?: string
	friendAccount?: string
	shareMode?: 'READONLY' | 'COLLAB' | string
	createdAt?: string
	expireAt?: string | null
	sharePath?: string
}

export interface CloudDocSharedDetailDto {
	shareNo?: string
	shareMode?: 'READONLY' | 'COLLAB' | string
	collaborative?: boolean
	doc?: CloudDocDetailDto
}

export interface ReceivedCloudDocShareDto {
	shareNo?: string
	docId?: string
	title?: string
	snippet?: string
	ownerAccount?: string
	shareMode?: 'READONLY' | 'COLLAB' | string
	status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | string
	expired?: boolean
	createdAt?: string
	expireAt?: string | null
	lastViewedAt?: string | null
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
		return request.get<ApiResponse<PageData<CloudDocSummaryDto>>>(
			'/cloud-docs',
			{
				params: {
					page: safePage,
					size: safeSize,
					keyword: params?.keyword?.trim() || undefined,
					sort: params?.sort || 'updatedAt_desc',
				},
			},
		)
	},

	createDoc(title?: string) {
		const nextTitle = title?.trim()
		const payload = nextTitle ? { title: nextTitle } : undefined
		return request.post<ApiResponse<CloudDocDetailDto>>(
			'/cloud-docs',
			payload,
		)
	},

	getDoc(docId: string) {
		return request.get<ApiResponse<CloudDocDetailDto>>(
			`/cloud-docs/${docId}`,
		)
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
		return request.delete<ApiResponse<Record<string, never>>>(
			`/cloud-docs/${docId}`,
		)
	},

	shareDoc(
		docId: string,
		payload: {
			friendAccount: string
			expireHours?: number
			shareMode?: 'READONLY' | 'COLLAB'
		},
	) {
		return request.post<ApiResponse<CloudDocShareResponseDto>>(
			`/cloud-docs/${docId}/share`,
			payload,
		)
	},

	getSharedDoc(shareNo: string) {
		return request.get<ApiResponse<CloudDocSharedDetailDto>>(
			`/cloud-docs/shares/${shareNo}`,
		)
	},

	listReceivedShares(params?: {
		page?: number
		size?: number
		status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
	}) {
		const safePage = Math.max(1, Number(params?.page) || 1)
		const safeSize = Math.max(1, Math.min(100, Number(params?.size) || 20))
		return request.get<ApiResponse<PageData<ReceivedCloudDocShareDto>>>(
			'/cloud-docs/shares/received',
			{
				params: {
					page: safePage,
					size: safeSize,
					status: params?.status || 'ACTIVE',
				},
			},
		)
	},
}
