# ToonWorld 官方网站

漫画 App「ToonWorld」的官网。纯静态站点（无构建步骤），支持 **日语 / 繁体中文 / 英语**，
并内置一个客服中心，可提交产品建议、退款申请与取消订阅。

## 功能

- **多语言**：日本語、繁體中文、English。首次访问按浏览器语言（`navigator.languages`）自动匹配，
  用户可随时在导航栏手动切换，选择会记住（`localStorage`）。也支持用 `?lang=ja` 这类链接直接指定。
- **深色 / 浅色主题**：默认跟随系统 `prefers-color-scheme`，可手动切换并记住选择。
- **客服中心**（`support.html`）：四个标签页，可用 `#suggestion` / `#refund` / `#cancel` / `#contact` 直接跳转。
  - 产品建议：分类、主题、详细说明，截图选填。
  - 退款申请：**必须**填写邮箱并附上付款账单截图。
  - 取消订阅：**必须**填写邮箱并附上付款账单截图，并需确认续订条款。
  - 提交后生成受理编号（如 `TW-RF-20260816-K3P9M`），可复制摘要、下载副本、用邮件客户端发送。
- 表单在浏览器内完成校验（必填、邮箱格式、金额、附件类型 / 大小 / 数量），错误提示同样是三语的。
- 响应式，键盘可操作，`prefers-reduced-motion` 下关闭动画。

## 目录结构

```
index.html          首页
support.html        客服中心
privacy.html        隐私政策
terms.html          服务条款
404.html            GitHub Pages 的 404 页
assets/
  css/style.css     全部样式（浅色为默认，深色通过 media query + [data-theme] 覆盖）
  js/
    config.js       站点配置：提交接口、附件限制、商店链接
    i18n.js         语言检测、切换与文案绑定
    i18n/en.js      英语词条
    i18n/ja.js      日语词条
    i18n/zh-Hant.js 繁体中文词条
    main.js         主题、导航、语言菜单、首页与法务页内容渲染
    support.js      标签页、上传、校验、提交、本地记录
  img/favicon.svg
.github/workflows/deploy.yml   GitHub Pages 部署
```

## 表单提交怎么走

GitHub Pages 只能托管静态文件，没有后端，所以 `assets/js/config.js` 里的
`supportEndpoint` 决定提交行为：

| `supportEndpoint` | 行为 |
| --- | --- |
| `""`（默认） | **离线模式**。在浏览器内生成受理编号、可复制的摘要、可下载的 `.txt`，以及已填好内容的 `mailto:` 链接（截图需用户在邮件里手动附上）。数据不会自动外发。 |
| `"https://…"` | 表单以 `multipart/form-data` POST 到该地址，**截图一并上传**（字段名 `screenshot1`…）。Formspree、Web3Forms、Cloudflare Worker 或自建 API 都可以。 |

接上真实接口只需改一行：

```js
// assets/js/config.js
supportEndpoint: "https://formspree.io/f/xxxxxxxx",
```

接口失败时会自动回落到离线模式，用户填的内容不会丢。

其他可配置项：`maxFileSizeMB`（默认 8）、`maxFiles`（默认 3）、`acceptedTypes`、
`iosUrl` / `androidUrl`（上线时换成真实商店链接）、`keepLocalHistory`。

## 本地预览

需要用 HTTP 服务打开（直接双击 `file://` 打开会受浏览器限制影响）：

```bash
npx http-server -p 8080 -c-1
# 然后访问 http://127.0.0.1:8080
```

想测试某种语言，可以加 `?lang=ja`、`?lang=zh-Hant`、`?lang=en`，
或直接改浏览器的语言偏好看自动识别效果。

## 部署到 GitHub Pages

已包含 `.github/workflows/deploy.yml`，推送到 `main` 或本功能分支即自动部署。

首次部署前需要在仓库里开启 Pages：
**Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

之后每次推送都会自动发布，地址为 `https://<用户名>.github.io/toonworld/`。
换自定义域名的话，在仓库根目录加一个 `CNAME` 文件，并同步更新 `robots.txt`、`sitemap.xml` 里的地址。

## 加一种新语言

1. 复制 `assets/js/i18n/en.js`，改成新的语言代码，翻译所有词条。
2. 在每个 HTML 的 `<head>` 里加上对应的 `<script defer src="assets/js/i18n/xx.js">`。
3. 在 `assets/js/i18n.js` 中把语言代码加入 `SUPPORTED`，并在 `normalize()` 里加上匹配规则。

语言菜单会自动读取词条里的 `_meta.native` 生成选项，不需要改 HTML。

## 说明

站内的作品名、数据（12,000+ 作品、3,800 万话等）、邮箱地址与商店链接均为示例内容，
上线前请替换为真实信息。
