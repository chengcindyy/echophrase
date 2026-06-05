# EchoPhrase 部署指南

讓手機透過 HTTPS 使用 PWA（錄音、TTS、發音評分）。

## 前置條件

1. **AWS 帳號**（免費方案即可，低流量接近 $0）
2. **已安裝**：Node 22+、pnpm、AWS CLI、SAM CLI
3. **`.env`** 已設定 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`

## 第一次：設定 AWS 憑證

在 PowerShell 執行（擇一）：

```powershell
aws configure
# 輸入 Access Key ID、Secret、預設 region（建議 us-west-2，與 samconfig 一致）
```

或使用 AWS SSO：

```powershell
aws login
```

驗證：

```powershell
aws sts get-caller-identity
```

## 一鍵部署

在專案根目錄：

```powershell
pnpm deploy:aws
```

腳本會自動：

1. 打包 API（含 Linux ffmpeg）
2. `sam deploy` 建立 Lambda + API Gateway + S3 + CloudFront
3. 建置前端（API 走同網域 `/api/*`，無需另設 URL）
4. 上傳 `web/dist` 到 S3
5. 清除 CloudFront 快取

完成後終端會印出 **App URL**（CloudFront 網址）。

## 手機使用

1. 用手機瀏覽器開啟 **App URL**
2. **加入主畫面**（iOS：分享 → 加入主畫面）
3. 設定頁 → **測試 API 連線** 應顯示正常
4. 詞庫：電腦 **匯出 CSV** → 傳到手機 → **匯入 CSV**

## 架構

```
手機瀏覽器 (HTTPS)
    └── CloudFront
            ├── /*     → S3（Vue PWA）
            └── /api/* → API Gateway → Lambda（Azure Speech）
```

詞庫仍存各裝置 localStorage；跨裝置請用 CSV 匯出／匯入。

## 常見問題

| 問題 | 處理 |
|------|------|
| `Unable to locate credentials` | 執行 `aws configure` |
| 錄音／評分失敗 | 確認用 **HTTPS** 的 CloudFront 網址，不要用 localhost |
| API 502 | 查看 CloudWatch Logs（Lambda 函式名稱含 Assess/Tts） |
| 更新程式後 | 再執行 `pnpm deploy:aws` |

## 僅更新前端

若只改 web、API 不變，可手動：

```powershell
$env:VITE_API_BASE_URL = ""
pnpm build:web
aws s3 sync web/dist s3://<WebBucketName> --delete
```

Bucket 名稱見 CloudFormation 輸出 `WebBucketName`。
