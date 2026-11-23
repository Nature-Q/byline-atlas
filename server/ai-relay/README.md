# 论文问答

公开网站默认使用 WebLLM 在浏览器运行 Qwen2.5-0.5B。第一次明确发送问题后才会下载数百 MB 的模型文件，需支持 WebGPU 的安全浏览器环境。推理使用本机资源，免云端 API 费用。个人云端模式支持通义千问及 DeepSeek，密钥只在打开的问答页内存中保留。云端额度和账单以个人供应商账户为准。[WebLLM 文档](https://webllm.mlc.ai/docs/user/get_started.html) · [百炼试用额度](https://www.alibabacloud.com/help/en/model-studio/new-free-quota) · [DeepSeek 定价](https://api-docs.deepseek.com/quick_start/pricing/)

每轮可单独输入问题，选择附上当前书目后可预览材料。浏览器小模型每轮最多取四篇，云端模型每轮最多取二十四篇，可调整起始位置。模型收到最近的若干轮对话和本轮所选书目。切换模型、书目或勾选状态会开启新对话。署名待核、排除记录、人员名册和人工核查备注均不进入书目包。Token 数取自推理输出，实际云端费用以供应商账单为准。

## 运行本机服务

下载本仓库，安装 Node.js 20 或以上版本。在仓库根目录运行以下命令，从浏览器进入 <http://127.0.0.1:8775/#ai>。本地服务默认只监听回环地址。个人电脑上的套件可以单独启用一种或多种模型。

```console
node server/ai-relay/ai-local-v3.mjs
```

| 方式 | 设置 |
|---|---|
| Ollama 运行免费 Qwen | 安装 Ollama 并运行 `ollama pull qwen3:4b`，开启 Ollama 服务。选择「本机服务 · Ollama Qwen」。`OLLAMA_MODEL` 可指定另一已安装的本地 Qwen 模型。仅请求固定回环地址。 |
| DeepSeek | 将 `DEEPSEEK_API_KEY` 放在服务器环境，默认 `deepseek-flash`。`DEEPSEEK_MODEL` 可改用账号支持的模型。 |
| 通义千问 | 将 `DASHSCOPE_API_KEY` 放在服务器环境，默认使用北京兼容接口和 `qwen-plus`。`DASHSCOPE_MODEL` 可选账号支持的模型，`DASHSCOPE_BASE_URL` 可填百炼控制台所列兼容接口。 |

本机使用者可把非公开环境文件保存在仓库目录之外，使用 Node 20.6 以上的 `node --env-file=/path/to/private.env server/ai-relay/ai-local-v3.mjs` 启动。[Ollama chat](https://docs.ollama.com/api/chat) · [Qwen 模型](https://ollama.com/library/qwen3:4b) · [百炼兼容接口](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) · [DeepSeek 多轮接口](https://api-docs.deepseek.com/guides/multi_round_chat/)

## 在自有 HTTPS 站点启用登录

设置 `ATLAS_AI_ORIGIN=https://你的域名` 及至少 16 字符的高随机 `ATLAS_AI_PASSWORD`，用自己的 TLS 反向代理把网页和 `/api/ai/` 一起转发至回环端口。可用 `PORT` 调整监听端口。服务保留 Host 与 Origin 校验。页面会显示服务端模式和登录入口。口令验证后使用 HttpOnly、SameSite=Strict 的会话 cookie，HTTPS 环境附带 Secure。普通登录最长四小时，选择保持登录后最长七天，退出或重启服务会使对应会话失效。此配置适合站点运营者本人或单个试点账户。公开商业多用户场景可替换为已有的同源用户认证、分用户预算和账单存储。

- `POST /api/ai/login` 接收 password 和 remember。
- `POST /api/ai/chat` 接收 provider、question、history、packet。未附书目时 packet 为 null。
- `POST /api/ai/logout` 退出。旧版 `POST /api/ai/analysis` 继续提供 DeepSeek 单次解读。
- 接入已有后台时，页面初始化前设置 `window.AtlasAIConfig={authenticatedRelay:true}`。
- 服务端一次处理一个生成请求，公网部署需根据运营方的配额配置个人和组织限额。GitHub Pages 公共站提供浏览器本地模式和个人 API 模式；服务端登录、共享配额和组织账本由自有后端管理。


若托管平台已经提供登录，可在同源页面初始化时配置 authenticatedRelay、platformAuth、allowRelayKey 及 operatorProviders（已启用站点额度的模型列表）。前端使用平台登录入口，个人 Key 只随用户确认的本次请求经同源后端转发。服务端必须验证平台会话和来源，并避免记录 Authorization 字段。
