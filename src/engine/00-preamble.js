/* 网约车物语 V3 - 游戏引擎 (reducer + 工具 + 任务系统) */
(function () {
  const D = window.WYCWY_DATA;
  const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, TRAININGS, EVENTS, FIRST_NAMES, MISSIONS, ENDINGS, PLAYER_STORIES, INVESTOR_PRESSURE, POLICY_EVENTS, INVESTOR_REVIEW, RARITY_STAT_CAPS, RARITY_LOYALTY_RULES, UI_GATES } = D;

  let driverIdCounter = 100;
  let vehicleIdCounter = 100;
  let orderOfferIdCounter = 0;
  let logIdCounter = 0;
  let actionHistoryIdCounter = 0;
  let decisionHistoryIdCounter = 0;

  // 工具
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (v, min, max) => Math.max(min, Math.min(max, v));
  // V14.11: 属性砍到 2(driving + service)。driving 决定高端订单准入和收益,service 决定好评率。
  const sumStats = (s) => s.driving + s.service;
  const STAT_KEYS = ['driving', 'service'];
  const DEFAULT_LOYALTY_RULES = {
    N: { id: 'N', initialMin: 75, initialMax: 85, normalCap: 100, quitBelow: 25, moralePenalty: 4 },
    R: { id: 'R', initialMin: 60, initialMax: 75, normalCap: 95, quitBelow: 30, moralePenalty: 4 },
    SR: { id: 'SR', initialMin: 50, initialMax: 65, normalCap: 90, quitBelow: 35, moralePenalty: 6 },
    SSR: { id: 'SSR', initialMin: 40, initialMax: 55, normalCap: 85, quitBelow: 40, moralePenalty: 8 },
  };
  const START_DAY = 1;
  const START_HOUR = 6;
  const DEBT_RESTRUCTURE_FEE_RATE = 0.05;
  const DEBT_RESTRUCTURE_MIN_DAYS = 14;
  const DEBT_RESTRUCTURE_MAX_DAYS = 60;
  const SNOW_RESCUE_EVENT_ID = 'snow_night_breakthrough';
