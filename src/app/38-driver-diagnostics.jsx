function getNextOrderUnlock(stat, currentValue) {
  const thresholds = ORDERS
    .filter((o) => o.req && o.req[stat])
    .map((o) => ({ at: o.req[stat], name: o.name }))
    .sort((a, b) => a.at - b.at);
  return thresholds.find((th) => currentValue < th.at) || null;
}

function getStatOrderLinks(stat, currentValue, vehicleData) {
  return ORDERS
    .filter((o) => o.req && o.req[stat])
    .sort((a, b) => a.req[stat] - b.req[stat])
    .map((order) => {
      const need = order.req[stat];
      const missing = Math.max(0, need - currentValue);
      const vehicleReady = vehicleData ? vehicleData.eligible.includes(order.id) : false;
      let state = 'missing';
      let label = `差${missing}`;
      if (missing <= 0 && vehicleReady) {
        state = 'ready';
        label = '可跑';
      } else if (missing <= 0 && vehicleData && !vehicleReady) {
        state = 'vehicle';
        label = '需换车';
      } else if (missing <= 0 && !vehicleData) {
        state = 'vehicle';
        label = '需配车';
      }
      return { order, state, label };
    });
}

function getStatTrainHint(stat, currentValue, vehicleData, goodRate) {
  if (stat === 'service') {
    return `当前好评率约 ${goodRate}%,好评会涨城市口碑,口碑高才有更多好单`;
  }
  // V14.67: 从 ORDERS.req 动态推导门槛,避免数值后台改门槛后提示撒谎。
  const thresholds = ORDERS
    .filter((o) => o.req && typeof o.req[stat] === 'number')
    .sort((a, b) => a.req[stat] - b.req[stat]);
  if (stat === 'driving') {
    const airport = thresholds.find((o) => o.id === 'airport') || thresholds[0];
    const luxury = thresholds.find((o) => o.id === 'luxury') || thresholds[thresholds.length - 1];
    if (airport && currentValue < airport.req[stat]) {
      return `车技到 ${airport.req[stat]} 可接专车订单,到 ${luxury.req[stat]} 可接豪华车订单`;
    }
    if (luxury && currentValue < luxury.req[stat]) {
      return `专车订单已能接,车技到 ${luxury.req[stat]} 可接豪华车订单`;
    }
    return '高价订单门槛已达,继续练能提高专车和豪华车收入';
  }
  const reqHints = thresholds.map((o) => `${o.name}需${getDriverStatLabel(stat)}${o.req[stat]}`);
  return reqHints.length > 0 ? reqHints.join(',') : '提升此属性可解锁更高级订单';
}

function getTrainingCost(training, currentValue) {
  return E.getTrainingCost ? E.getTrainingCost(training, currentValue) : training.cost;
}

function getOrderMissingText(order, driver) {
  const missing = Object.entries(order.req || {})
    .map(([key, value]) => {
      const current = driver.stats?.[key] || 0;
      const gap = Math.max(0, value - current);
      if (gap <= 0) return null;
      return `${key === 'driving' ? '车技' : '服务'}${gap}`;
    })
    .filter(Boolean);
  return missing.join('、');
}

function getOrderShortName(order) {
  return (order?.name || '订单').replace(/订单$/, '');
}

function getOrderOpportunityDiagnosis(reputation) {
  if (reputation >= 520) {
    return { key: 'opportunity', label: '订单机会', state: '很多', tone: 'strong', hint: '高价片区更活跃,好单更多' };
  }
  if (reputation >= 180) {
    return { key: 'opportunity', label: '订单机会', state: '正常', tone: 'normal', hint: '订单够用,继续稳住好评' };
  }
  if (reputation >= 90) {
    return { key: 'opportunity', label: '订单机会', state: '正常', tone: 'normal', hint: '基础片区有单,攒口碑开新区' };
  }
  return { key: 'opportunity', label: '订单机会', state: '偏少', tone: 'warn', hint: '口碑还低,先稳完单和服务' };
}

function getDriverWillingnessDiagnosis(driver) {
  const loyalty = driver.loyalty ?? 50;
  const bonus = driver.orderRateBonus || 1;
  const bonusText = bonus > 1 ? `,自带人气加成` : '';
  if (loyalty >= 80) {
    return { key: 'willingness', label: '接单意愿', state: '很高', tone: 'strong', hint: `忠诚高,愿意多接单${bonusText}` };
  }
  if (loyalty >= 50) {
    return { key: 'willingness', label: '接单意愿', state: '正常', tone: 'normal', hint: `忠诚正常,不用急着调薪${bonusText}` };
  }
  if (loyalty >= 30) {
    return { key: 'willingness', label: '接单意愿', state: '偏低', tone: 'warn', hint: `忠诚偏低,可能少接单,建议加薪${bonusText}` };
  }
  return { key: 'willingness', label: '接单意愿', state: '危险', tone: 'danger', hint: '忠诚危险,少接单且有离职风险' };
}

function getOrderAbilityDiagnosis(driver, vehicleData) {
  if (!vehicleData) {
    return { key: 'ability', label: '可接订单', state: '未配车', tone: 'danger', hint: '先分配车辆,司机才能出车' };
  }
  const vehicleOrders = ORDERS.filter((order) => vehicleData.eligible.includes(order.id));
  const readyOrders = vehicleOrders.filter((order) =>
    Object.entries(order.req || {}).every(([key, value]) => (driver.stats?.[key] || 0) >= value)
  );
  const lockedByStats = vehicleOrders.filter((order) => !readyOrders.includes(order));
  const bestReady = readyOrders.slice().sort((a, b) => b.fare - a.fare)[0];
  const nextLocked = lockedByStats.slice().sort((a, b) => a.fare - b.fare)[0];
  if (!bestReady) {
    const next = lockedByStats[0];
    return {
      key: 'ability',
      label: '可接订单',
      state: '受限',
      tone: 'warn',
      hint: next ? `${next.name}还差${getOrderMissingText(next, driver)}` : '这辆车暂时没合适的单',
    };
  }
  if (bestReady.id === 'luxury') {
    return { key: 'ability', label: '可接订单', state: getOrderShortName(bestReady), tone: 'strong', hint: '最高可跑豪华车订单' };
  }
  if (bestReady.id === 'airport') {
    return {
      key: 'ability',
      label: '可接订单',
      state: getOrderShortName(bestReady),
      tone: 'normal',
      hint: nextLocked ? `最高可跑专车,${getOrderShortName(nextLocked)}还差${getOrderMissingText(nextLocked, driver)}` : '最高可跑专车订单',
    };
  }
  return {
    key: 'ability',
    label: '可接订单',
    state: getOrderShortName(bestReady),
    tone: 'normal',
    hint: nextLocked ? `最高可跑${getOrderShortName(bestReady)},${getOrderShortName(nextLocked)}还差${getOrderMissingText(nextLocked, driver)}` : `最高可跑${bestReady.name}`,
  };
}

function getDriverOrderDiagnosis(driver, vehicleData, reputation) {
  return [
    getOrderOpportunityDiagnosis(reputation),
    getDriverWillingnessDiagnosis(driver),
    getOrderAbilityDiagnosis(driver, vehicleData),
  ];
}

// V15.17:canTrain 和 canRaiseSalary 控制车技/服务提升 + 按钮 / 忠诚行调薪 + 按钮的可见性
