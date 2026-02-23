# 视频通话（WebRTC + 信令）后端接口需求文档

## 1. 目的与范围

本文档用于将前端 IM 的「视频通话」能力一次性移交后端，实现可联调、可上线的音视频信令与通话状态同步能力。

覆盖场景：

1. 私聊发起视频通话（主叫）。
2. 被呼叫弹窗（独立窗口）接听/挂断。
3. 接听后进入视频通话窗口（复用现有前端通话页）。
4. 通话中状态同步（接通、挂断、超时、忙线）。
5. WebRTC 信令交换（Offer/Answer/ICE）。
6. 弱网/断线重连后的状态恢复与幂等处理。

## 2. 当前前端实现现状（基于代码）

关键文件：

1. `src/renderer/src/views/homeViews/chat/ChatContext.vue`
2. `src/renderer/src/views/homeViews/chat/IncomingCallView.vue`
3. `src/renderer/src/views/homeViews/chat/MockVideoCallView.vue`
4. `src/renderer/src/services/privateChatWs.ts`
5. `src/renderer/src/services/callSignal.ts`
6. `src/renderer/src/stores/chat.ts`

现状说明：

1. 当前视频通话窗口已是独立 Electron 窗口。
2. 前端已具备“来电事件入口”，收到来电事件后可自动弹出被呼叫窗口。
3. 被呼叫窗口已支持“接听/挂断”按钮；接听后会打开视频通话窗口。
4. 前端已接入本地摄像头预览（`getUserMedia`），但远端媒体流仍待后端信令联调。
5. 私聊 WS 已预留来电频道：`/user/queue/calls`（STOMP）。
6. 全局响应结构沿用：`{ code, status, message, data }`。

## 3. 总体方案（建议）

1. 媒体层：浏览器/Electron WebRTC（P2P 或 SFU 均可，本文档按信令抽象，不强绑实现）。
2. 信令层：基于现有 STOMP WS 通道做事件推送（推荐），并配套少量 REST 兜底查询接口。
3. 会话层：后端维护 `callId` 生命周期与状态机，所有动作以 `callId` 为主键。
4. 鉴权：全部接口/WS 均基于登录态 Token。

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

## 4.2 时间与幂等

1. 时间统一 ISO-8601 UTC（如 `2026-02-23T08:30:00Z`）。
2. 发起/接听/挂断等写操作必须支持幂等，建议通过 `requestId` 去重。
3. 同一 `callId` 的状态变更必须单调推进，禁止状态回退。

## 4.3 呼叫类型枚举

1. `VIDEO`
2. `AUDIO`（可预留，当前前端主用 `VIDEO`）

## 5. 状态模型（必须统一）

`CallSession.status` 建议枚举：

1. `RINGING`：振铃中（已通知被叫，待接听）。
2. `ANSWERED`：已接听，进入协商阶段。
3. `CONNECTING`：WebRTC 协商中。
4. `CONNECTED`：媒体已建立。
5. `REJECTED`：被叫拒绝。
6. `CANCELED`：主叫取消（被叫未接听前）。
7. `NO_ANSWER`：超时未接听。
8. `BUSY`：被叫忙线。
9. `ENDED`：通话结束（任一方主动挂断）。
10. `FAILED`：异常失败（协商失败/服务异常）。

状态机约束：

1. `RINGING -> ANSWERED|REJECTED|CANCELED|NO_ANSWER|BUSY`
2. `ANSWERED -> CONNECTING -> CONNECTED|FAILED`
3. `CONNECTED -> ENDED`
4. 终态：`REJECTED|CANCELED|NO_ANSWER|BUSY|ENDED|FAILED`

## 6. 数据模型定义

## 6.1 通话会话 `CallSession`

```json
{
  "callId": "call_20260223_000001",
  "type": "VIDEO",
  "status": "RINGING",
  "callerAccount": "10001",
  "callerName": "张三",
  "callerAvatar": "https://cdn.example.com/avatar/10001.png",
  "calleeAccount": "10002",
  "calleeName": "李四",
  "calleeAvatar": "https://cdn.example.com/avatar/10002.png",
  "channelId": "private:10001:10002",
  "startedAt": "2026-02-23T08:30:00Z",
  "answeredAt": null,
  "connectedAt": null,
  "endedAt": null,
  "endReason": null
}
```

## 6.2 信令消息 `CallSignal`

```json
{
  "callId": "call_20260223_000001",
  "signalType": "OFFER",
  "from": "10001",
  "to": "10002",
  "sdp": "v=0...",
  "candidate": null,
  "sdpMid": null,
  "sdpMLineIndex": null,
  "createdAt": "2026-02-23T08:30:02Z"
}
```

`signalType` 枚举建议：

1. `OFFER`
2. `ANSWER`
3. `ICE_CANDIDATE`
4. `RENegotiate`（可选）

## 6.3 来电推送事件 `IncomingCallEvent`

```json
{
  "callId": "call_20260223_000001",
  "from": "10001",
  "fromName": "张三",
  "fromAvatar": "https://cdn.example.com/avatar/10001.png",
  "type": "video",
  "chatId": 10001,
  "createdAt": "2026-02-23T08:30:00Z"
}
```

说明：

1. 字段命名保持与前端当前实现兼容（`from/fromName/fromAvatar/type/chatId`）。
2. `type` 当前前端按小写处理：`video|audio`。

## 7. 接口清单（按优先级）

## 7.1 P0（必须）

1. `POST /calls`：发起通话。
2. `POST /calls/{callId}/accept`：被叫接听。
3. `POST /calls/{callId}/reject`：被叫拒绝。
4. `POST /calls/{callId}/cancel`：主叫取消（未接听前）。
5. `POST /calls/{callId}/end`：通话中挂断。
6. `GET /calls/{callId}`：查询会话最新状态（兜底）。
7. `POST /calls/{callId}/signals`：上行 WebRTC 信令。
8. `WS 事件推送`：
   1. `/user/queue/calls`（来电与状态事件）
   2. `/user/queue/call-signals`（WebRTC 信令下行）

## 7.2 P1（强烈建议）

1. `GET /calls/history`：通话记录列表（用于后续“最近通话”）。
2. `POST /calls/{callId}/heartbeat`：通话保活（弱网与多端容错）。
3. `GET /rtc/ice-servers`：下发 STUN/TURN（含短期凭证）。

## 7.3 P2（扩展）

1. 多端同时在线抢接策略（首接成功，其它端自动收到 `BUSY`/`ANSWERED_BY_OTHER_DEVICE`）。
2. 群视频通话（多方）。
3. 屏幕共享信令扩展。

## 8. 接口详细定义

## 8.1 POST /calls

用途：主叫发起视频通话。

请求体：

```json
{
  "requestId": "req_20260223_000001",
  "calleeAccount": "10002",
  "type": "VIDEO"
}
```

返回：

```json
{
  "callId": "call_20260223_000001",
  "status": "RINGING",
  "expiresAt": "2026-02-23T08:30:45Z"
}
```

服务端动作：

1. 创建 `CallSession`。
2. 向被叫推送 `/user/queue/calls` `incoming.call` 事件。
3. 向主叫回推 `call.ringing`（可选但建议）。

## 8.2 POST /calls/{callId}/accept

用途：被叫接听。

请求体：

```json
{
  "requestId": "req_20260223_000010"
}
```

返回：

```json
{
  "callId": "call_20260223_000001",
  "status": "ANSWERED",
  "answeredAt": "2026-02-23T08:30:06Z"
}
```

服务端动作：

1. 状态从 `RINGING` -> `ANSWERED`。
2. 主叫与被叫双方收到 `call.answered` 事件。

## 8.3 POST /calls/{callId}/reject

用途：被叫拒绝来电。

请求体：

```json
{
  "requestId": "req_20260223_000011",
  "reason": "REJECTED_BY_USER"
}
```

返回：`{ callId, status: "REJECTED", endedAt, endReason }`

## 8.4 POST /calls/{callId}/cancel

用途：主叫在被叫接听前取消呼叫。

请求体：

```json
{
  "requestId": "req_20260223_000012"
}
```

返回：`{ callId, status: "CANCELED", endedAt }`

## 8.5 POST /calls/{callId}/end

用途：通话中任意一方挂断。

请求体：

```json
{
  "requestId": "req_20260223_000013",
  "reason": "HANGUP"
}
```

返回：`{ callId, status: "ENDED", endedAt, durationSeconds }`

## 8.6 GET /calls/{callId}

用途：客户端重连/窗口恢复时拉取最新状态。

返回：`CallSession`。

## 8.7 POST /calls/{callId}/signals

用途：上传 WebRTC Offer/Answer/ICE。

请求体示例（Offer）：

```json
{
  "requestId": "req_20260223_000020",
  "signalType": "OFFER",
  "to": "10002",
  "sdp": "v=0..."
}
```

请求体示例（ICE）：

```json
{
  "requestId": "req_20260223_000021",
  "signalType": "ICE_CANDIDATE",
  "to": "10002",
  "candidate": "candidate:...",
  "sdpMid": "0",
  "sdpMLineIndex": 0
}
```

返回：`{ accepted: true }`。

服务端动作：

1. 参数校验通过后，转发到对端 `/user/queue/call-signals`。
2. 信令转发失败时返回明确错误码。

## 8.8 GET /rtc/ice-servers（P1）

返回示例：

```json
{
  "servers": [
    { "urls": ["stun:stun.l.google.com:19302"] },
    {
      "urls": ["turn:turn.example.com:3478?transport=udp"],
      "username": "u_abc",
      "credential": "pwd_xyz",
      "ttlSeconds": 600
    }
  ]
}
```

## 9. WebSocket 事件定义（必须）

## 9.1 `/user/queue/calls` 事件

### 9.1.1 `incoming.call`

```json
{
  "event": "incoming.call",
  "payload": {
    "callId": "call_20260223_000001",
    "from": "10001",
    "fromName": "张三",
    "fromAvatar": "https://cdn.example.com/avatar/10001.png",
    "type": "video",
    "chatId": 10001,
    "createdAt": "2026-02-23T08:30:00Z"
  }
}
```

### 9.1.2 `call.answered`

```json
{
  "event": "call.answered",
  "payload": {
    "callId": "call_20260223_000001",
    "answeredBy": "10002",
    "answeredAt": "2026-02-23T08:30:06Z"
  }
}
```

### 9.1.3 `call.ended`

```json
{
  "event": "call.ended",
  "payload": {
    "callId": "call_20260223_000001",
    "status": "ENDED",
    "endReason": "HANGUP",
    "endedAt": "2026-02-23T08:38:12Z",
    "durationSeconds": 486
  }
}
```

## 9.2 `/user/queue/call-signals` 事件

结构即 `CallSignal`，由服务端透传（可增加 `event: "call.signal"` 包装层）。

## 10. 时序要求（联调重点）

## 10.1 主叫发起 -> 被叫接听

1. 主叫 `POST /calls` 成功，拿到 `callId`。
2. 被叫收到 `incoming.call`，前端弹出被呼叫独立窗口。
3. 被叫点击接听，调用 `POST /calls/{callId}/accept`。
4. 双方收到 `call.answered`。
5. 双方开始 `OFFER/ANSWER/ICE` 交换，协商成功后进入 `CONNECTED`。

## 10.2 未接通结束

1. 被叫拒绝：`reject` -> `REJECTED` -> 双方收到 `call.ended`。
2. 主叫取消：`cancel` -> `CANCELED` -> 双方收到 `call.ended`。
3. 超时无人接听：服务端定时 -> `NO_ANSWER` -> 双方收到 `call.ended`。

## 11. 并发与幂等规则（必须）

1. 同一用户同一时间仅允许一个活跃 `RINGING/CONNECTING/CONNECTED` 会话（可配置）。
2. 多端同时接听：首个 `accept` 成功，后续返回 `409 CALL_STATE_CONFLICT`。
3. 同一 `requestId` 重试必须返回同结果，不得重复写状态。
4. `end/reject/cancel` 对终态会话重复调用应幂等返回成功或明确“已终态”语义。

## 12. 错误码约定

1. `400 + CALL_INVALID_PARAM`：参数错误。
2. `401 + UNAUTHORIZED`：未登录或 token 无效。
3. `403 + CALL_FORBIDDEN`：无权操作该会话。
4. `404 + CALL_NOT_FOUND`：会话不存在。
5. `409 + CALL_STATE_CONFLICT`：状态冲突（如已被接听还取消）。
6. `409 + CALLEE_BUSY`：被叫忙线。
7. `410 + CALL_EXPIRED`：会话超时失效。
8. `422 + RTC_SIGNAL_INVALID`：信令格式非法。
9. `500 + INTERNAL_ERROR`：服务端异常。

## 13. 安全与风控要求

1. 来电频控：同一主叫对同一被叫分钟级限流，防骚扰。
2. 黑名单拦截：被叫拉黑主叫时直接拒绝创建会话。
3. 审计日志：发起、接听、拒绝、挂断、超时均需记录。
4. TURN 凭证需短期有效（建议 10 分钟），禁止长期明文凭证下发。
5. 信令内容校验长度与格式，防止超大包/注入。

## 14. 性能与可用性要求

1. `POST /calls` P95 < 200ms。
2. 事件投递（创建到被叫收到来电）P95 < 500ms。
3. 信令转发 P95 < 150ms。
4. 状态变更后，`GET /calls/{callId}` 在 1 秒内可读到最新状态。

## 15. 验收清单（后端联调通过标准）

1. 被叫能稳定收到 `incoming.call`，并弹出独立来电窗口。
2. 接听/挂断/拒绝/取消都能正确落库并推送双端状态。
3. 接听后前端可基于信令建立 WebRTC（本地+远端媒体流可渲染）。
4. 多端同时接听与重复请求不会产生状态错乱。
5. 超时未接听会自动结束，并正确回推 `NO_ANSWER`。
6. 异常场景（断线重连、重复请求、会话已终态）均有稳定错误语义。

## 16. 实施优先级建议

1. P0：`POST /calls`、`accept/reject/cancel/end`、`signals`、`/user/queue/calls`、`/user/queue/call-signals`。
2. P1：`GET /calls/{callId}`、`GET /rtc/ice-servers`、`heartbeat`、通话记录。
3. P2：多端高级策略、群通话、屏幕共享。
