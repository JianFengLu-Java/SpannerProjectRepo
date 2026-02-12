# 好友申请历史接口需求文档

## 1. 目的与范围

本文档用于补齐前端“好友申请”模块的后端能力，重点支持以下场景：

1. 展示待处理申请（已有能力，继续保留）。
2. 展示完整历史记录（含我收到的申请、我发出的申请、已同意、已拒绝、已取消、已过期）。
3. 支持按状态筛选、分页、时间排序。
4. 为前端提供稳定可扩展的数据结构，避免后续频繁改接口。

## 2. 当前前端已使用接口（保持兼容）

前端当前已调用以下接口，请继续兼容：

1. `POST /friends/apply`
2. `POST /friends/accept`
3. `POST /friends/reject`
4. `GET /friends/requests/pending`
5. `GET /friends/users/{account}`
6. `GET /friends`

要求：现有返回结构不破坏已有字段语义。

## 3. 新增能力总览

## 3.1 新增接口

1. `GET /friends/requests/history`：分页查询好友申请历史。
2. `GET /friends/requests/history/{requestId}`：查询单条申请详情（可选但建议）。
3. `POST /friends/cancel`：取消我发出的待处理申请（建议）。

## 3.2 对已有接口的增强（建议）

1. `POST /friends/apply` 返回 `requestId`。
2. `POST /friends/accept` 返回变更后的申请记录关键信息。
3. `POST /friends/reject` 返回变更后的申请记录关键信息。

## 4. 状态模型（必须统一）

申请状态统一为以下枚举：

1. `PENDING`：待处理
2. `ACCEPTED`：已同意
3. `REJECTED`：已拒绝
4. `CANCELED`：已取消（申请方主动取消）
5. `EXPIRED`：已过期（系统超时）

方向枚举：

1. `INBOUND`：我收到的申请
2. `OUTBOUND`：我发出的申请

要求：

1. 历史接口必须同时支持 `INBOUND` 和 `OUTBOUND`。
2. `GET /friends/requests/pending` 继续返回 `INBOUND + PENDING`。

## 5. 数据结构定义

历史记录项 `FriendRequestHistoryItem`：

```json
{
  "requestId": "fr_20260212_000001",
  "direction": "INBOUND",
  "status": "PENDING",
  "applicantAccount": "10001",
  "applicantName": "张三",
  "applicantAvatarUrl": "https://...",
  "targetAccount": "10002",
  "targetName": "李四",
  "targetAvatarUrl": "https://...",
  "verificationMessage": "你好，想加你为好友",
  "source": "ACCOUNT_SEARCH",
  "operatorAccount": "10002",
  "createdAt": "2026-02-12T08:30:00Z",
  "updatedAt": "2026-02-12T08:30:00Z",
  "expiredAt": "2026-02-19T08:30:00Z"
}
```

字段说明：

1. `requestId`：全局唯一主键，字符串。
2. `direction`：相对当前登录用户的方向，后端直接计算并返回。
3. `status`：申请状态。
4. `verificationMessage`：申请附言，可空。
5. `operatorAccount`：最近一次状态变更执行人，可空。
6. `createdAt` / `updatedAt` / `expiredAt`：ISO-8601 UTC 时间，`expiredAt` 可空。

## 6. 接口详细定义

## 6.1 GET /friends/requests/history

### Query 参数

1. `page`：页码，从 `1` 开始，默认 `1`。
2. `size`：每页数量，默认 `20`，最大 `100`。
3. `direction`：可选，`INBOUND | OUTBOUND`。
4. `status`：可选，支持单值或逗号分隔多值（如 `PENDING,REJECTED`）。
5. `startTime`：可选，过滤 `createdAt >= startTime`。
6. `endTime`：可选，过滤 `createdAt <= endTime`。
7. `keyword`：可选，按账号/昵称模糊搜索。

### 返回示例

```json
{
  "code": 200,
  "status": "OK",
  "message": "success",
  "data": {
    "records": [
      {
        "requestId": "fr_20260212_000001",
        "direction": "INBOUND",
        "status": "ACCEPTED",
        "applicantAccount": "10001",
        "applicantName": "张三",
        "applicantAvatarUrl": "https://...",
        "targetAccount": "10002",
        "targetName": "李四",
        "targetAvatarUrl": "https://...",
        "verificationMessage": "你好，想加你为好友",
        "source": "ACCOUNT_SEARCH",
        "operatorAccount": "10002",
        "createdAt": "2026-02-11T08:30:00Z",
        "updatedAt": "2026-02-11T09:00:00Z",
        "expiredAt": null
      }
    ],
    "page": 1,
    "size": 20,
    "total": 128,
    "totalPages": 7,
    "hasMore": true
  }
}
```

### 排序要求

1. 默认按 `updatedAt DESC`。
2. 若 `updatedAt` 为空，回退 `createdAt DESC`。

## 6.2 GET /friends/requests/history/{requestId}（建议）

用途：在前端点击某条历史记录时展示完整详情，避免列表字段膨胀。

返回：单条 `FriendRequestHistoryItem`。

## 6.3 POST /friends/cancel（建议）

### 请求体

```json
{
  "requestId": "fr_20260212_000001"
}
```

### 业务规则

1. 仅允许 `OUTBOUND + PENDING` 被取消。
2. 取消后状态变为 `CANCELED`，并写入 `updatedAt`、`operatorAccount`。

## 7. 幂等与并发规则

1. `accept/reject/cancel` 对同一 `requestId` 必须幂等。
2. 若申请状态已终态（`ACCEPTED/REJECTED/CANCELED/EXPIRED`），重复操作返回业务错误，不应写脏数据。
3. 并发处理建议基于行锁或乐观锁版本号。

## 8. 错误码约定

建议统一业务错误码（HTTP 状态码 + 业务 code）：

1. `400` + `FRIEND_REQUEST_INVALID_PARAM`：参数非法。
2. `401` + `UNAUTHORIZED`：未登录或 token 无效。
3. `403` + `FRIEND_REQUEST_FORBIDDEN`：无权限操作该申请。
4. `404` + `FRIEND_REQUEST_NOT_FOUND`：申请不存在。
5. `409` + `FRIEND_REQUEST_STATE_CONFLICT`：状态冲突（如已处理还再次同意）。
6. `500` + `INTERNAL_ERROR`：服务端异常。

## 9. 数据一致性要求

1. 当 `POST /friends/accept` 成功后，`GET /friends` 中应可立即看到该好友关系（最终一致时间建议 <= 2 秒）。
2. 当 `accept/reject/cancel` 成功后，`GET /friends/requests/history` 应可立即反映新状态。
3. `GET /friends/requests/pending` 与 `history` 的 `PENDING + INBOUND` 在同一时间点应一致。

## 10. 性能与分页要求

1. `GET /friends/requests/history` P95 响应时间建议 < 300ms（`size=20`）。
2. 数据量 10 万级时仍能按索引分页，禁止全表扫描。
3. 推荐索引：
   1. `(owner_account, direction, status, updated_at desc)`
   2. `(owner_account, created_at desc)`
   3. `(owner_account, applicant_account)` / `(owner_account, target_account)`

## 11. 审计与安全

1. 记录关键操作审计日志：`apply/accept/reject/cancel`。
2. `verificationMessage` 需做长度限制和 XSS 处理（建议最大 200 字）。
3. 任何查询必须基于当前登录用户隔离，禁止越权读取他人申请记录。

## 12. 验收清单（后端联调通过标准）

1. 能返回历史记录，且包含 `INBOUND + OUTBOUND`。
2. 支持状态筛选并返回正确总数/分页信息。
3. `accept/reject` 后历史状态实时变化。
4. 重复同意/拒绝返回明确冲突错误，不会重复写库。
5. 前端可基于返回字段直接渲染“待处理/已同意/已拒绝/已取消/已过期”。
6. 全部时间字段为 ISO-8601 UTC。

## 13. 实施优先级建议

1. P0：`GET /friends/requests/history` + 状态枚举统一 + `apply/accept/reject` 返回 `requestId`。
2. P1：`POST /friends/cancel`。
3. P2：`GET /friends/requests/history/{requestId}` 详情接口。

