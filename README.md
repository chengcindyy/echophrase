# EchoPhrase

法語發音練習 PWA（Vue 3 + AWS Lambda + Azure Speech）。

## 功能

- 詞庫 / 標籤 CRUD（localStorage）
- CSV 詞庫匯入 / 匯出
- 隨機、按標籤、錯題練習
- 直接念 / 先聽再念
- Azure TTS + 發音評估（音素級）
- iPhone：TTS 背景預載，點 🔊 即可播放
- 錄音僅用於評分，比對後不保留

## 本地開發

### 1. 安裝

```bash
pnpm install
```

### 2. 設定 Azure

複製 `.env.example` 為 `.env` 並填入：

```
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=eastus
VITE_API_BASE_URL=http://localhost:3001
```

### 3. 啟動 API（終端 1）

```bash
pnpm --filter @echophrase/api dev
```

### 4. 啟動前端（終端 2）

```bash
pnpm dev
```

開啟 http://localhost:5173

## 部署到 AWS

在專案根目錄設定 `.env`（含 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`），然後：

```powershell
# 首次全量部署（SAM + S3 + CloudFront）
pnpm deploy:aws

# 之後只更新前端或 API
pnpm deploy:web
pnpm deploy:api
```

生產環境 API 走同網域 `/api/*`（CloudFront 代理），不需設定 `VITE_API_BASE_URL`。

詳見 `docs/DEPLOY.md`。

## 專案結構

```
echophrase/
├── web/          Vue 3 PWA
├── api/          Lambda handlers + 本地 dev server
└── infra/        AWS SAM template
```

## 之後 Phase 2

- 練習歷史
- Supabase 多裝置同步
