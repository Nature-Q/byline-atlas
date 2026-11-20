# 本机 DeepSeek 解读

公网工作台的「AI 论文解读」可使用个人 DeepSeek API Key。每次点击生成会发送预览中的书目，再显示模型返回的 token 用量。浏览器无法连接 DeepSeek 时，可在本机运行以下服务。

1. 下载整个网站仓库，安装 Node.js 20 或更新版。
2. 在私有环境文件中设置 `DEEPSEEK_API_KEY=你的密钥`，例如使用位于仓库外的 `byline-local.env`。也可以通过自己的凭据管理工具为当前进程设定环境变量。
3. 在项目根目录运行 `node --env-file=/path/to/byline-local.env server/ai-relay/ai-local-v3.mjs`（Node.js 20.6+）。已经设定环境变量时，运行 `node server/ai-relay/ai-local-v3.mjs`。
4. 打开 <http://127.0.0.1:8775>，选择档案，进入「AI 论文解读」，核对预览后再生成。同源服务端会使用环境变量中的密钥。首次使用本机站点需重新选择或导入档案。

本机入口限当前计算机使用，每次处理一个请求。DeepSeek 按其 [官方价格](https://api-docs.deepseek.com/quick_start/pricing/) 计费。API 用量取自供应商返回的数据。停止等待时，已传出的请求可能仍被计费。

## 为托管网站扩展账户

前端预留同源的 `POST /api/ai/analysis`，部署自己的登录与计费服务后可通过 `window.AtlasAIConfig = { authenticatedRelay: true }` 启用。请求采用当前站点的会话 Cookie，仅接收预览所示的书目对象；返回的 JSON 包含 `choices[0].message.content` 和供应商 `usage`。公共后端负责验证用户会话与请求来源、核对额度、记录实际用量、处理请求幂等与并发。GitHub Pages 的静态版本采用访客自带密钥，本机服务面向个人使用。登录和跨设备余额需由运营方另行部署。
