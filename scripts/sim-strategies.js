/**
 * 网约车物语 V12 - 玩家策略模拟测试
 *
 * 跑 4 种典型玩家策略,各跑约 12 游戏日,
 * 通过 window.__WYCWY_TEST.dispatch 直接调用 reducer 模拟操作,
 * 采样关键指标曲线,输出 markdown 对比报告到 /tmp/wycwy-sim-report.md
 *
 * 用法:
 *   cd /Users/baozheng/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill
 *   node run.js /Users/baozheng/代码文件/网约车物语/scripts/sim-strategies.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'file:///Users/baozheng/%E4%BB%A3%E7%A0%81%E6%96%87%E4%BB%B6/%E7%BD%91%E7%BA%A6%E8%BD%A6%E7%89%A9%E8%AF%AD/%E7%BD%91%E7%BA%A6%E8%BD%A6%E7%89%A9%E8%AF%AD-V3.html';

// 4 种玩家策略(每条会在 day 维度的早晨执行一次)
const STRATEGIES = {
  '躺平': {
    desc: '点开始,不操作',
    onDay: () => null,
  },
  '疯狂招人': {
    desc: '前 4 天每天用普通券招 1 人 + 自动配车,不练服务',
    onDay: (day) => (day >= 1 && day <= 4) ? [{ type: 'recruit' }, { type: 'autoAssign' }] : null,
  },
  '服务流': {
    desc: '前 5 天每天把所有司机服务训到 30',
    onDay: (day) => (day >= 1 && day <= 5) ? [{ type: 'trainAllToTarget', stat: 'service', target: 30 }] : null,
  },
  '平衡推进': {
    desc: 'D1 训练服务 / D2 招人 / D3 训练服务 / D4 买凯美瑞 / D5 招人',
    onDay: (day) => {
      if (day === 1) return [{ type: 'trainAllToTarget', stat: 'service', target: 30 }];
      if (day === 2) return [{ type: 'recruit' }, { type: 'autoAssign' }];
      if (day === 3) return [{ type: 'trainAllToTarget', stat: 'service', target: 30 }];
      if (day === 4) return [{ type: 'buy', templateId: 'camry' }, { type: 'autoAssign' }];
      if (day === 5) return [{ type: 'recruit' }, { type: 'autoAssign' }];
      return null;
    },
  },
};

// 单步 dispatch,每次都 wait 让 React rerender 后再读 state
async function dispatchOnce(page, action) {
  await page.evaluate((a) => {
    const t = window.__WYCWY_TEST;
    if (t) t.dispatch(a);
  }, action);
  await page.waitForTimeout(120);
}
async function getState(page) {
  return await page.evaluate(() => {
    const t = window.__WYCWY_TEST;
    return t ? JSON.parse(JSON.stringify({
      funds: t.state.funds,
      drivers: t.state.drivers.map((d) => ({ id: d.id, vehicleId: d.vehicleId, stats: d.stats })),
      vehicles: t.state.vehicles.map((v) => ({ id: v.id, templateId: v.templateId })),
      gachaCards: t.state.gachaCards ? t.state.gachaCards.map((c) => ({ id: c.id })) : null,
    })) : null;
  });
}

// 高阶动作:每个内部多步 dispatch
async function actRecruit(page) {
  await dispatchOnce(page, { type: 'GACHA_START', ticketId: 'normal' });
  const s = await getState(page);
  if (s && s.gachaCards && s.gachaCards.length > 0) {
    await dispatchOnce(page, { type: 'GACHA_PICK', cardId: s.gachaCards[0].id });
  }
}

async function actAutoAssign(page) {
  const s = await getState(page);
  if (!s) return;
  const unassigned = s.drivers.find((d) => !d.vehicleId);
  if (!unassigned) return;
  const empty = s.vehicles.find((v) => !s.drivers.some((d) => d.vehicleId === v.id));
  if (empty) {
    await dispatchOnce(page, { type: 'ASSIGN_VEHICLE', driverId: unassigned.id, vehicleId: empty.id });
  } else if (s.funds >= 5000) {
    await dispatchOnce(page, { type: 'BUY_VEHICLE', templateId: 'santana' });
    const s2 = await getState(page);
    const newV = s2.vehicles[s2.vehicles.length - 1];
    await dispatchOnce(page, { type: 'ASSIGN_VEHICLE', driverId: unassigned.id, vehicleId: newV.id });
  }
}

async function actTrainAllToTarget(page, statId, target) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const s = await getState(page);
    if (!s) return;
    const needTrain = s.drivers.filter((d) => d.stats[statId] < target);
    if (needTrain.length === 0) return;
    if (s.funds < 600) return;
    // 每轮训练一个最低的司机
    const target_d = needTrain.sort((a, b) => a.stats[statId] - b.stats[statId])[0];
    await dispatchOnce(page, { type: 'TRAIN', driverId: target_d.id, trainingId: statId });
  }
}

async function actBuyVehicle(page, templateId) {
  await dispatchOnce(page, { type: 'BUY_VEHICLE', templateId });
}

async function applyActions(page, actions) {
  if (!actions || actions.length === 0) return;
  for (const a of actions) {
    if (a.type === 'recruit') await actRecruit(page);
    else if (a.type === 'autoAssign') await actAutoAssign(page);
    else if (a.type === 'trainAllToTarget') await actTrainAllToTarget(page, a.stat, a.target);
    else if (a.type === 'buy') await actBuyVehicle(page, a.templateId);
  }
}

async function runStrategy(name, strat) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror:`, e.message));

  await page.goto(URL);
  await page.waitForSelector('button.coach-next', { timeout: 15000 });
  // 跳教程
  for (let i = 0; i < 4; i++) {
    await page.click('button.coach-next');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);

  // 启动 8×
  await page.click('button.speed-btn.play-toggle');
  await page.waitForTimeout(400);
  await page.click('text=8×');

  const samples = [];
  let lastDay = 0;
  // 跑 60 秒(8× 速度下 ≈ 8 游戏日,加 boost 可能更多)
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const sample = await page.evaluate(() => {
      const t = window.__WYCWY_TEST;
      if (!t) return {};
      const s = t.state;
      return {
        day: s.day,
        hour: s.hour,
        funds: s.funds,
        rep: s.reputation,
        crews: s.drivers.filter((d) => d.vehicleId).length,
        drivers: s.drivers.length,
        vehicles: s.vehicles.length,
        todayLost: s.todayLost,
        todayRepLoss: s.todayRepLoss,
        yesterdayLost: s.yesterdayLost,
        avgService: s.drivers.length > 0 ? Math.round(s.drivers.reduce((sum, d) => sum + (d.stats.service || 0), 0) / s.drivers.length) : 0,
        paused: s.paused,
        gameOver: !!s.gameOver,
        unlockedZones: (s.zoneLockSnapshot && Object.keys(s.zoneLockSnapshot).filter((k) => s.zoneLockSnapshot[k]).length) || 0,
      };
    });

    // 跨日触发当日动作
    if (sample.day && sample.day !== lastDay) {
      const actions = strat.onDay(sample.day);
      if (actions && actions.length > 0) {
        // 暂停 → 执行动作 → 恢复 8×
        await page.evaluate(() => {
          const t = window.__WYCWY_TEST;
          if (t && !t.state.paused) t.dispatch({ type: 'TOGGLE_PAUSE' });
        });
        await applyActions(page, actions);
        await page.evaluate(() => {
          const t = window.__WYCWY_TEST;
          if (t && t.state.paused) t.dispatch({ type: 'SET_SPEED', speed: 8 });
        });
      }
      lastDay = sample.day;
    }

    samples.push(sample);
    if (sample.gameOver) {
      console.log(`  ! ${name} game over at day ${sample.day}`);
      break;
    }
  }

  // 导出诊断 JSON
  const diagnostics = await page.evaluate(() => {
    const t = window.__WYCWY_TEST;
    if (!t) return null;
    return t.state.diagnostics || [];
  });

  await browser.close();
  return { name, desc: strat.desc, samples, diagnostics };
}

(async () => {
  const results = [];
  for (const [name, strat] of Object.entries(STRATEGIES)) {
    console.log(`\n========== 策略: ${name} ==========`);
    console.log(strat.desc);
    const result = await runStrategy(name, strat);
    results.push(result);
    const last = result.samples[result.samples.length - 1] || {};
    const first = result.samples[0] || {};
    console.log(`  开局 → day ${first.day} hr ${first.hour} rep=${first.rep} funds=${first.funds} crews=${first.crews}`);
    console.log(`  收尾 → day ${last.day} hr ${last.hour} rep=${last.rep} funds=${last.funds} crews=${last.crews} drivers=${last.drivers} avgSvc=${last.avgService}`);
  }

  // 写 markdown 报告
  let md = `# 网约车物语 V12 玩家策略模拟报告\n\n`;
  md += `**生成时间**: ${new Date().toISOString()}\n\n`;
  md += `每个策略 8× 速度跑 60 秒,模拟 8-10 游戏日。\n\n---\n\n`;

  // 速读对比
  md += `## 速读对比\n\n`;
  md += `| 策略 | 终局日 | 终局口碑 | 终局资金 | 车组数 | 司机数 | 平均服务 | 总流失(估) |\n`;
  md += `|------|--------|----------|----------|--------|--------|----------|-------------|\n`;
  for (const r of results) {
    const last = r.samples[r.samples.length - 1] || {};
    // 估算总流失:把每天 yesterdayLost 加起来(粗略)
    const totalLost = r.diagnostics.reduce((sum, d) => sum + (d.lostCount || 0), 0);
    md += `| ${r.name} | ${last.day || '-'} | ${last.rep ?? '-'} | ¥${last.funds ?? '-'} | ${last.crews ?? '-'} | ${last.drivers ?? '-'} | ${last.avgService ?? '-'} | ${totalLost} |\n`;
  }
  md += `\n---\n\n`;

  // 每个策略详细
  for (const r of results) {
    md += `## ${r.name}\n\n${r.desc}\n\n`;
    md += `| t (s) | 日 | 时 | 资金 | 口碑 | 车组 | 司机 | 平均服务 | 今日流失 |\n`;
    md += `|-------|----|----|------|------|------|------|----------|----------|\n`;
    r.samples.forEach((s, i) => {
      md += `| ${(i + 1) * 2} | ${s.day || ''} | ${s.hour || ''} | ¥${s.funds || ''} | ${s.rep || ''} | ${s.crews || ''} | ${s.drivers || ''} | ${s.avgService || 0} | ${s.todayLost || 0} |\n`;
    });
    md += `\n`;
  }

  // 关键观察
  md += `---\n\n## 自动观察\n\n`;
  for (const r of results) {
    const last = r.samples[r.samples.length - 1] || {};
    const issues = [];
    if (last.rep != null && last.rep < 50) issues.push('口碑跌破开局值,经营恶化');
    if (last.gameOver) issues.push('破产 game over');
    const totalLost = r.diagnostics.reduce((sum, d) => sum + (d.lostCount || 0), 0);
    if (totalLost > 50) issues.push(`总流失 ${totalLost} 单偏高`);
    if (last.crews && last.drivers && last.crews < last.drivers) issues.push(`${last.drivers - last.crews} 名司机未配车`);
    md += `- **${r.name}**: ${issues.length > 0 ? issues.join(' / ') : '无明显异常'}\n`;
  }

  fs.writeFileSync('/tmp/wycwy-sim-report.md', md);
  console.log(`\n\n✓ 报告已写入 /tmp/wycwy-sim-report.md`);
})();
