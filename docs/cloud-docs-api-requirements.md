# 云文档组件后端接口需求文档

## 1. 目的与范围

本文档用于明确前端「云文档组件」联调所需的后端 API 与数据模型，覆盖以下场景：

1. 文档列表加载与分页。
2. 新建文档、打开文档、删除文档。
3. 文档标题与内容编辑（自动保存）。
4. 图片上传并插入文档内容。
5. 乐观锁版本控制与保存冲突处理。
6. 文档协作能力预留（在线状态、游标、变更广播）。

## 2. 当前前端实现现状（基于代码）

关键文件：

1. `src/renderer/src/stores/cloudDoc.ts`
2. `src/renderer/src/services/mockCloudDocService.ts`
3. `src/renderer/src/views/homeViews/cloudDocs/CloudDocsManageView.vue`
4. `src/renderer/src/views/homeViews/cloudDocs/CloudDocEditorView.vue`
5. `src/renderer/src/views/homeViews/cloudDocs/editor/EditorRoot.vue`

现状说明：

1. 当前文档数据由本地 mock（`localStorage`）存储，尚未接后端。
2. 编辑器为 Tiptap，前端会同时维护 `contentHtml` 与 `contentJson`。
3. 文档编辑采用防抖自动保存（约 900ms）。
4. 图片上传已调用 `POST /files/upload`，并期望返回可直接访问的 URL。
5. 全局返回结构使用统一格式：`{ code, status, message, data }`。

## 3. 功能说明（后端需支持）

1. 文档管理：支持个人文档的创建、列表、详情、删除。
2. 实时保存：支持频繁增量保存，保证幂等与并发安全。
3. 打开体验：首屏可快速拿到文档详情，减少二次请求。
4. 数据恢复：保存失败时可明确返回冲突类型与最新服务端版本，便于前端提示用户。
5. 附件能力：支持图片文件上传，限制类型与大小，返回标准访问地址。
6. 可扩展协作：为后续多人协同编辑保留版本、游标、在线成员等模型字段。

## 4. 通用约定

## 4.1 通用返回结构

```json
{
  "code": 200,
  "status": "OK",
  "message": "success",
  "data": {}
}
```

## 4.2 时间与分页

1. 时间字段统一 ISO-8601 UTC（如 `2026-02-20T09:30:00Z`）。
2. 列表分页统一返回：`records/page/size/total/totalPages/hasMore`。

## 4.3 幂等与并发

1. `DELETE` 接口应幂等（重复删除返回成功或明确“已不存在”语义）。
2. 文档保存必须支持乐观锁（`version`）防止覆盖他人修改。
3. 冲突时返回标准错误码与最新文档版本信息。

## 5. 数据模型定义

## 5.1 云文档摘要 `CloudDocSummary`

```json
{
  "id": "doc_20260220_000001",
  "title": "未标题云文档",
  "snippet": "这里是文档摘要内容...",
  "createdAt": "2026-02-20T09:30:00Z",
  "updatedAt": "2026-02-20T10:30:00Z",
  "lastSavedAt": "2026-02-20T10:30:00Z",
  "version": 8,
  "deleted": false
}
```

## 5.2 云文档详情 `CloudDocDetail`

```json
{
  "id": "doc_20260220_000001",
  "title": "需求评审记录",
  "contentHtml": "<p>文档内容</p>",
  "contentJson": "{\"type\":\"doc\",\"content\":[]}",
  "createdAt": "2026-02-20T09:30:00Z",
  "updatedAt": "2026-02-20T10:30:00Z",
  "lastSavedAt": "2026-02-20T10:30:00Z",
  "version": 8,
  "ownerAccount": "10001",
  "editable": true
}
```

## 5.3 保存请求 `CloudDocSaveRequest`

```json
{
  "title": "需求评审记录",
  "contentHtml": "<p>文档内容</p>",
  "contentJson": "{\"type\":\"doc\",\"content\":[]}",
  "baseVersion": 8
}
```

## 5.4 保存响应 `CloudDocSaveResponse`

```json
{
  "id": "doc_20260220_000001",
  "updatedAt": "2026-02-20T10:31:00Z",
  "lastSavedAt": "2026-02-20T10:31:00Z",
  "version": 9
}
```

## 6. 接口清单（按优先级）

## 6.1 P0（必须）

1. `GET /cloud-docs`：云文档列表分页。
2. `POST /cloud-docs`：新建空白文档。
3. `GET /cloud-docs/{docId}`：获取文档详情。
4. `PUT /cloud-docs/{docId}`：保存文档（标题+内容）。
5. `DELETE /cloud-docs/{docId}`：删除文档。
6. `POST /files/upload`：上传图片（兼容已有能力）。

## 6.2 P1（强烈建议）

1. `GET /cloud-docs/{docId}/revisions`：历史版本列表。
2. `POST /cloud-docs/{docId}/restore`：按版本回滚。
3. `POST /cloud-docs/{docId}/duplicate`：复制文档。
4. `POST /cloud-docs/{docId}/share`：生成分享链接。

## 6.3 P2（协作扩展）

1. `GET /cloud-docs/{docId}/presence`：在线成员与游标。
2. `WS /ws/cloud-docs/{docId}`：协作事件推送（内容变更、游标、在线状态）。

## 7. 接口详细定义

## 7.1 GET /cloud-docs

Query 参数：

1. `page`：页码，从 `1` 开始，默认 `1`。
2. `size`：每页数量，默认 `20`，最大 `100`。
3. `keyword`：可选，按标题搜索。
4. `sort`：可选，默认 `updatedAt_desc`。

返回：

1. `data` 为分页对象，`records` 元素类型为 `CloudDocSummary`。

## 7.2 POST /cloud-docs

请求体（可为空）：

```json
{
  "title": "未标题云文档"
}
```

返回：

1. `data` 为新创建的 `CloudDocDetail`。
2. 若未传 `title`，后端默认生成“未标题云文档”。

## 7.3 GET /cloud-docs/{docId}

用途：打开编辑器时一次获取完整内容。

返回：

1. `data` 为 `CloudDocDetail`。
2. 若文档不存在，返回 `404 + CLOUD_DOC_NOT_FOUND`。

## 7.4 PUT /cloud-docs/{docId}

请求体：`CloudDocSaveRequest`。

返回：

1. `data` 为 `CloudDocSaveResponse`。
2. 冲突时返回 `409 + CLOUD_DOC_VERSION_CONFLICT`，并返回：

```json
{
  "latestVersion": 10,
  "latestUpdatedAt": "2026-02-20T10:32:00Z"
}
```

## 7.5 DELETE /cloud-docs/{docId}

用途：删除文档（建议逻辑删除，便于回收站扩展）。

返回：

1. 成功返回空对象 `{}`。
2. 重复删除需保证幂等。

## 7.6 POST /files/upload

用途：编辑器上传图片并回填 URL。

请求：

1. `Content-Type: multipart/form-data`
2. 字段：`file`

返回建议：

```json
{
  "url": "https://cdn.example.com/cloud-docs/image/20260220/abc.png"
}
```

兼容建议：同时兼容 `fileUrl/fullUrl/uri/path` 字段，避免前端兼容成本。

## 8. 权限与安全要求

1. 所有接口需基于登录态鉴权，禁止跨用户读取或修改文档。
2. `editable = false` 时，`PUT`/`DELETE` 必须返回 `403`。
3. 文档内容需进行 XSS 安全处理（尤其 `contentHtml`）。
4. 图片上传需限制类型（`jpg/png/webp/gif`）与大小（建议 <= 10MB）。
5. 关键操作记录审计日志：创建、删除、保存、恢复、分享。

## 9. 错误码约定

1. `400 + CLOUD_DOC_INVALID_PARAM`：参数非法。
2. `401 + UNAUTHORIZED`：未登录或 token 无效。
3. `403 + CLOUD_DOC_FORBIDDEN`：无权限操作。
4. `404 + CLOUD_DOC_NOT_FOUND`：文档不存在。
5. `409 + CLOUD_DOC_VERSION_CONFLICT`：版本冲突。
6. `413 + FILE_TOO_LARGE`：上传文件过大。
7. `415 + FILE_TYPE_NOT_ALLOWED`：上传文件类型不支持。
8. `500 + INTERNAL_ERROR`：服务端异常。

## 10. 性能与可用性要求

1. 列表接口 `GET /cloud-docs`：`size=20` 时 P95 < 300ms。
2. 文档详情接口 `GET /cloud-docs/{docId}`：P95 < 250ms。
3. 保存接口 `PUT /cloud-docs/{docId}`：P95 < 300ms。
4. 图片上传接口：10MB 文件 P95 < 2s（不含客户端网络抖动）。
5. 保存成功后，列表中的 `updatedAt/lastSavedAt/version` 应可立即反映。

## 11. 验收清单（后端联调通过标准）

1. 前端可完成文档创建、列表加载、编辑自动保存、删除闭环。
2. 保存接口可正确处理高频请求且不丢数据。
3. 发生版本冲突时能返回明确错误与可恢复信息。
4. 图片上传后可直接在编辑器中展示。
5. 所有时间字段为 ISO-8601 UTC，分页字段完整一致。

## 12. 实施优先级建议

1. P0：完成 CRUD + 上传 + 乐观锁版本控制。
2. P1：补齐历史版本、恢复、复制、分享。
3. P2：接入协作 WebSocket（在线状态、游标、变更推送）。
