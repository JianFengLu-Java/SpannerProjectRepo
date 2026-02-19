# 群聊设置详情页接口需求文档

## 1. 目的与范围

本文档用于将客户端 IM 的「群聊设置详情页」接口需求一次性移交后端，实现统一的数据模型、权限规则与联调标准。

覆盖场景：

1. 顶部群资料展示与编辑。
2. 群成员预览与成员管理（查看、添加、移除、角色管理）。
3. 消息与提醒设置（免打扰、置顶、保存通讯录）。
4. 权限与安全设置（邀请权限、改群名权限、入群验证、黑名单/禁言）。
5. 群公告（读取、发布、编辑、历史）。
6. 文件与媒体入口数据聚合（群文件、图片视频、链接）。
7. 危险操作（清空聊天记录、退出群聊、解散群聊）。
8. 举报群聊。

## 2. 当前前端实现现状（基于代码）

关键文件：

1. `src/renderer/src/views/homeViews/chat/GroupChatSettingsDetail.vue`
2. `src/renderer/src/views/homeViews/chat/ChatFriendSettingPanel.vue`
3. `src/renderer/src/services/groupChatApi.ts`
4. `src/renderer/src/stores/chat.ts`

现状说明：

1. 已接入的群聊基础接口：
   1. `GET /groups/{groupNo}`
   2. `GET /groups/{groupNo}/members`
   3. `POST /groups/{groupNo}/invite`
   4. `POST /groups/{groupNo}/quit`
   5. `PUT /groups/{groupNo}/announcement`
   6. `PUT /groups/{groupNo}/admins`
   7. `DELETE /groups/{groupNo}/admins/{account}`
   8. `DELETE /groups/{groupNo}/members/{account}`
2. 页面上还有多项能力为占位交互，需要后端接口补齐。
3. 全局返回结构使用：`{ code, status, message, data }`。

## 3. 角色与权限模型（必须统一）

角色枚举：

1. `OWNER`：群主
2. `ADMIN`：管理员
3. `MEMBER`：普通成员

建议权限矩阵：

1. 编辑群资料：`OWNER | ADMIN`
2. 邀请成员：`OWNER | ADMIN` 或可配置为 `ALL`
3. 移除成员：`OWNER | ADMIN`
4. 设置/取消管理员：仅 `OWNER`
5. 发布公告：`OWNER | ADMIN`
6. 黑名单/禁言管理：`OWNER | ADMIN`
7. 解散群聊：仅 `OWNER`
8. 退出群聊：`ADMIN | MEMBER`（`OWNER` 必须先转让）

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

1. 时间字段统一 ISO-8601 UTC（如 `2026-02-19T09:30:00Z`）。
2. 列表分页统一返回：`records/page/size/total/totalPages/hasMore`。

## 4.3 幂等要求

1. 危险操作接口需支持幂等（重复请求不产生脏数据）。
2. 角色变更、成员移除需处理并发冲突（建议乐观锁版本字段）。

## 5. 数据模型定义

## 5.1 群资料 `GroupProfile`

```json
{
  "groupNo": "20010001",
  "groupName": "项目协作群",
  "groupAvatarUrl": "https://cdn.example.com/group/20010001.png",
  "summary": "项目沟通与排期同步",
  "ownerAccount": "10001",
  "myRole": "ADMIN",
  "memberCount": 128,
  "maxMembers": 500,
  "inviteMode": "ADMIN_ONLY",
  "memberCanEditGroupName": false,
  "joinVerificationEnabled": true,
  "announcementPermission": "OWNER_ADMIN",
  "createdAt": "2026-02-19T09:30:00Z",
  "updatedAt": "2026-02-19T10:30:00Z"
}
```

字段枚举建议：

1. `inviteMode`: `ALL | ADMIN_ONLY`
2. `announcementPermission`: `OWNER_ONLY | OWNER_ADMIN`

## 5.2 群成员 `GroupMemberItem`

```json
{
  "account": "10002",
  "name": "李四",
  "avatarUrl": "https://cdn.example.com/avatar/10002.png",
  "role": "MEMBER",
  "status": "ONLINE",
  "joinedAt": "2026-02-10T08:00:00Z",
  "muted": false,
  "blacklisted": false
}
```

## 5.3 群公告 `GroupAnnouncement`

```json
{
  "announcementId": "ga_20260219_0001",
  "groupNo": "20010001",
  "content": "本周五发布版本，今晚 9 点冻结代码。",
  "publisherAccount": "10001",
  "publisherName": "张三",
  "createdAt": "2026-02-19T10:30:00Z",
  "updatedAt": "2026-02-19T10:30:00Z"
}
```

## 5.4 我的群设置 `GroupUserSettings`

```json
{
  "groupNo": "20010001",
  "messageMute": false,
  "chatPinned": true,
  "saveToContacts": false,
  "updatedAt": "2026-02-19T10:30:00Z"
}
```

## 5.5 媒体统计 `GroupMediaOverview`

```json
{
  "groupNo": "20010001",
  "fileCount": 320,
  "imageVideoCount": 2480,
  "linkCount": 178
}
```

## 6. 接口清单（按优先级）

## 6.1 P0（必须）

1. `GET /groups/{groupNo}/settings/detail`
2. `GET /groups/{groupNo}/members`
3. `PUT /groups/{groupNo}/settings/my`
4. `PUT /groups/{groupNo}/settings/permissions`
5. `GET /groups/{groupNo}/announcements/latest`
6. `POST /groups/{groupNo}/announcements`
7. `PUT /groups/{groupNo}/announcements/{announcementId}`
8. `POST /groups/{groupNo}/quit`
9. `DELETE /groups/{groupNo}`（解散群聊）
10. `POST /groups/{groupNo}/reports`

## 6.2 P1（强烈建议）

1. `GET /groups/{groupNo}/members/preview?size=9`
2. `POST /groups/{groupNo}/members/batch-invite`
3. `POST /groups/{groupNo}/members/{account}/remove`
4. `PUT /groups/{groupNo}/members/{account}/role`
5. `GET /groups/{groupNo}/announcements`
6. `GET /groups/{groupNo}/media/overview`
7. `POST /groups/{groupNo}/messages/clear`（如需多端同步“清空”）

## 6.3 P2（后续扩展）

1. `GET /groups/{groupNo}/blacklist`
2. `POST /groups/{groupNo}/blacklist`
3. `DELETE /groups/{groupNo}/blacklist/{account}`
4. `GET /groups/{groupNo}/mute`
5. `POST /groups/{groupNo}/mute`
6. `DELETE /groups/{groupNo}/mute/{account}`

## 7. 接口详细定义

## 7.1 GET /groups/{groupNo}/settings/detail

用途：群设置页初始化一次拉齐展示数据。

返回：

```json
{
  "groupProfile": {},
  "mySettings": {},
  "latestAnnouncement": {},
  "mediaOverview": {}
}
```

说明：

1. 避免前端首屏多请求。
2. `mediaOverview` 可为空（后端未实现时返回 `null`）。

## 7.2 GET /groups/{groupNo}/members

Query：

1. `page`（默认 1）
2. `size`（默认 50，最大 200）
3. `keyword`（账号/昵称模糊）
4. `role`（`OWNER | ADMIN | MEMBER`）

返回：分页 `GroupMemberItem`。

## 7.3 GET /groups/{groupNo}/members/preview

Query：

1. `size` 默认 9，最大 18。

返回：`GroupMemberItem[]`（用于九宫格预览）。

## 7.4 PUT /groups/{groupNo}/settings/my

请求体：

```json
{
  "messageMute": true,
  "chatPinned": false,
  "saveToContacts": true
}
```

说明：

1. 仅更新当前用户在该群的个性化设置。
2. 支持部分字段更新（Patch 语义）。

## 7.5 PUT /groups/{groupNo}/settings/permissions

请求体：

```json
{
  "inviteMode": "ADMIN_ONLY",
  "memberCanEditGroupName": false,
  "joinVerificationEnabled": true,
  "announcementPermission": "OWNER_ADMIN"
}
```

权限：`OWNER | ADMIN`。

## 7.6 POST /groups/{groupNo}/members/batch-invite

请求体：

```json
{
  "accounts": ["10008", "10009"],
  "source": "GROUP_SETTINGS"
}
```

返回建议：

```json
{
  "successAccounts": ["10008"],
  "failed": [
    {
      "account": "10009",
      "reasonCode": "ALREADY_IN_GROUP",
      "reason": "用户已在群内"
    }
  ]
}
```

## 7.7 POST /groups/{groupNo}/members/{account}/remove

权限：`OWNER | ADMIN`。

规则：

1. 管理员不能移除群主。
2. 同级管理员互踢策略需后端明确（建议禁止）。

## 7.8 PUT /groups/{groupNo}/members/{account}/role

请求体：

```json
{
  "role": "ADMIN"
}
```

权限：仅 `OWNER`。

## 7.9 GET /groups/{groupNo}/announcements/latest

返回：`GroupAnnouncement | null`。

## 7.10 GET /groups/{groupNo}/announcements

Query：`page/size`。

返回：分页 `GroupAnnouncement`。

## 7.11 POST /groups/{groupNo}/announcements

请求体：

```json
{
  "content": "本周五发布版本，今晚 9 点冻结代码。"
}
```

权限：按 `announcementPermission` 校验。

## 7.12 PUT /groups/{groupNo}/announcements/{announcementId}

请求体：

```json
{
  "content": "更新后的公告内容"
}
```

## 7.13 GET /groups/{groupNo}/media/overview

返回：`GroupMediaOverview`。

## 7.14 POST /groups/{groupNo}/messages/clear

用途：如需实现“多端一致清空会话”时使用。

请求体（可选）：

```json
{
  "scope": "SELF"
}
```

说明：

1. 当前前端可本地清空，不强依赖后端。
2. 若支持跨端同步，建议实现该接口。

## 7.15 POST /groups/{groupNo}/quit

规则：

1. `OWNER` 调用应返回冲突，提示先转让群主。
2. 调用成功后，返回是否需要客户端清理本地会话。

返回建议：

```json
{
  "groupNo": "20010001",
  "quit": true,
  "shouldRemoveLocalSession": true
}
```

## 7.16 DELETE /groups/{groupNo}

用途：解散群聊。

权限：仅 `OWNER`。

建议：支持二次确认 token。

请求头建议：

1. `X-Confirm-Token`（由预检接口下发）。

## 7.17 POST /groups/{groupNo}/reports

请求体：

```json
{
  "reasonType": "SPAM",
  "description": "疑似广告刷屏",
  "evidenceUrls": [
    "https://cdn.example.com/report/xxx.png"
  ]
}
```

返回：举报单号。

## 8. 错误码建议

1. `400` + `INVALID_PARAM`：参数非法。
2. `401` + `UNAUTHORIZED`：未登录。
3. `403` + `GROUP_FORBIDDEN`：无操作权限。
4. `404` + `GROUP_NOT_FOUND`：群不存在。
5. `404` + `GROUP_MEMBER_NOT_FOUND`：成员不存在。
6. `409` + `GROUP_ROLE_CONFLICT`：角色冲突（如群主退群）。
7. `409` + `GROUP_STATE_CONFLICT`：状态冲突（群已解散等）。
8. `429` + `GROUP_RATE_LIMITED`：操作频控。
9. `500` + `INTERNAL_ERROR`：服务端错误。

## 9. 安全与审计要求

1. 危险操作（移除成员、角色变更、解散群）必须记录审计日志。
2. 审计字段至少包含：`operatorAccount`、`groupNo`、`action`、`targetAccount`、`before`、`after`、`timestamp`。
3. 举报接口需要防刷限流与内容安全检测。
4. 公告、群简介等文本字段需做 XSS 过滤与长度限制。

## 10. 性能与一致性要求

1. `GET /groups/{groupNo}/settings/detail` P95 < 300ms。
2. 成员列表 `size=50` 时 P95 < 400ms。
3. 设置变更成功后，重新拉取详情可立即看到最新值（最终一致建议 <= 2s）。
4. 群成员数、角色信息、公告信息在详情页与会话页保持一致。

## 11. 验收清单（联调通过标准）

1. 群设置页首屏一次请求可渲染完整核心信息。
2. 消息免打扰/置顶/保存通讯录开关支持即时保存并回显。
3. 邀请权限、改群名权限、入群验证可修改并正确生效。
4. 公告支持读取最新、发布、编辑与历史查询。
5. 群主与成员在危险操作上的权限边界正确。
6. 举报接口可提交并返回举报单号。
7. 所有错误返回明确 `code/status/message`，前端可直接提示。

## 12. 实施优先级建议

1. P0：详情聚合接口 + 我的设置保存 + 权限设置 + 公告 + 退出/解散 + 举报。
2. P1：成员预览/分页 + 批量邀请 + 角色变更 + 媒体统计。
3. P2：黑名单/禁言完整体系 + 清空消息跨端同步。

