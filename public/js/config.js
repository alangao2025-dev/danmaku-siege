// 全局配置：画面尺寸、阵营、兵种、礼物
export const W = 1280, H = 720;
export const HORIZON = 300;                 // 地平线
export const GROUND_TOP = 345, GROUND_BOTTOM = 672; // 单位可活动的纵深范围
export const CASTLE_BASE = 590;             // 城堡底部 y
export const CASTLE_X = { red: 112, blue: 1168 };
export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC","WenQuanYi Zen Hei",sans-serif';

export const INTRO_TIME = 5, ROUND_TIME = 180, FINAL_TIME = 30, OVER_TIME = 12;
export const CASTLE_HP = 8000;
export const SIEGE_MUL = 5;               // 单位打城堡的伤害倍数
export const RAGE_TIME = 6, RAGE_CD = 14;  // 666 士气：持续 / 冷却
export const MAX_SMALL_UNITS = 120;         // 每队普通兵上限（礼物召唤不受限）
export const ENERGY_MAX = 100;

export const TEAMS = {
  red:  { name: '赤焰军', short: '红方', key: '1', dir: 1,  main: '#ff4848', light: '#ffa27a', dark: '#8c1426', deep: '#3e0812', rgb: '255,90,50',  gold: '#ffcf5a' },
  blue: { name: '苍蓝军', short: '蓝方', key: '2', dir: -1, main: '#3f8cff', light: '#9ad8ff', dark: '#163c86', deep: '#08183a', rgb: '70,160,255', gold: '#ffe08a' },
};
export const ENEMY = { red: 'blue', blue: 'red' };

// size：屏幕上的大致高度（像素，纵深缩放前）
export const UNITS = {
  sword:  { name: '剑士',   hp: 60,   atk: 9,  cd: 0.85, spd: 60, range: 16,  size: 34, r: 8,  kind: 'melee',    bounty: 2 },
  archer: { name: '弓手',   hp: 40,   atk: 8,  cd: 1.3,  spd: 54, range: 200, size: 33, r: 8,  kind: 'arrow',    bounty: 2 },
  mage:   { name: '法师',   hp: 38,   atk: 13, cd: 1.9,  spd: 50, range: 170, size: 34, r: 8,  kind: 'fireball', bounty: 2, splash: 34 },
  knight: { name: '骑士',   hp: 360,  atk: 26, cd: 0.9,  spd: 86, range: 22,  size: 56, r: 16, kind: 'melee',    bounty: 10 },
  golem:  { name: '石巨人', hp: 1500, atk: 60, cd: 1.7,  spd: 32, range: 34,  size: 92, r: 28, kind: 'slam',     bounty: 40, splash: 78 },
  dragon: { name: '巨龙',   hp: 3200, atk: 20, cd: 0.12, spd: 44, range: 210, size: 120, r: 30, kind: 'breath',  bounty: 120, fly: 120 },
};
export const CLASS_BY_WORD = { '剑': 'sword', '弓': 'archer', '法': 'mage' };

export const GIFTS = {
  '小心心': { unit: null,     n: 3, score: 1,   energy: 1,  label: '援军×3' },
  '玫瑰':   { unit: 'knight', n: 1, score: 5,   energy: 3,  label: '骑士' },
  '甜甜圈': { unit: 'golem',  n: 1, score: 52,  energy: 10, label: '石巨人' },
  '火箭':   { unit: 'dragon', n: 1, score: 520, energy: 30, label: '巨龙' },
};

export const depthScale = y => 0.74 + 0.36 * (y - GROUND_TOP) / (GROUND_BOTTOM - GROUND_TOP);
export const castleFront = team => CASTLE_X[team] + TEAMS[team].dir * 98;
