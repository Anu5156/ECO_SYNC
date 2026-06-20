/**
 * EcoSync Jest Test Suite
 * Tests math calculators, leveling curve progression, and logger states.
 */

import { CarbonCalculator, EMISSION_FACTORS } from '../js/calculator.js';
import { Tracker, ECO_ACTIVITIES } from '../js/tracker.js';
import { ChallengeManager } from '../js/challenges.js';
import { QuizManager } from '../js/quiz.js';

// Mock localStorage for Node test runner
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('EcoSync Carbon Calculator Module', () => {
  test('calculates car transportation emissions accurately (Metric)', () => {
    const inputs = {
      carDistance: 100, // 100 km per week
      carFuelType: 'gasoline', // 0.192 factor
      publicDistance: 0,
      shortFlights: 0,
      longFlights: 0
    };
    // Annual: 100 km * 52 weeks * 0.192 kg CO2/km = 998.4 kg
    const result = CarbonCalculator.calculateTransport(inputs, 'metric');
    expect(result).toBeCloseTo(998.4, 2);
  });

  test('calculates car transportation emissions accurately (Imperial)', () => {
    const inputs = {
      carDistance: 100, // 100 miles per week
      carFuelType: 'electric', // 0.047 factor
      publicDistance: 0,
      shortFlights: 0,
      longFlights: 0
    };
    // Annual: 100 mi * 1.60934 km/mi * 52 weeks * 0.047 kg CO2/km = 393.322 kg
    const result = CarbonCalculator.calculateTransport(inputs, 'imperial');
    expect(result).toBeCloseTo(393.322, 2);
  });

  test('calculates home energy shared among household members', () => {
    const inputs = {
      householdSize: 2,
      electricityKwh: 300, // 300 kWh per month
      heatingKwh: 400, // 400 kWh per month
      heatingType: 'gas' // 0.181 factor
    };
    // Electricity annual: 300 * 12 * 0.385 = 1386 kg
    // Heating annual: 400 * 12 * 0.181 = 868.8 kg
    // Total for household: 2254.8 kg
    // Divided by 2 members: 1127.4 kg per person
    const result = CarbonCalculator.calculateHomeEnergy(inputs);
    expect(result).toBeCloseTo(1127.4, 2);
  });

  test('calculates full carbon footprint breakdown', () => {
    const inputs = {
      transport: { carDistance: 50, carFuelType: 'gasoline' },
      energy: { householdSize: 1, electricityKwh: 100, heatingKwh: 0 },
      food: { dietType: 'vegan' }, // 800 kg
      consumption: { shoppingLevel: 'low', recyclingRate: 50 } // 400 * (1 - 0.2 * 0.5) = 360 kg
    };
    const footprint = CarbonCalculator.calculateFootprint(inputs, 'metric');
    expect(footprint.breakdown.food).toBe(800);
    expect(footprint.breakdown.consumption).toBe(360);
    expect(footprint.totalKg).toBeGreaterThan(1160);
  });
});

describe('EcoSync State Tracker & Leveling Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('initializes default state when loaded first time', () => {
    const state = Tracker.loadState();
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.totalCarbonSaved).toBe(0);
    expect(state.dailyLogs).toHaveLength(0);
  });

  test('calculates XP additions and handles single and multi level-ups correctly', () => {
    let state = Tracker.loadState();
    
    // Level 1: needs 1 * 100 = 100 XP to reach Level 2
    let res = Tracker.addXP(state, 80);
    expect(res.state.level).toBe(1);
    expect(res.state.xp).toBe(80);
    expect(res.leveledUp).toBe(false);

    // Add 30 more XP: total 110. Level up to 2 with 10 XP remaining
    res = Tracker.addXP(res.state, 30);
    expect(res.state.level).toBe(2);
    expect(res.state.xp).toBe(10);
    expect(res.leveledUp).toBe(true);

    // Level 2: needs 2 * 100 = 200 XP to reach Level 3
    // Level 3: needs 3 * 100 = 300 XP
    // Add 250 XP: total 260. Leads to Level 3 with 50 XP (since 10 + 250 = 260; level 2 consumes 200, remaining 60 XP. Need 300 for level 3)
    res = Tracker.addXP(res.state, 250);
    expect(res.state.level).toBe(3);
    expect(res.state.xp).toBe(60);
  });

  test('logs eco activity, saves carbon, and registers XP', () => {
    // Log walk_cycle for 10 km
    const res = Tracker.logActivity('walk_cycle', 10);
    expect(res.carbonSaved).toBeCloseTo(10 * ECO_ACTIVITIES.walk_cycle.co2SavedPerUnit);
    expect(res.pointsEarned).toBe(10 * ECO_ACTIVITIES.walk_cycle.xpAward);
    
    const savedState = Tracker.loadState();
    expect(savedState.totalCarbonSaved).toBeCloseTo(res.carbonSaved);
    expect(savedState.dailyLogs).toHaveLength(1);
  });
});

describe('EcoSync Gamified Challenges Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('manages active challenges state transitions', () => {
    const list = ChallengeManager.getAll();
    expect(list.length).toBeGreaterThan(0);

    const firstChal = list[0];
    
    // Accept
    let state = ChallengeManager.acceptChallenge(firstChal.id);
    expect(state.acceptedChallenges).toContain(firstChal.id);
    
    // Abandon
    state = ChallengeManager.abandonChallenge(firstChal.id);
    expect(state.acceptedChallenges).not.toContain(firstChal.id);
  });

  test('completes challenge, adds carbon offset and registers experience points', () => {
    const list = ChallengeManager.getAll();
    const target = list[1]; // Veggie Power: saves 4 kg CO2, +50 XP

    ChallengeManager.acceptChallenge(target.id);
    const completeRes = ChallengeManager.completeChallenge(target.id);

    expect(completeRes.co2Saved).toBe(target.co2Saved);
    expect(completeRes.xpReward).toBe(target.xpReward);

    const state = Tracker.loadState();
    expect(state.completedChallenges).toContain(target.id);
    expect(state.acceptedChallenges).not.toContain(target.id);
    expect(state.totalCarbonSaved).toBe(target.co2Saved);
  });
});

describe('EcoSync Quiz Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('generates random subsets of quiz questions', () => {
    const quiz = QuizManager.getRandomQuiz(4);
    expect(quiz).toHaveLength(4);
    expect(quiz[0]).toHaveProperty('question');
    expect(quiz[0]).toHaveProperty('options');
  });

  test('records quiz attempts and awards correct points including perfect score bonuses', () => {
    // Normal score: 3 / 5. Earns 3 * 20 = 60 XP
    let res = QuizManager.recordAttempt(3, 5);
    expect(res.xpEarned).toBe(60);
    expect(res.isPerfect).toBe(false);

    // Perfect score: 5 / 5. Earns 5 * 20 + 50 bonus = 150 XP
    res = QuizManager.recordAttempt(5, 5);
    expect(res.xpEarned).toBe(150);
    expect(res.isPerfect).toBe(true);
  });
});

describe('EcoSync Input Validation and Security Protections', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('CarbonCalculator handles NaN, negative numbers, and infinity gracefully', () => {
    const inputs = {
      transport: {
        carDistance: 'invalid-string',
        publicDistance: -50,
        shortFlights: Infinity,
        longFlights: 2
      },
      energy: {
        householdSize: 0, // Should fallback to at least 1 member
        electricityKwh: '300abc', // parseFloat gets 300
        heatingKwh: -200 // Should fallback to 0
      },
      food: { dietType: 'vegan' }, // 800 kg
      consumption: { shoppingLevel: 'low', recyclingRate: 150 } // Should cap recyclingRate at 100%
    };

    // Calculate footprint:
    // Car distance fallback to 0
    // Public distance fallback to 0
    // shortFlights fallback to 0 (Infinity is not finite)
    // longFlights = 2 -> 2 * 5000 * 0.195 = 1950 kg
    // Total Transport = 1950 kg
    // Energy: electricity = 300 * 12 * 0.385 = 1386. heating = 0. shared by 1 member = 1386 kg
    // Food = 800 kg
    // Consumption: recyclingRate capped at 100% -> reductionFactor = 0.8 -> 400 * 0.8 = 320 kg
    // Total should be 1950 + 1386 + 800 + 320 = 4456 kg
    const footprint = CarbonCalculator.calculateFootprint(inputs, 'metric');
    
    expect(footprint.totalKg).toBeCloseTo(4456, 1);
    expect(footprint.totalTons).toBeCloseTo(4.456, 3);
  });

  test('Tracker.logActivity rejects NaN, infinite, and negative log amounts without corrupting state', () => {
    // Attempt to log invalid amounts
    const resultNaN = Tracker.logActivity('walk_cycle', 'not-a-number');
    expect(resultNaN.pointsEarned).toBe(0);
    expect(resultNaN.carbonSaved).toBe(0);

    const resultNeg = Tracker.logActivity('walk_cycle', -10);
    expect(resultNeg.pointsEarned).toBe(0);
    expect(resultNeg.carbonSaved).toBe(0);

    const resultInf = Tracker.logActivity('walk_cycle', Infinity);
    expect(resultInf.pointsEarned).toBe(0);
    expect(resultInf.carbonSaved).toBe(0);

    const state = Tracker.loadState();
    expect(state.dailyLogs).toHaveLength(0);
    expect(state.totalCarbonSaved).toBe(0);
    expect(state.xp).toBe(0);
  });
});

