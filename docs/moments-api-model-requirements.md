# 动态模块 API 与模型需求文档

## 1. 目的与范围

本文档用于明确前端“动态（Moments）”模块联调所需的后端 API 和数据模型，覆盖以下场景：

1. 动态流列表（推荐/朋友/附近/热榜）加载与分页。
2. 动态发布（标题、富文本、图片）。
3. 点赞与取消点赞。
4. 评论列表与发表评论。
5. 动态详情展示。
6. 后续扩展位（收藏、添加好友、点赞信息、分享）的接口预留。

## 2. 当前前端现状（基于代码）

当前动态模块主要在以下文件：

1. `src/renderer/src/stores/moment.ts`
2. `src/renderer/src/views/homeViews/moments/DynamicsView.vue`
3. `src/renderer/src/views/homeViews/moments/MomentDetail.vue`
4. `src/renderer/src/views/homeViews/moments/MomentPublishEditor.vue`
5. `src/renderer/src/views/homeViews/moments/FriendMomentList.vue`
6. `src/renderer/src/views/homeViews/moments/MomentCard.vue`

现状说明：

1. 数据来自前端本地 mock（`moment.ts` 内置数组），尚未接后端。
2. 发布、点赞、评论均在前端本地状态中完成。
3. 图片目前通过 base64 嵌入富文本，未走上传接口。
4. 全局接口包装使用统一格式：`{ code, status, message, data }`。

## 3. 必需 API 总览（P0）

1. `GET /moments`：动态流分页查询。
2. `GET /moments/{momentId}`：动态详情。
3. `POST /moments`：发布动态。
4. `POST /moments/{momentId}/likes`：点赞。
5. `DELETE /moments/{momentId}/likes`：取消点赞。
6. `GET /moments/{momentId}/comments`：评论分页查询（支持一级评论 + 回复）。
7. `POST /moments/{momentId}/comments`：发表评论/回复。
8. `GET /moments/{momentId}/likes`：点赞信息（最近点赞用户 + 点赞列表分页）。
9. `POST /files/upload`：图片上传（发布前先传图，再提交 URL）。

## 4. 建议 API（P1/P2）

1. `POST /moments/{momentId}/favorite` 与 `DELETE /moments/{momentId}/favorite`（收藏）。
2. `POST /friends/apply`（添加好友，复用现有好友申请能力）。
3. `GET /moments/tags/hot`（热门话题）。
4. `POST /moments/{momentId}/share`（分享记录，可选埋点）。

## 5. 模型定义（前后端统一）

## 5.1 通用返回结构

```json
{
  "code": 200,
  "status": "OK",
  "message": "success",
  "data": {}
}
```

## 5.2 动态主模型 `MomentItem`

```json
{
  "id": "m_20260212_000001",
  "title": "今日份打卡",
  "cover": "https://cdn.example.com/moments/cover-1.jpg",
  "author": {
    "account": "10001",
    "name": "张三",
    "avatar": "https://cdn.example.com/avatar-10001.png"
  },
  "content": "纯文本内容",
  "contentHtml": "<p>富文本内容</p>",
  "images": [
    "https://cdn.example.com/moments/img-1.jpg"
  ],
  "likes": 12,
  "isLiked": false,
  "likePreviewUsers": [
    {
      "account": "10002",
      "name": "李四",
      "avatar": "https://cdn.example.com/avatar-10002.png"
    }
  ],
  "commentsCount": 3,
  "isFavorited": false,
  "friendStatusWithAuthor": "NONE",
  "timestamp": "2026-02-12T08:30:00Z",
  "createdAt": "2026-02-12T08:30:00Z",
  "updatedAt": "2026-02-12T08:30:00Z"
}
```

字段约束：

1. `timestamp/createdAt/updatedAt` 使用 ISO-8601 UTC。
2. `cover` 可为空；为空时前端可回退到 `images[0]` 或默认封面。
3. `content` 与 `contentHtml` 至少有一个非空。
4. `friendStatusWithAuthor` 枚举建议：`NONE | PENDING_OUTBOUND | PENDING_INBOUND | FRIEND`。

## 5.3 评论模型 `MomentCommentItem`

```json
{
  "id": "mc_20260212_000001",
  "momentId": "m_20260212_000001",
  "parentCommentId": null,
  "replyToAccount": null,
  "author": {
    "account": "10002",
    "name": "李四",
    "avatar": "https://cdn.example.com/avatar-10002.png"
  },
  "text": "评论内容",
  "likes": 0,
  "isLiked": false,
  "replyCount": 0,
  "timestamp": "2026-02-12T09:00:00Z",
  "createdAt": "2026-02-12T09:00:00Z"
}
```

评论增强约束：

1. `parentCommentId = null` 表示一级评论；非空表示回复评论。
2. `replyToAccount` 在回复场景必填。
3. 详情页首屏建议返回一级评论 + 每条一级评论前 N 条回复（如 2 条）。

## 5.4 点赞用户模型 `MomentLikeUser`

```json
{
  "account": "10003",
  "name": "王五",
  "avatar": "https://cdn.example.com/avatar-10003.png",
  "likedAt": "2026-02-12T09:30:00Z"
}
```

## 5.5 分页模型 `CursorPage<T>`

```json
{
  "records": [],
  "nextCursor": "2026-02-12T08:00:00Z_m_20260212_000120",
  "hasMore": true
}
```

## 6. 接口详细定义

## 6.1 GET /moments

Query 参数：

1. `tab`：`recommend | friends | nearby | trending`。
2. `keyword`：可选，标题/内容/作者模糊搜索。
3. `cursor`：可选，游标分页。
4. `size`：可选，默认 `20`，最大 `50`。
5. `lat`/`lng`：`nearby` 场景可选。

返回：

1. `data` 使用 `CursorPage<MomentItem>`。

## 6.2 GET /moments/{momentId}

返回：

1. `data` 为单条 `MomentItem`。
2. 详情建议返回最近 N 条评论（如 20 条），减少首屏请求次数。

## 6.3 POST /moments

请求体：

```json
{
  "title": "标题",
  "contentText": "纯文本",
  "contentHtml": "<p>富文本</p>",
  "images": [
    "https://cdn.example.com/moments/img-1.jpg"
  ]
}
```

返回：

1. `data` 为新建后的 `MomentItem`（前端可直接插入列表顶部）。

## 6.4 POST /moments/{momentId}/likes

请求体：空。

返回建议：

```json
{
  "liked": true,
  "likes": 13
}
```

## 6.5 DELETE /moments/{momentId}/likes

返回建议：

```json
{
  "liked": false,
  "likes": 12
}
```

## 6.6 GET /moments/{momentId}/comments

Query 参数：

1. `cursor`：可选。
2. `size`：默认 `20`，最大 `50`。
3. `parentCommentId`：可选，不传表示查询一级评论，传值表示查询某条评论的回复。
4. `sort`：可选，`latest | hot`，默认 `latest`。

返回：

1. `data` 使用 `CursorPage<MomentCommentItem>`。

## 6.7 POST /moments/{momentId}/comments

请求体：

```json
{
  "text": "评论内容",
  "parentCommentId": null,
  "replyToAccount": null
}
```

返回：

1. `data` 为新建后的 `MomentCommentItem`。

## 6.8 GET /moments/{momentId}/likes

Query 参数：

1. `cursor`：可选。
2. `size`：默认 `20`，最大 `50`。

返回：

1. `data` 使用 `CursorPage<MomentLikeUser>`。
2. 建议 `MomentItem.likePreviewUsers` 与此接口数据一致（取前 N 条）。

## 6.9 POST /files/upload

请求方式：

1. `multipart/form-data`，字段名建议 `file`，支持多文件可扩展 `files[]`。

返回示例：

```json
{
  "url": "https://cdn.example.com/moments/2026/02/12/xxx.jpg",
  "width": 1080,
  "height": 720,
  "size": 245812
}
```

## 7. 业务规则与约束

1. 点赞/取消点赞必须幂等。
2. 评论文本建议长度 `1-500`，需做 XSS 过滤。
3. 评论回复深度建议限制为 2 层（一级评论 + 回复），避免无限嵌套。
4. 发布动态时标题建议最大 `80` 字（匹配前端输入限制）。
5. 图片上传需校验类型和大小（建议单图 <= 10MB）。
6. 所有“按用户可见范围”查询必须做鉴权隔离。

## 8. 错误码建议

1. `400` + `MOMENT_INVALID_PARAM`：参数非法。
2. `401` + `UNAUTHORIZED`：未登录或 token 无效。
3. `403` + `MOMENT_FORBIDDEN`：无权限。
4. `404` + `MOMENT_NOT_FOUND`：动态不存在。
5. `404` + `MOMENT_COMMENT_NOT_FOUND`：评论不存在。
6. `409` + `MOMENT_STATE_CONFLICT`：状态冲突（重复操作等）。
7. `500` + `INTERNAL_ERROR`：服务端异常。

## 9. 验收清单（联调通过标准）

1. 列表能按 `tab` 正确返回，并支持分页下拉加载。
2. 发布后返回完整 `MomentItem`，前端可立即渲染。
3. 点赞/取消点赞可重复调用且结果正确。
4. 评论发表成功后可立即在详情页和列表页显示，回复链路正确。
5. 点赞信息接口可返回最近点赞用户与完整分页列表。
6. 详情页作者位可根据 `friendStatusWithAuthor` 渲染“添加好友/已申请/已是好友”。
7. 图片上传返回稳定 URL，重启后图片仍可访问。
8. 所有时间字段均为 ISO-8601 UTC。

## 10. 实施优先级

1. P0：`GET /moments`、`POST /moments`、点赞、评论、上传接口。
2. P1：详情接口补齐 + 评论增强 + 添加好友状态联动 + 点赞信息。
3. P2：热榜标签、分享埋点、更多统计字段。
