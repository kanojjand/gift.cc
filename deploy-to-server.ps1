# Выкладка gift.cclab.kz на домашний сервер (из любой сети при включённом Tailscale, PowerShell, из папки flowers):
#   powershell -ExecutionPolicy Bypass -File .\deploy-to-server.ps1
# Делает бэкап текущей версии на сервере, заливает src/public/raiko и пересобирает контейнер flowers.
$ErrorActionPreference = 'Stop'
$key = "$env:USERPROFILE\.ssh\rclab_server"
$server = 'kanojjand@100.92.251.70'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$archive = Join-Path $env:TEMP "flowers-$stamp.tgz"

tar -czf $archive src public raiko package.json package-lock.json Dockerfile
ssh -i $key $server "cd ~/apps && tar -czf flowers-backup-$stamp.tgz flowers/src flowers/public flowers/raiko"
scp -i $key $archive "${server}:~/apps/flowers-new.tgz"
ssh -i $key $server "cd ~/apps/flowers && tar -xzf ../flowers-new.tgz && rm ../flowers-new.tgz && docker compose up -d --build && docker ps --filter name=flowers --format '{{.Names}} {{.Status}}'"
Remove-Item $archive
Write-Host "Готово: https://gift.cclab.kz и https://gift.cclab.kz/pitch (бэкап: ~/apps/flowers-backup-$stamp.tgz)"
