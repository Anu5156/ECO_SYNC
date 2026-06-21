/**
 * @file app.test.js
 * @description EcoSync Jest Test Suite — Comprehensive Coverage.
 *
 * Validates:
 *  - Carbon math accuracy across all calculation categories
 *  - XP / levelling curve progression (single and multi level-up)
 *  - Badge unlock logic for all 7 badge types
 *  - Activity logging — valid and invalid inputs
 *  - Goal setting and progress calculation
 *  - Challenge lifecycle: accept, abandon, complete, re-take
 *  - Quiz scoring — normal, perfect, edge cases
 *  - State persistence — save, load, clear
 *  - Security guards — NaN, Infinity, negative, oversized values
 *  - Emission factor constants — structural integrity
 */

import { CarbonCalculator, EMISSION_FACTORS, UNIT_CONVERSIONS } from '../js/calculator.js';
import { Tracker, ECO_ACTIVITIES, BADGES } from '../js/tracker.js';
import { ChallengeManager, CHALLENGES } from '../js/challenges.js';
import { QuizManager, QUIZ_QUESTIONS } from '../js/quiz.js';

// ---------------------------------------------------------------------------
// localStorage mock (Node.js has no browser APIs)
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
    clear:      ()           => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ---------------------------------------------------------------------------
// 1. Carbon Calculator — emission math
// ---------------------------------------------------------------------------

describe('CarbonCalculator — transport emissions', () => {
  test('car (gasoline, metric): 100 km/wk × 52 × 0.192 = 998.4 kg/yr', () => {
    const inputs = { carDistance: 100, carFuelType: 'gasoline', publicDistance: 0, shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBeCloseTo(998.4, 2);
  });

  test('car (electric, imperial): 100 mi/wk × 1.60934 × 52 × 0.047 ≈ 393.32 kg/yr', () => {
    const inputs = { carDistance: 100, carFuelType: 'electric', publicDistance: 0, shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'imperial')).toBeCloseTo(393.322, 2);
  });

  test('public transport (bus, metric): 50 km/wk × 52 × 0.089 = 231.4 kg/yr', () => {
    const inputs = { carDistance: 0, publicDistance: 50, publicType: 'bus', shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBeCloseTo(231.4, 2);
  });

  test('flights: 2 short + 1 long = 2×800×0.254 + 1×5000×0.195 = 1381.4 kg/yr', () => {
    const inputs = { carDistance: 0, publicDistance: 0, shortFlights: 2, longFlights: 1 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBeCloseTo(1381.4, 2);
  });

  test('all-zero transport inputs return 0 kg', () => {
    const inputs = { carDistance: 0, publicDistance: 0, shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBe(0);
  });

  test('unknown fuel type falls back to gasoline factor', () => {
    const known   = CarbonCalculator.calculateTransport({ carDistance: 100, carFuelType: 'gasoline', publicDistance: 0, shortFlights: 0, longFlights: 0 });
    const unknown = CarbonCalculator.calculateTransport({ carDistance: 100, carFuelType: 'unknownFuel', publicDistance: 0, shortFlights: 0, longFlights: 0 });
    expect(unknown).toBeCloseTo(known, 5);
  });
});

describe('CarbonCalculator — home energy emissions', () => {
  test('household of 2: (300×12×0.385 + 400×12×0.181) / 2 = 1127.4 kg/yr', () => {
    const inputs = { householdSize: 2, electricityKwh: 300, heatingKwh: 400, heatingType: 'gas' };
    expect(CarbonCalculator.calculateHomeEnergy(inputs)).toBeCloseTo(1127.4, 2);
  });

  test('household size of 0 is treated as 1 (no division by zero)', () => {
    const inputs = { householdSize: 0, electricityKwh: 100, heatingKwh: 0, heatingType: 'gas' };
    const singlePerson = CarbonCalculator.calculateHomeEnergy({ householdSize: 1, electricityKwh: 100, heatingKwh: 0, heatingType: 'gas' });
    expect(CarbonCalculator.calculateHomeEnergy(inputs)).toBeCloseTo(singlePerson, 5);
  });

  test('electric heating uses electricity emission factor', () => {
    const inputs = { householdSize: 1, electricityKwh: 0, heatingKwh: 100, heatingType: 'electricity' };
    expect(CarbonCalculator.calculateHomeEnergy(inputs)).toBeCloseTo(100 * 12 * EMISSION_FACTORS.electricity, 2);
  });
});

describe('CarbonCalculator — food emissions', () => {
  test('vegan diet returns 800 kg/yr', () => {
    expect(CarbonCalculator.calculateFood({ dietType: 'vegan' })).toBe(800);
  });

  test('heavyMeat diet returns 2900 kg/yr', () => {
    expect(CarbonCalculator.calculateFood({ dietType: 'heavyMeat' })).toBe(2900);
  });

  test('unknown diet type falls back to averageMeat (2000 kg/yr)', () => {
    expect(CarbonCalculator.calculateFood({ dietType: 'unknownDiet' })).toBe(2000);
  });
});

describe('CarbonCalculator — consumption emissions', () => {
  test('low shopping, 50% recycling: 400 × (1 − 0.20×0.5) = 360 kg/yr', () => {
    expect(CarbonCalculator.calculateConsumption({ shoppingLevel: 'low', recyclingRate: 50 })).toBeCloseTo(360, 5);
  });

  test('recycling rate capped at 100% max reduction (0.8 factor)', () => {
    const capped = CarbonCalculator.calculateConsumption({ shoppingLevel: 'low', recyclingRate: 999 });
    const exact  = CarbonCalculator.calculateConsumption({ shoppingLevel: 'low', recyclingRate: 100 });
    expect(capped).toBeCloseTo(exact, 5);
  });

  test('high shopping, no recycling: 2200 × 1.0 = 2200 kg/yr', () => {
    expect(CarbonCalculator.calculateConsumption({ shoppingLevel: 'high', recyclingRate: 0 })).toBe(2200);
  });
});

describe('CarbonCalculator — full footprint calculation', () => {
  test('breakdown totals match totalKg', () => {
    const inputs = {
      transport:   { carDistance: 50, carFuelType: 'gasoline' },
      energy:      { householdSize: 1, electricityKwh: 100, heatingKwh: 0 },
      food:        { dietType: 'vegan' },
      consumption: { shoppingLevel: 'low', recyclingRate: 50 }
    };
    const fp = CarbonCalculator.calculateFootprint(inputs, 'metric');
    const summedBreakdown = fp.breakdown.transport + fp.breakdown.energy + fp.breakdown.food + fp.breakdown.consumption;
    // summedBreakdown uses rounded values, totalKg is exact — allow small rounding gap
    expect(Math.abs(summedBreakdown - fp.totalKg)).toBeLessThan(4);
  });

  test('shares sum to 100% (allowing floating-point margin)', () => {
    const inputs = {
      transport:   { carDistance: 100, carFuelType: 'diesel' },
      energy:      { householdSize: 2, electricityKwh: 200, heatingKwh: 150, heatingType: 'gas' },
      food:        { dietType: 'averageMeat' },
      consumption: { shoppingLevel: 'average', recyclingRate: 25 }
    };
    const { shares } = CarbonCalculator.calculateFootprint(inputs, 'metric');
    const total = shares.transport + shares.energy + shares.food + shares.consumption;
    expect(total).toBeCloseTo(100, 5);
  });

  test('comparisons.status is "low" for footprint under 2 tons', () => {
    const inputs = {
      transport:   { carDistance: 0, publicDistance: 10, publicType: 'train' },
      energy:      { householdSize: 4, electricityKwh: 100, heatingKwh: 50, heatingType: 'biomass' },
      food:        { dietType: 'vegan' },
      consumption: { shoppingLevel: 'low', recyclingRate: 100 }
    };
    const fp = CarbonCalculator.calculateFootprint(inputs, 'metric');
    expect(fp.comparisons.status).toBe('low');
  });

  test('comparisons.status is "high" for footprint over 4 tons', () => {
    const inputs = {
      transport:   { carDistance: 500, carFuelType: 'gasoline', shortFlights: 5, longFlights: 3 },
      energy:      { householdSize: 1, electricityKwh: 1000, heatingKwh: 1000, heatingType: 'oil' },
      food:        { dietType: 'heavyMeat' },
      consumption: { shoppingLevel: 'high', recyclingRate: 0 }
    };
    const fp = CarbonCalculator.calculateFootprint(inputs, 'metric');
    expect(fp.comparisons.status).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 2. Tracker — state, XP, badges
// ---------------------------------------------------------------------------

describe('Tracker — state persistence', () => {
  beforeEach(() => localStorage.clear());

  test('loadState() returns correct defaults on first load', () => {
    const state = Tracker.loadState();
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.totalCarbonSaved).toBe(0);
    expect(state.badges).toHaveLength(0);
    expect(state.dailyLogs).toHaveLength(0);
    expect(state.acceptedChallenges).toHaveLength(0);
    expect(state.completedChallenges).toHaveLength(0);
    expect(state.quizAttempts).toHaveLength(0);
    expect(state.goal).toBeNull();
  });

  test('saveState() persists and loadState() retrieves correctly', () => {
    const state = Tracker.loadState();
    state.xp = 75;
    state.level = 2;
    Tracker.saveState(state);
    const reloaded = Tracker.loadState();
    expect(reloaded.xp).toBe(75);
    expect(reloaded.level).toBe(2);
  });

  test('clearState() wipes storage and returns fresh defaults', () => {
    const state = Tracker.loadState();
    state.xp = 500;
    Tracker.saveState(state);
    const fresh = Tracker.clearState();
    expect(fresh.xp).toBe(0);
    expect(fresh.level).toBe(1);
  });
});

describe('Tracker — XP and levelling', () => {
  beforeEach(() => localStorage.clear());

  test('addXP: no level-up when XP stays below threshold', () => {
    const state = Tracker.loadState();
    const res = Tracker.addXP(state, 80);
    expect(res.state.xp).toBe(80);
    expect(res.state.level).toBe(1);
    expect(res.leveledUp).toBe(false);
  });

  test('addXP: level-up with correct XP carry-over', () => {
    const state = Tracker.loadState();
    const res = Tracker.addXP(state, 110); // level 1 needs 100; carry over 10
    expect(res.state.level).toBe(2);
    expect(res.state.xp).toBe(10);
    expect(res.leveledUp).toBe(true);
  });

  test('addXP: multiple level-ups in one call are handled correctly', () => {
    const state = Tracker.loadState();
    // L1 needs 100, L2 needs 200, L3 needs 300 — add 310 to jump L1→L2→L3
    const res = Tracker.addXP(state, 310);
    expect(res.state.level).toBe(3);
    expect(res.state.xp).toBe(10); // 310 - 100 - 200 = 10
    expect(res.leveledUp).toBe(true);
  });

  test('addXP: exactly hitting threshold advances level with 0 carry-over XP', () => {
    const state = Tracker.loadState();
    const res = Tracker.addXP(state, 100);
    expect(res.state.level).toBe(2);
    expect(res.state.xp).toBe(0);
  });
});

describe('Tracker — badge unlocking', () => {
  beforeEach(() => localStorage.clear());

  test('first_step badge unlocked after footprintResult is set', () => {
    const state = Tracker.loadState();
    state.footprintResult = { totalKg: 3000, totalTons: 3 };
    const unlocked = Tracker.checkBadges(state);
    expect(unlocked).toContain('first_step');
    expect(state.badges).toContain('first_step');
  });

  test('level_5 badge unlocked at level 5', () => {
    const state = Tracker.loadState();
    state.level = 5;
    Tracker.checkBadges(state);
    expect(state.badges).toContain('level_5');
  });

  test('level_10 badge unlocked at level 10', () => {
    const state = Tracker.loadState();
    state.level = 10;
    Tracker.checkBadges(state);
    expect(state.badges).toContain('level_10');
  });

  test('saver_50 badge unlocked after saving 50 kg CO2', () => {
    const state = Tracker.loadState();
    state.totalCarbonSaved = 50;
    Tracker.checkBadges(state);
    expect(state.badges).toContain('saver_50');
  });

  test('saver_200 badge unlocked after saving 200 kg CO2', () => {
    const state = Tracker.loadState();
    state.totalCarbonSaved = 201;
    Tracker.checkBadges(state);
    expect(state.badges).toContain('saver_200');
  });

  test('challenge_master badge unlocked after 5 completed challenges', () => {
    const state = Tracker.loadState();
    state.completedChallenges = ['a', 'b', 'c', 'd', 'e'];
    Tracker.checkBadges(state);
    expect(state.badges).toContain('challenge_master');
  });

  test('quiz_genius badge unlocked after perfect quiz score', () => {
    const state = Tracker.loadState();
    state.quizAttempts = [{ date: '2025-01-01', score: 5, total: 5 }];
    Tracker.checkBadges(state);
    expect(state.badges).toContain('quiz_genius');
  });

  test('badge is not awarded twice for the same milestone', () => {
    const state = Tracker.loadState();
    state.level = 5;
    Tracker.checkBadges(state);
    Tracker.checkBadges(state); // second call should not duplicate
    const count = state.badges.filter(b => b === 'level_5').length;
    expect(count).toBe(1);
  });
});

describe('Tracker — activity logging', () => {
  beforeEach(() => localStorage.clear());

  test('logs valid activity and calculates correct CO2 and XP', () => {
    const res = Tracker.logActivity('walk_cycle', 10);
    expect(res.carbonSaved).toBeCloseTo(10 * ECO_ACTIVITIES.walk_cycle.co2SavedPerUnit, 5);
    expect(res.pointsEarned).toBe(Math.round(10 * ECO_ACTIVITIES.walk_cycle.xpAward));
  });

  test('log entry is persisted in dailyLogs', () => {
    Tracker.logActivity('meat_free_meal', 3);
    const state = Tracker.loadState();
    expect(state.dailyLogs).toHaveLength(1);
    expect(state.dailyLogs[0].activityId).toBe('meat_free_meal');
  });

  test('totalCarbonSaved accumulates across multiple log entries', () => {
    Tracker.logActivity('walk_cycle', 5);
    Tracker.logActivity('recycle_waste', 2);
    const state = Tracker.loadState();
    const expected =
      5 * ECO_ACTIVITIES.walk_cycle.co2SavedPerUnit +
      2 * ECO_ACTIVITIES.recycle_waste.co2SavedPerUnit;
    expect(state.totalCarbonSaved).toBeCloseTo(expected, 5);
  });

  test('throws for unknown activity ID', () => {
    expect(() => Tracker.logActivity('nonexistent_activity', 10)).toThrow();
  });
});

describe('Tracker — goal management', () => {
  beforeEach(() => localStorage.clear());

  test('setGoal throws if no footprint result exists', () => {
    expect(() => Tracker.setGoal(20)).toThrow();
  });

  test('setGoal stores target correctly at 20% reduction', () => {
    const state = Tracker.loadState();
    state.footprintResult = { totalKg: 5000, totalTons: 5 };
    Tracker.saveState(state);
    Tracker.setGoal(20);
    const updated = Tracker.loadState();
    expect(updated.goal.targetPercent).toBe(20);
    expect(updated.goal.targetFootprintKg).toBeCloseTo(4000, 5); // 5000 × 0.8
  });

  test('getGoalProgress returns null when no goal is active', () => {
    expect(Tracker.getGoalProgress()).toBeNull();
  });

  test('getGoalProgress calculates progress percentage correctly', () => {
    const state = Tracker.loadState();
    state.footprintResult = { totalKg: 4000, totalTons: 4 };
    state.goal = { targetPercent: 25, targetFootprintKg: 3000, startDate: '2025-01-01' };
    state.totalCarbonSaved = 500; // 500/1000 target reduction = 50%
    Tracker.saveState(state);
    const progress = Tracker.getGoalProgress();
    expect(progress.progressPercent).toBe(50);
    expect(progress.targetReductionKg).toBe(1000);
  });

  test('getGoalProgress caps progress at 100%', () => {
    const state = Tracker.loadState();
    state.footprintResult = { totalKg: 2000, totalTons: 2 };
    state.goal = { targetPercent: 10, targetFootprintKg: 1800, startDate: '2025-01-01' };
    state.totalCarbonSaved = 9999; // Way over target
    Tracker.saveState(state);
    const progress = Tracker.getGoalProgress();
    expect(progress.progressPercent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 3. Challenge Manager
// ---------------------------------------------------------------------------

describe('ChallengeManager — challenge lifecycle', () => {
  beforeEach(() => localStorage.clear());

  test('getAll() returns all 9 defined challenges', () => {
    expect(ChallengeManager.getAll()).toHaveLength(9);
  });

  test('getById() returns correct challenge object', () => {
    const chal = ChallengeManager.getById('meatless_day');
    expect(chal).toBeDefined();
    expect(chal.title).toBe('Veggie Power');
  });

  test('getById() returns undefined for unknown ID', () => {
    expect(ChallengeManager.getById('not_real')).toBeUndefined();
  });

  test('acceptChallenge adds challenge to acceptedChallenges', () => {
    const state = ChallengeManager.acceptChallenge('cold_wash');
    expect(state.acceptedChallenges).toContain('cold_wash');
  });

  test('acceptChallenge is idempotent — no duplicate entries', () => {
    ChallengeManager.acceptChallenge('cold_wash');
    const state = ChallengeManager.acceptChallenge('cold_wash');
    expect(state.acceptedChallenges.filter(id => id === 'cold_wash')).toHaveLength(1);
  });

  test('abandonChallenge removes challenge from acceptedChallenges', () => {
    ChallengeManager.acceptChallenge('meatless_day');
    const state = ChallengeManager.abandonChallenge('meatless_day');
    expect(state.acceptedChallenges).not.toContain('meatless_day');
  });

  test('completeChallenge moves challenge from accepted to completed', () => {
    ChallengeManager.acceptChallenge('meatless_day');
    ChallengeManager.completeChallenge('meatless_day');
    const state = Tracker.loadState();
    expect(state.completedChallenges).toContain('meatless_day');
    expect(state.acceptedChallenges).not.toContain('meatless_day');
  });

  test('completeChallenge awards correct CO2 credits and XP', () => {
    const chal = ChallengeManager.getById('meatless_day'); // 4 kg, 50 XP
    ChallengeManager.acceptChallenge(chal.id);
    const result = ChallengeManager.completeChallenge(chal.id);
    expect(result.co2Saved).toBe(chal.co2Saved);
    expect(result.xpReward).toBe(chal.xpReward);
    expect(Tracker.loadState().totalCarbonSaved).toBe(chal.co2Saved);
  });

  test('re-taking a completed challenge removes it from completed first', () => {
    ChallengeManager.acceptChallenge('cold_wash');
    ChallengeManager.completeChallenge('cold_wash');
    ChallengeManager.acceptChallenge('cold_wash'); // re-take
    const state = Tracker.loadState();
    expect(state.completedChallenges).not.toContain('cold_wash');
    expect(state.acceptedChallenges).toContain('cold_wash');
  });

  test('acceptChallenge throws for unknown challenge ID', () => {
    expect(() => ChallengeManager.acceptChallenge('ghost_challenge')).toThrow();
  });

  test('completeChallenge throws for unknown challenge ID', () => {
    expect(() => ChallengeManager.completeChallenge('ghost_challenge')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Quiz Manager
// ---------------------------------------------------------------------------

describe('QuizManager — quiz session and scoring', () => {
  beforeEach(() => localStorage.clear());

  test('getRandomQuiz returns correct number of questions', () => {
    expect(QuizManager.getRandomQuiz(4)).toHaveLength(4);
    expect(QuizManager.getRandomQuiz(1)).toHaveLength(1);
  });

  test('getRandomQuiz caps at question bank size', () => {
    expect(QuizManager.getRandomQuiz(9999).length).toBeLessThanOrEqual(QUIZ_QUESTIONS.length);
  });

  test('questions include all required fields', () => {
    const q = QuizManager.getRandomQuiz(1)[0];
    expect(q).toHaveProperty('id');
    expect(q).toHaveProperty('question');
    expect(q).toHaveProperty('options');
    expect(q).toHaveProperty('correctAnswerIndex');
    expect(q).toHaveProperty('explanation');
  });

  test('recordAttempt: normal score awards XP = score × 20', () => {
    const res = QuizManager.recordAttempt(3, 5);
    expect(res.xpEarned).toBe(60);
    expect(res.isPerfect).toBe(false);
  });

  test('recordAttempt: perfect score awards XP = score × 20 + 50 bonus', () => {
    const res = QuizManager.recordAttempt(5, 5);
    expect(res.xpEarned).toBe(150);
    expect(res.isPerfect).toBe(true);
  });

  test('recordAttempt: zero score awards 0 XP with no perfect flag', () => {
    const res = QuizManager.recordAttempt(0, 5);
    expect(res.xpEarned).toBe(0);
    expect(res.isPerfect).toBe(false);
  });

  test('recordAttempt persists attempt to quizAttempts array', () => {
    QuizManager.recordAttempt(4, 5);
    const state = Tracker.loadState();
    expect(state.quizAttempts).toHaveLength(1);
    expect(state.quizAttempts[0].score).toBe(4);
    expect(state.quizAttempts[0].total).toBe(5);
  });

  test('multiple quiz attempts are all stored', () => {
    QuizManager.recordAttempt(3, 5);
    QuizManager.recordAttempt(5, 5);
    const state = Tracker.loadState();
    expect(state.quizAttempts).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Security — input validation and data integrity
// ---------------------------------------------------------------------------

describe('Security — input validation and sanitisation', () => {
  beforeEach(() => localStorage.clear());

  test('CarbonCalculator: string input falls back to 0 (no NaN propagation)', () => {
    const inputs = { carDistance: 'hello', publicDistance: 0, shortFlights: 0, longFlights: 0 };
    const result = CarbonCalculator.calculateTransport(inputs, 'metric');
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('CarbonCalculator: negative distance falls back to 0', () => {
    const inputs = { carDistance: -500, publicDistance: 0, shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBe(0);
  });

  test('CarbonCalculator: Infinity input is rejected and treated as 0', () => {
    const inputs = { carDistance: Infinity, publicDistance: 0, shortFlights: 0, longFlights: 0 };
    expect(CarbonCalculator.calculateTransport(inputs, 'metric')).toBe(0);
  });

  test('CarbonCalculator: oversized recycling rate is capped, result remains finite', () => {
    const result = CarbonCalculator.calculateConsumption({ shoppingLevel: 'high', recyclingRate: 1e10 });
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  test('full footprint with mixed invalid inputs produces a finite, non-negative total', () => {
    const inputs = {
      transport:   { carDistance: 'bad', publicDistance: -50, shortFlights: Infinity, longFlights: 2 },
      energy:      { householdSize: 0, electricityKwh: '300abc', heatingKwh: -200 },
      food:        { dietType: 'vegan' },
      consumption: { shoppingLevel: 'low', recyclingRate: 150 }
    };
    const fp = CarbonCalculator.calculateFootprint(inputs, 'metric');
    // longFlights: 2×5000×0.195=1950 + elec: 300×12×0.385=1386 + food: 800 + cons: 400×0.8=320 = 4456
    expect(fp.totalKg).toBeCloseTo(4456, 1);
    expect(Number.isFinite(fp.totalKg)).toBe(true);
  });

  test('Tracker.logActivity: NaN amount returns zero result, state unchanged', () => {
    const res = Tracker.logActivity('walk_cycle', NaN);
    expect(res.pointsEarned).toBe(0);
    expect(res.carbonSaved).toBe(0);
    expect(Tracker.loadState().dailyLogs).toHaveLength(0);
  });

  test('Tracker.logActivity: negative amount returns zero result, state unchanged', () => {
    const res = Tracker.logActivity('walk_cycle', -10);
    expect(res.pointsEarned).toBe(0);
    expect(Tracker.loadState().totalCarbonSaved).toBe(0);
  });

  test('Tracker.logActivity: Infinity amount returns zero result, state unchanged', () => {
    const res = Tracker.logActivity('recycle_waste', Infinity);
    expect(res.carbonSaved).toBe(0);
    expect(Tracker.loadState().xp).toBe(0);
  });

  test('Tracker.logActivity: zero amount returns zero result, state unchanged', () => {
    const res = Tracker.logActivity('walk_cycle', 0);
    expect(res.pointsEarned).toBe(0);
    expect(Tracker.loadState().dailyLogs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Emission factor constants — structural integrity
// ---------------------------------------------------------------------------

describe('EMISSION_FACTORS constant integrity', () => {
  test('all car fuel type factors are positive numbers', () => {
    Object.values(EMISSION_FACTORS.car).forEach(v => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    });
  });

  test('all heating type factors are positive numbers', () => {
    Object.values(EMISSION_FACTORS.heating).forEach(v => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    });
  });

  test('all diet emission values are positive numbers', () => {
    Object.values(EMISSION_FACTORS.diet).forEach(v => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    });
  });

  test('UNIT_CONVERSIONS.mileToKm equals 1.60934', () => {
    expect(UNIT_CONVERSIONS.mileToKm).toBeCloseTo(1.60934, 5);
  });

  test('BADGES array contains exactly 7 badge definitions', () => {
    expect(BADGES).toHaveLength(7);
  });

  test('every badge has id, name, desc, and icon fields', () => {
    BADGES.forEach(badge => {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('desc');
      expect(badge).toHaveProperty('icon');
    });
  });

  test('every challenge has required fields with correct types', () => {
    CHALLENGES.forEach(chal => {
      expect(typeof chal.id).toBe('string');
      expect(typeof chal.title).toBe('string');
      expect(typeof chal.co2Saved).toBe('number');
      expect(typeof chal.xpReward).toBe('number');
      expect(['easy', 'medium', 'hard']).toContain(chal.tier);
    });
  });
});
