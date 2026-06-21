/**
 * @module tracker
 * @description EcoSync State Tracker.
 * Manages client-side persistence (localStorage), gamification (XP/levels/badges),
 * daily activity logging, goal tracking, and reduction progress calculations.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key used to persist user state. */
const STORAGE_KEY = 'ecosync_user_data';

/** Minimum valid household size (prevents division-by-zero). */
const MIN_HOUSEHOLD_SIZE = 1;

// ---------------------------------------------------------------------------
// Activity definitions
// ---------------------------------------------------------------------------

/**
 * Catalogue of loggable eco-friendly activities.
 * Each entry defines CO2 savings and XP reward per unit of activity.
 *
 * @type {Object.<string, { id: string, label: string, description: string,
 *                           co2SavedPerUnit: number, xpAward: number, unit: string }>}
 */
export const ECO_ACTIVITIES = {
  walk_cycle: {
    id: 'walk_cycle',
    label: 'Walked or Bicycled',
    description: 'Walked/bicycled instead of driving a personal vehicle',
    co2SavedPerUnit: 0.192, // kg CO2e per km
    xpAward: 15,
    unit: 'km'
  },
  public_transit: {
    id: 'public_transit',
    label: 'Used Public Transport',
    description: 'Took bus or train instead of driving a personal vehicle',
    co2SavedPerUnit: 0.12, // kg CO2e per km
    xpAward: 10,
    unit: 'km'
  },
  meat_free_meal: {
    id: 'meat_free_meal',
    label: 'Meat-Free Meal',
    description: 'Ate a vegetarian or vegan meal instead of meat',
    co2SavedPerUnit: 1.5, // kg CO2e per meal
    xpAward: 20,
    unit: 'meal'
  },
  unplug_devices: {
    id: 'unplug_devices',
    label: 'Unplugged Devices',
    description: 'Unplugged vampire electronics or turned down thermostat',
    co2SavedPerUnit: 0.8, // kg CO2e per day
    xpAward: 10,
    unit: 'day'
  },
  recycle_waste: {
    id: 'recycle_waste',
    label: 'Recycled Waste',
    description: 'Composted, recycled plastics, glass, and paper',
    co2SavedPerUnit: 0.5, // kg CO2e per event
    xpAward: 10,
    unit: 'event'
  },
  reusable_items: {
    id: 'reusable_items',
    label: 'Reusable Bags/Mug',
    description: 'Avoided single-use plastics by carrying your own reusable items',
    co2SavedPerUnit: 0.2, // kg CO2e per item
    xpAward: 5,
    unit: 'item'
  }
};

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

/**
 * Achievement badges awarded at specific milestones.
 *
 * @type {Array<{ id: string, name: string, desc: string, icon: string }>}
 */
export const BADGES = [
  { id: 'first_step',        name: 'First Steps',      desc: 'Completed the Carbon Calculator for the first time.', icon: '🌱' },
  { id: 'level_5',           name: 'Eco Novice',        desc: 'Reached Level 5.',                                    icon: '🍀' },
  { id: 'level_10',          name: 'Eco Champion',      desc: 'Reached Level 10.',                                   icon: '🌳' },
  { id: 'saver_50',          name: 'Carbon Saver 50',   desc: 'Saved more than 50 kg of CO2.',                       icon: '⚡' },
  { id: 'saver_200',         name: 'Carbon Saver 200',  desc: 'Saved more than 200 kg of CO2.',                      icon: '🌍' },
  { id: 'challenge_master',  name: 'Challenge Master',  desc: 'Completed 5 eco challenges.',                         icon: '🏆' },
  { id: 'quiz_genius',       name: 'Quiz Genius',       desc: 'Scored 100% on the Eco Quiz.',                        icon: '🧠' }
];

// Badge unlock thresholds — centralised to avoid scattered magic numbers
const BADGE_LEVEL_NOVICE   = 5;
const BADGE_LEVEL_CHAMPION = 10;
const BADGE_CO2_SAVER_LOW  = 50;
const BADGE_CO2_SAVER_HIGH = 200;
const BADGE_CHALLENGES_MIN = 5;

// ---------------------------------------------------------------------------
// Default state factory
// ---------------------------------------------------------------------------

/**
 * Return a fresh default state object.
 *
 * @returns {{
 *   level: number, xp: number, totalCarbonSaved: number,
 *   calculatorInputs: null, footprintResult: null,
 *   dailyLogs: Array, acceptedChallenges: Array, completedChallenges: Array,
 *   quizAttempts: Array, goal: null, badges: Array
 * }} Initialised default state.
 */
function createDefaultState() {
  return {
    level: 1,
    xp: 0,
    totalCarbonSaved: 0,      // kg CO2e saved to date
    calculatorInputs: null,
    footprintResult: null,
    dailyLogs: [],            // { date, activityId, amount, co2Saved, xpEarned }[]
    acceptedChallenges: [],   // challenge ID[]
    completedChallenges: [],  // challenge ID[]
    quizAttempts: [],         // { date, score, total }[]
    goal: null,               // { targetPercent, targetFootprintKg, startDate }
    badges: []                // badge ID[]
  };
}

// ---------------------------------------------------------------------------
// Tracker class
// ---------------------------------------------------------------------------

/**
 * Manages all mutable user state through localStorage.
 * Exposes a functional interface; every mutating method reads, modifies,
 * and writes state in a single synchronous transaction.
 */
export class Tracker {
  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Load and parse user state from localStorage.
   * If storage is empty or corrupted, initialises and persists a default state.
   *
   * @returns {Object} Current user state object.
   */
  static loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (parseError) {
        console.error('[EcoSync] Failed to parse stored state — resetting.', parseError);
      }
    }

    const defaultState = createDefaultState();
    this.saveState(defaultState);
    return defaultState;
  }

  /**
   * Serialise and write user state to localStorage.
   *
   * @param {Object} state - State object to persist.
   * @returns {void}
   */
  static saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Wipe stored state and return a fresh default state.
   *
   * @returns {Object} Newly initialised default state.
   */
  static clearState() {
    localStorage.removeItem(STORAGE_KEY);
    return this.loadState();
  }

  // -------------------------------------------------------------------------
  // Gamification — XP & levelling
  // -------------------------------------------------------------------------

  /**
   * Add XP to state and process level-ups.
   * Level L requires `L × 100` XP to advance; excess XP carries over.
   *
   * @param {Object} state     - Current user state (mutated in place).
   * @param {number} xpAmount  - Non-negative XP amount to add.
   * @returns {{ state: Object, leveledUp: boolean }} Updated state and level-up flag.
   */
  static addXP(state, xpAmount) {
    let xp    = state.xp + xpAmount;
    let level = state.level;
    let leveledUp = false;

    while (xp >= level * 100) {
      xp -= level * 100;
      level += 1;
      leveledUp = true;
    }

    state.xp    = xp;
    state.level = level;

    this.checkBadges(state);

    return { state, leveledUp };
  }

  // -------------------------------------------------------------------------
  // Gamification — badges
  // -------------------------------------------------------------------------

  /**
   * Evaluate badge unlock conditions and award any newly earned badges.
   *
   * @param {Object} state - Current user state (badges array mutated in place).
   * @returns {string[]} Array of newly unlocked badge IDs (may be empty).
   */
  static checkBadges(state) {
    const unlocked = [];

    /**
     * Award badge if not already held.
     *
     * @param {string} id - Badge identifier.
     */
    const unlockBadge = (id) => {
      if (!state.badges.includes(id)) {
        state.badges.push(id);
        unlocked.push(id);
      }
    };

    if (state.footprintResult)                                   unlockBadge('first_step');
    if (state.level >= BADGE_LEVEL_NOVICE)                       unlockBadge('level_5');
    if (state.level >= BADGE_LEVEL_CHAMPION)                     unlockBadge('level_10');
    if (state.totalCarbonSaved >= BADGE_CO2_SAVER_LOW)           unlockBadge('saver_50');
    if (state.totalCarbonSaved >= BADGE_CO2_SAVER_HIGH)          unlockBadge('saver_200');
    if (state.completedChallenges.length >= BADGE_CHALLENGES_MIN) unlockBadge('challenge_master');

    const hasPerfectQuiz = state.quizAttempts.some(
      (attempt) => attempt.score === attempt.total && attempt.total > 0
    );
    if (hasPerfectQuiz) unlockBadge('quiz_genius');

    return unlocked;
  }

  // -------------------------------------------------------------------------
  // Activity logging
  // -------------------------------------------------------------------------

  /**
   * Log an eco-friendly activity, recording carbon saved and awarding XP.
   * Silently returns zero-result when `amount` is invalid (NaN, Infinity, ≤ 0).
   *
   * @param {string} activityId - Key matching an entry in ECO_ACTIVITIES.
   * @param {number} amount     - Positive quantity in the activity's native unit.
   * @returns {{ state: Object, leveledUp: boolean, pointsEarned: number, carbonSaved: number }}
   * @throws {Error} When `activityId` does not match a known activity.
   */
  static logActivity(activityId, amount) {
    const activity = ECO_ACTIVITIES[activityId];

    if (!activity) {
      throw new Error(`[EcoSync] Unknown activity: "${activityId}"`);
    }

    const state = this.loadState();
    const numericAmount = parseFloat(amount);

    // Guard: reject non-positive or non-finite values without side effects
    if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
      return { state, pointsEarned: 0, carbonSaved: 0 };
    }

    const co2Saved  = numericAmount * activity.co2SavedPerUnit;
    const xpEarned  = Math.round(numericAmount * activity.xpAward);
    const todayDate = new Date().toISOString().split('T')[0];

    state.dailyLogs.push({
      date:       todayDate,
      activityId,
      amount:     numericAmount,
      co2Saved,
      xpEarned
    });

    state.totalCarbonSaved += co2Saved;

    const xpResult = this.addXP(state, xpEarned);
    this.saveState(xpResult.state);

    return {
      state:        xpResult.state,
      leveledUp:    xpResult.leveledUp,
      pointsEarned: xpEarned,
      carbonSaved:  co2Saved
    };
  }

  // -------------------------------------------------------------------------
  // Goal management
  // -------------------------------------------------------------------------

  /**
   * Set a percentage-based carbon reduction goal relative to the baseline footprint.
   *
   * @param {number} targetPercent - Desired reduction as a percentage (e.g. 20 for 20%).
   * @returns {Object} Updated state with goal set.
   * @throws {Error} When no footprint baseline exists (calculator not completed).
   */
  static setGoal(targetPercent) {
    const state = this.loadState();

    if (!state.footprintResult) {
      throw new Error('[EcoSync] Complete the Carbon Calculator before setting a reduction goal.');
    }

    const baseFootprintKg   = state.footprintResult.totalKg;
    const targetFootprintKg = baseFootprintKg * (1 - targetPercent / 100);

    state.goal = {
      targetPercent,
      targetFootprintKg,
      startDate: new Date().toISOString().split('T')[0]
    };

    this.saveState(state);
    return state;
  }

  /**
   * Calculate progress toward the active reduction goal.
   *
   * @returns {{
   *   targetPercent: number, baseFootprintKg: number, targetFootprintKg: number,
   *   targetReductionKg: number, currentSavedKg: number, progressPercent: number
   * } | null} Progress object, or `null` when no goal or baseline exists.
   */
  static getGoalProgress() {
    const state = this.loadState();

    if (!state.goal || !state.footprintResult) {
      return null;
    }

    const baseFootprintKg    = state.footprintResult.totalKg;
    const targetFootprintKg  = state.goal.targetFootprintKg;
    const targetReductionKg  = baseFootprintKg - targetFootprintKg;
    const currentSavedKg     = state.totalCarbonSaved;
    const progressPercent    = Math.min(100, Math.round((currentSavedKg / targetReductionKg) * 100));

    return {
      targetPercent:    state.goal.targetPercent,
      baseFootprintKg,
      targetFootprintKg,
      targetReductionKg,
      currentSavedKg,
      progressPercent
    };
  }
}
