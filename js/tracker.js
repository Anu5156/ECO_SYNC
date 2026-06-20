/**
 * EcoSync State Tracker
 * Manages client-side storage, gamification (XP/levels/badges), and activity logging.
 */

const STORAGE_KEY = 'ecosync_user_data';

// Standard eco-activities that can be logged daily
export const ECO_ACTIVITIES = {
  walk_cycle: {
    id: 'walk_cycle',
    label: 'Walked or Bicycled',
    description: 'Walked/bicycled instead of driving a personal vehicle',
    co2SavedPerUnit: 0.192, // kg CO2 per km
    xpAward: 15,
    unit: 'km'
  },
  public_transit: {
    id: 'public_transit',
    label: 'Used Public Transport',
    description: 'Took bus or train instead of driving a personal vehicle',
    co2SavedPerUnit: 0.12, // kg CO2 per km
    xpAward: 10,
    unit: 'km'
  },
  meat_free_meal: {
    id: 'meat_free_meal',
    label: 'Meat-Free Meal',
    description: 'Ate a vegetarian or vegan meal instead of meat',
    co2SavedPerUnit: 1.5, // kg CO2 per meal
    xpAward: 20,
    unit: 'meal'
  },
  unplug_devices: {
    id: 'unplug_devices',
    label: 'Unplugged Devices',
    description: 'Unplugged vampire electronics or turned down thermostat',
    co2SavedPerUnit: 0.8, // kg CO2 per day
    xpAward: 10,
    unit: 'day'
  },
  recycle_waste: {
    id: 'recycle_waste',
    label: 'Recycled Waste',
    description: 'Composted, recycled plastics, glass, and paper',
    co2SavedPerUnit: 0.5, // kg CO2 per event
    xpAward: 10,
    unit: 'event'
  },
  reusable_items: {
    id: 'reusable_items',
    label: 'Reusable Bags/Mug',
    description: 'Avoided single-use plastics by carrying your own reusable items',
    co2SavedPerUnit: 0.2, // kg CO2 per item
    xpAward: 5,
    unit: 'item'
  }
};

// Badges system
export const BADGES = [
  { id: 'first_step', name: 'First Steps', desc: 'Completed the Carbon Calculator for the first time.', icon: '🌱' },
  { id: 'level_5', name: 'Eco Novice', desc: 'Reached Level 5.', icon: '🍀' },
  { id: 'level_10', name: 'Eco Champion', desc: 'Reached Level 10.', icon: '🌳' },
  { id: 'saver_50', name: 'Carbon Saver 50', desc: 'Saved more than 50 kg of CO2.', icon: '⚡' },
  { id: 'saver_200', name: 'Carbon Saver 200', desc: 'Saved more than 200 kg of CO2.', icon: '🌍' },
  { id: 'challenge_master', name: 'Challenge Master', desc: 'Completed 5 eco challenges.', icon: '🏆' },
  { id: 'quiz_genius', name: 'Quiz Genius', desc: 'Scored 100% on the Eco Quiz.', icon: '🧠' }
];

export class Tracker {
  /**
   * Load state from localStorage or initialize defaults
   */
  static loadState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Error parsing local storage data. Resetting state.', e);
      }
    }

    const defaultState = {
      level: 1,
      xp: 0,
      totalCarbonSaved: 0, // in kg CO2
      calculatorInputs: null,
      footprintResult: null,
      dailyLogs: [], // array of { date, activityId, amount, co2Saved, xpEarned }
      acceptedChallenges: [], // array of challenge IDs
      completedChallenges: [], // array of challenge IDs
      quizAttempts: [], // array of { date, score, total }
      goal: null, // { targetPercent, targetFootprintKg, startDate }
      badges: [] // array of badge IDs
    };
    this.saveState(defaultState);
    return defaultState;
  }

  /**
   * Save state to localStorage
   */
  static saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Clear state and restart
   */
  static clearState() {
    localStorage.removeItem(STORAGE_KEY);
    return this.loadState();
  }

  /**
   * Add XP and handle level-ups
   * @param {Object} state 
   * @param {number} xpAmount 
   * @returns {Object} { state, leveledUp }
   */
  static addXP(state, xpAmount) {
    let currentXp = state.xp + xpAmount;
    let currentLevel = state.level;
    let leveledUp = false;

    // Level-up curve: Level L needs L * 100 XP to advance
    while (currentXp >= currentLevel * 100) {
      currentXp -= currentLevel * 100;
      currentLevel += 1;
      leveledUp = true;
    }

    state.xp = currentXp;
    state.level = currentLevel;

    // Check for level badges
    this.checkBadges(state);
    
    return { state, leveledUp };
  }

  /**
   * Check and unlock new badges
   * @param {Object} state 
   * @returns {string[]} newly unlocked badge IDs
   */
  static checkBadges(state) {
    const unlocked = [];

    const unlockBadge = (id) => {
      if (!state.badges.includes(id)) {
        state.badges.push(id);
        unlocked.push(id);
      }
    };

    if (state.footprintResult) unlockBadge('first_step');
    if (state.level >= 5) unlockBadge('level_5');
    if (state.level >= 10) unlockBadge('level_10');
    if (state.totalCarbonSaved >= 50) unlockBadge('saver_50');
    if (state.totalCarbonSaved >= 200) unlockBadge('saver_200');
    if (state.completedChallenges.length >= 5) unlockBadge('challenge_master');

    const perfectQuiz = state.quizAttempts.some(attempt => attempt.score === attempt.total && attempt.total > 0);
    if (perfectQuiz) unlockBadge('quiz_genius');

    return unlocked;
  }

  /**
   * Log an eco-friendly activity
   * @param {string} activityId 
   * @param {number} amount 
   */
  static logActivity(activityId, amount) {
    const state = this.loadState();
    const activity = ECO_ACTIVITIES[activityId];

    if (!activity) {
      throw new Error(`Unknown activity: ${activityId}`);
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
      return { state, pointsEarned: 0, carbonSaved: 0 };
    }

    const co2Saved = numericAmount * activity.co2SavedPerUnit;
    const xpEarned = Math.round(numericAmount * activity.xpAward);

    // Save logs
    const today = new Date().toISOString().split('T')[0];
    state.dailyLogs.push({
      date: today,
      activityId,
      amount: numericAmount,
      co2Saved,
      xpEarned
    });

    state.totalCarbonSaved += co2Saved;
    
    // Add XP
    const xpResult = this.addXP(state, xpEarned);
    
    this.saveState(xpResult.state);

    return {
      state: xpResult.state,
      leveledUp: xpResult.leveledUp,
      pointsEarned: xpEarned,
      carbonSaved: co2Saved
    };
  }

  /**
   * Set reduction goal
   * @param {number} targetPercent 
   */
  static setGoal(targetPercent) {
    const state = this.loadState();
    if (!state.footprintResult) {
      throw new Error('Please complete the Carbon Calculator before setting a reduction goal.');
    }

    const baseFootprint = state.footprintResult.totalKg;
    const targetFootprintKg = baseFootprint * (1 - (targetPercent / 100));

    state.goal = {
      targetPercent,
      targetFootprintKg,
      startDate: new Date().toISOString().split('T')[0]
    };

    this.saveState(state);
    return state;
  }

  /**
   * Get reduction progress stats
   */
  static getGoalProgress() {
    const state = this.loadState();
    if (!state.goal || !state.footprintResult) return null;

    const baseFootprint = state.footprintResult.totalKg;
    const targetFootprint = state.goal.targetFootprintKg;
    const targetReduction = baseFootprint - targetFootprint;
    const currentSaved = state.totalCarbonSaved;

    // Progress percentage (how close to target reduction)
    const progressPercent = Math.min(100, Math.round((currentSaved / targetReduction) * 100));

    return {
      targetPercent: state.goal.targetPercent,
      baseFootprintKg: baseFootprint,
      targetFootprintKg: targetFootprint,
      targetReductionKg: targetReduction,
      currentSavedKg: currentSaved,
      progressPercent
    };
  }
}
