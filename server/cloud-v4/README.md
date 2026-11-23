# 托管论文问答

此入口将静态工作台和 Qwen／DeepSeek 服务打包到同一 Sites Worker。主站可以继续使用 GitHub Pages。托管工作台可通过 ChatGPT 登录，用户自带的模型密钥只用于这次请求。登录、书目勾选和模型选择分别进行。免费浏览器模型在设备上运行。

## 构建

需要 Node.js 20 或更新版本、已注册的 Sites 项目检出目录，以及完整的公开页面资源。保留检出目录的 `.openai/hosting.json` 和项目 ID，采用 Worker 配置并省略 `static`。将本目录和公开页面资源纳入同一项目的版本控制，以便重建。

```sh
node server/cloud-v4/build.mjs --checkout /path/to/site --assets /path/to/public-ui
```

`--assets` 指向包含 `index.html`、`zhong.html`、`ai-v3.js` 和 `ai-worker-v4.js` 的目录。构建输出为指定检出目录下的 `dist/server/index.js` 和 `dist/.openai/hosting.json`。通过 Sites 的 Worker 发布流程部署该目录。入口支持站点根路径和 `/byline-atlas/`。

## 登录、额度与密钥

请让 Sites Dispatch 直接接收请求，由它验证登录并提供 `oai-authenticated-user-id`。如在其他平台运行，必须先适配身份边界，防止来访者构造身份请求头。模型端点只接受同源 JSON 请求。个人 API Key 经同源请求的 Authorization 头传入，转发至选定提供商。服务不写出问题、书目信息或密钥日志。推理提供商按自身条款处理发送的内容和费用。

| 配置 | 用途 |
|---|---|
| `DASHSCOPE_API_KEY`、`DEEPSEEK_API_KEY` | 可选的运营方密钥，经平台 Secret 配置 |
| `DASHSCOPE_REGION` | 默认 `cn`，国际站配置为 `intl`。使用个人密钥时同样需要与部署区匹配 |
| `DASHSCOPE_MODEL`、`DEEPSEEK_MODEL` | 运营方可选模型 ID，默认 `qwen-plus`、`deepseek-flash` |
| `DB` | 运营方代付时需要的 D1 绑定。将 `0001_usage.sql` 纳入项目的数据库迁移并在部署前执行 |
| `ATLAS_AI_USER_PER_DAY`、`ATLAS_AI_TOTAL_PER_DAY` | 运营方付费的单用户、全站每日请求上限，默认 5 和 100，最高 50 和 2,000 |

使用运营方账户时，每次模型调用前按 UTC 日期预留一次请求配额。并发请求通过同一个数据库写入竞争配额，上游错误仍占用该次请求。每日表仅保存日期、站内用户 ID 的哈希和请求次数。配额表不可用时停用运营方代付。使用个人密钥仍可问答。每轮回复最多请求 850 个输出 token。用户问题、历史轮数、书目数量和请求体另有上限。

平台入口 `/signin-with-chatgpt` 和 `/signout-with-chatgpt` 由 Sites 负责。用量表记录请求次数，尚未对接订单或代扣。界面展示的 token 来自上游实际响应。
