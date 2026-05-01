import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const htmlPath = resolve(root, '网约车物语-V3.html');
const cssPath = resolve(root, 'src/styles.css');
const cssPartsDir = resolve(root, 'src/styles');
const appPath = resolve(root, 'src/app.jsx');
const legacyAppPath = resolve(root, 'wycwy-app.js');
const appPartsDir = resolve(root, 'src/app');

// V12+ 守护:HTML 已经直接维护 React 源(包含 V12+ 新组件如 UnlockRoadmapModal、hud-axis、ts-rep-sub 等),
// src/app/*.jsx 已停止同步,直接重建会回滚机制级改动。
// 如要恢复 src/app 工作流,先把 HTML 内嵌副本同步到 src/app 后再删除此守护。
if (process.env.WYCWY_FORCE_BUILD !== '1') {
  console.error([
    '[build-html.mjs] aborted: src/app/*.jsx 已停止维护(V11/V12/V13 改动只在 HTML 内嵌副本).',
    '直接 build 会用旧版本覆盖当前 HTML,导致以下机制丢失:',
    '  - V12 半订单池 / 流失 / 反锁 / UnlockRoadmapModal / hud-axis / ts-rep-sub',
    '  - V12.2 诊断导出按钮',
    '  - V13 车型/订单压缩文案',
    '',
    '若确认要重建(已先把 HTML 同步到 src/app),请用 WYCWY_FORCE_BUILD=1 node scripts/build-html.mjs',
  ].join('\n'));
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const css = readdirSync(cssPartsDir)
  .filter((name) => name.endsWith('.css'))
  .sort()
  .map((name) => readFileSync(resolve(cssPartsDir, name), 'utf8').trimEnd())
  .join('\n\n');
const app = readdirSync(appPartsDir)
  .filter((name) => name.endsWith('.jsx'))
  .sort()
  .map((name) => readFileSync(resolve(appPartsDir, name), 'utf8').trimEnd())
  .join('\n\n');

writeFileSync(cssPath, css + '\n');
writeFileSync(appPath, app + '\n');
writeFileSync(legacyAppPath, app + '\n');

const styleRe = /<style>\n[\s\S]*?\n<\/style>/;
const appRe = /<script type="text\/babel">\n[\s\S]*?\n<\/script>\n\n<\/body>/;

if (!styleRe.test(html) || !appRe.test(html)) {
  throw new Error('未找到可替换的 <style> 或 <script type="text/babel"> 区块');
}

const next = html
  .replace(styleRe, `<style>\n${css}\n</style>`)
  .replace(appRe, `<script type="text/babel">\n${app}\n</script>\n\n</body>`);

writeFileSync(htmlPath, next);
console.log('已从 src/styles.css 和 src/app.jsx 重建 网约车物语-V3.html');
