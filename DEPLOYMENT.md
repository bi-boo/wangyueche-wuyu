# 网约车物语 — 线上部署记录

> 记录日期: 2026-05-17
> 目的: 换电脑或后续迭代时,能快速找到线上位置、同步命令、AI 复盘代理和重复部署排查方式。

---

## 当前线上位置

**主站域名**: `yuanfengai.cn` / `www.yuanfengai.cn`

**服务器 SSH 别名**: `nextype`

本机 `~/.ssh/config` 参考:

```sshconfig
Host nextype
      HostName 43.143.241.154
      User ubuntu
      IdentityFile ~/.ssh/nextype.pem
```

**nginx 站点根目录**:

```bash
/var/www/nextype-website
```

**本项目线上目录**:

```bash
/var/www/nextype-website/didichuxing/baozheng/wycwy
```

**访问地址**:

```text
https://yuanfengai.cn/didichuxing/baozheng/wycwy/
https://yuanfengai.cn/didichuxing/baozheng/wycwy/网约车物语-V3.html
```

线上目录里额外放了一个 `index.html`,内容复制自 `网约车物语-V3.html`,方便直接访问目录 URL。

---

## 部署方式

本项目主体仍是静态游戏,但 V15.36 起新增 AI 运营复盘,线上需要一个只暴露 `/api/run-analysis` 的 Node 代理服务。静态资源仍同步到 nginx 目录,模型密钥只放服务器环境变量。

V15.41 起主入口已做并发进场优化:`网约车物语-V3.html` 加载 `dist/` 里的预构建 CSS/JS 和 `vendor/` 里的 React production UMD,不再让每个玩家浏览器下载 Babel 并现场编译 `src/app/*.jsx`。部署前必须先构建入口资源。

从本地项目根目录执行:

```bash
cd "/Users/baozheng/代码文件/网约车物语"

node scripts/build-entry-assets.mjs
node scripts/smoke-server.mjs

ssh nextype 'sudo mkdir -p /var/www/nextype-website/didichuxing/baozheng/wycwy && sudo chown -R ubuntu:ubuntu /var/www/nextype-website/didichuxing/baozheng/wycwy'

rsync -avz --delete \
  --exclude='.DS_Store' \
  --exclude='tmp/' \
  --exclude='archive/' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  ./ nextype:/var/www/nextype-website/didichuxing/baozheng/wycwy/

ssh nextype 'cp /var/www/nextype-website/didichuxing/baozheng/wycwy/网约车物语-V3.html /var/www/nextype-website/didichuxing/baozheng/wycwy/index.html && sudo chown -R www-data:www-data /var/www/nextype-website/didichuxing/baozheng/wycwy && sudo find /var/www/nextype-website/didichuxing/baozheng/wycwy -type d -exec chmod 755 {} \; && sudo find /var/www/nextype-website/didichuxing/baozheng/wycwy -type f -exec chmod 644 {} \;'
```

说明:

- `--delete` 会让线上目录严格等于本地目录。执行前确认目标目录就是本项目目录,不要指到站点根目录。
- `dist/` 和 `vendor/` 必须上传,它们是主入口实际加载的资源。
- `node scripts/smoke-server.mjs` 会用临时榜单文件启动本地服务,检查主入口、API 精确路由、路径逃逸、AI 超时兜底、榜单并发写入、重复提交和异常局跳榜。
- `tmp/`、`archive/`、`.git/` 不上传,避免把本地临时文件和历史快照带到线上。
- `admin.html` 会同步到线上,用于数值调参预览。若后续不想公开,部署命令里加 `--exclude='admin.html'`。

### AI 复盘代理

线上服务使用 PM2 管理,进程名:

```text
wycwy-ai-review
```

服务启动命令从 `/etc/wycwy-ai-review.env` 读取环境变量,再启动:

```bash
PORT=8877 node scripts/ai-review-server.mjs
```

必要环境变量:

```bash
WYCWY_AI_API_KEY=你的火山方舟 API Key
WYCWY_AI_MODEL=doubao-seed-2-0-lite-260428
WYCWY_AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/responses
```

榜单数据默认写入 PM2 用户的数据目录:

```text
/home/ubuntu/.local/share/wycwy/leaderboard.jsonl
```

如果要迁移位置,在 `/etc/wycwy-ai-review.env` 增加:

```bash
WYCWY_LEADERBOARD_FILE=/path/to/leaderboard.jsonl
```

nginx 只需要把子路径 API 反代给本机 Node:

```nginx
location /didichuxing/baozheng/wycwy/api/ {
    proxy_pass http://127.0.0.1:8877/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

静态入口资源已在 `nextype` 的 nginx server block 中加压缩和缓存:

```nginx
# WYCWY static entry optimization
gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

location ~* ^/didichuxing/baozheng/wycwy/(dist|vendor|assets)/ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable";
    try_files $uri =404;
}

location ~* ^/didichuxing/baozheng/wycwy/(wycwy-data|wycwy-engine)\.js$ {
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
    try_files $uri =404;
}
```

前端默认请求相对路径 `api/run-analysis`,所以本地 `http://localhost:8877/网约车物语-V3.html` 和线上子目录部署都能走同一套代码。

---

## 部署后验证

```bash
curl -I -L --max-time 15 https://yuanfengai.cn/didichuxing/baozheng/wycwy/
curl -I -L --max-time 15 https://yuanfengai.cn/didichuxing/baozheng/wycwy/wycwy-data.js
curl -I -L --max-time 15 https://yuanfengai.cn/didichuxing/baozheng/wycwy/dist/wycwy-app.bundle.js
curl -I -L --max-time 15 https://yuanfengai.cn/didichuxing/baozheng/wycwy/vendor/react-18.3.1.production.min.js
curl -sS -X POST https://yuanfengai.cn/didichuxing/baozheng/wycwy/api/run-analysis -H 'Content-Type: application/json' --data '{"payload":{"schemaVersion":"wycwy-ai-review-v1","gameResult":{"type":"lose"},"valueProfile":{"axes":[]},"keyDecisions":[]}}'
curl -sS https://yuanfengai.cn/didichuxing/baozheng/wycwy/api/leaderboard?sort=score
```

期望:

- 主页面返回 `200 OK`
- `wycwy-data.js` 返回 `200 OK`
- `dist/wycwy-app.bundle.js` 和 `vendor/react-18.3.1.production.min.js` 返回 `200 OK`
- AI 复盘接口返回 `source:"ai"` 表示模型已生效;返回 `source:"local"` 表示代理可用但密钥未配置或上游临时失败,前端会展示本地简评兜底
- 榜单接口返回 `ok:true` 和 `entries` 数组;没有人入榜时数组为空

注意:若页面白屏,优先检查 `dist/wycwy-app.bundle.js` 是否已由最新 `src/app/*.jsx` 构建,再看浏览器控制台错误。

---

## 避免重复部署

部署前先在 `yuanfengai.cn` 服务器上查是否已有旧目录:

```bash
ssh nextype 'sudo find /var/www /opt /home/ubuntu -type f \( -name "网约车物语-V3.html" -o -name "wycwy-data.js" -o -name "wycwy-engine.js" -o -name "admin.html" \) -print 2>/dev/null | sort'

ssh nextype 'sudo grep -RIl "网约车物语\|WYCWY_DATA\|wycwy-data\|wycwy-engine\|Kairosoft\|开罗" /var/www /opt /home/ubuntu 2>/dev/null | sort'
```

2026-05-15 排查结果:

- `yuanfengai.cn` 服务器上只找到当前目录: `/var/www/nextype-website/didichuxing/baozheng/wycwy`
- nginx 配置里没有其它网约车物语路由
- PM2 进程里没有本项目,因为本项目是纯静态部署
- `levelupupup.com` / `openclaw` 服务器也查过,没有本项目旧部署

如果未来发现另一个旧目录,先确认哪个 URL 是对外使用的 canonical,再决定保留或删除,不要直接覆盖站点根目录。

---

## 相关服务器盘点

### yuanfengai.cn

```text
SSH: nextype
IP: 43.143.241.154
nginx root: /var/www/nextype-website
当前项目路径: /var/www/nextype-website/didichuxing/baozheng/wycwy
```

`nginx` 当前主要路由:

- `/` 静态站点
- `/vote/` 代理到 `127.0.0.1:3210`
- `/didichuxing/baozheng/ai-intent/` 代理到 `127.0.0.1:3220`
- `/didichuxing/baozheng/ai-intent2/` 静态原型
- `/didichuxing/baozheng/wycwy/` 本项目静态目录

### levelupupup.com

```text
SSH: openclaw
IP: 150.109.15.88
nginx root: /opt/levelup/frontend/dist
PM2: levelup
```

2026-05-15 已查:没有 `网约车物语` / `WYCWY_DATA` / `wycwy-data.js` / `wycwy-engine.js` 命中。不要把本项目部署到这里,除非明确要迁移到 `levelupupup.com`。

---

## 回滚 / 删除当前部署

如果确认当前 `wycwy` 目录是不需要的重复部署,删除命令是:

```bash
ssh nextype 'sudo rm -rf /var/www/nextype-website/didichuxing/baozheng/wycwy'
```

删除前务必确认没有人正在使用:

```bash
curl -I -L --max-time 15 https://yuanfengai.cn/didichuxing/baozheng/wycwy/
```
