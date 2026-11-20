# Google Scholar 作者主页服务

网站支持直接导入 Scholar 导出的 BibTeX 和 CSV。在线读取公开作者主页时，可用本机服务通过 SerpApi 请求该主页的论文。每次点击读取一页会使用服务提供方的额度，重复请求在本机缓存一小时。请在环境变量中配置个人密钥。

在安装 Node.js 20 或以上版本的电脑运行以下 PowerShell 命令。

```powershell
$env:SERPAPI_KEY = Read-Host "SerpApi key" -MaskInput
node server/scholar-relay/server.mjs
```

网站的 Scholar 服务地址填写 `http://127.0.0.1:8791/scholar`。浏览器若询问本地网络权限，仅在本人运行服务时允许。默认只接受来自公开网站的浏览器请求。自托管网页可在 `ATLAS_ORIGIN` 中指定完整来源。密钥始终保留在服务进程中。
