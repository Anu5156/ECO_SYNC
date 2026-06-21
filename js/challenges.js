/**
 * @module challenges
 * @description EcoSync Gamified Challenges.
 * Defines the challenge catalogue and manages accept / abandon / complete
 * state transitions, delegating persistence and XP to the Tracker module.
 */

import { Tracker } from './tracker.js';

// ---------------------------------------------------------------------------
// Challenge catalogue
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Challenge
 * @property {string} id          - Unique challenge identifier.
 * @property {string} title       - Short display title.
 * @property {string} description - Full task description shown to the user.
 * @property {'easy'|'medium'|'hard'} tier - Difficulty tier.
 * @property {number} co2Saved    - Estimated kg CO2e saved on completion.
 * @property {number} xpReward    - XP awarded on completion.
 * @property {string} duration    - Human-readable expected duration.
 */

/**
 * Full set of available eco challenges, ordered by difficulty tier.
 *
 * @type {Challenge[]}
 */
export const CHALLENGES = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  {
    id: 'unplug_vampires',
    title: 'Vampire Slayer',
    description: 'Unplug all vampire electronics (chargers, appliances, TVs in standby) before sleep for 3 days.',
    tier: 'easy',
    co2Saved: 5,
    xpReward: 50,
    duration: '3 days'
  },
  {
    id: 'meatless_day',
    title: 'Veggie Power',
    description: 'Go completely meat-free (vegetarian or vegan) for 1 full day.',
    tier: 'easy',
    co2Saved: 4,
    xpReward: 50,
    duration: '1 day'
  },
  {
    id: 'cold_wash',
    title: 'Cold Cycle',
    description: 'Wash all loads of laundry in cold water instead of hot or warm for 7 days.',
    tier: 'easy',
    co2Saved: 3,
    xpReward: 50,
    duration: '7 days'
  },

  // ── Medium ────────────────────────────────────────────────────────────────
  {
    id: 'active_transit_week',
    title: 'Active Commuter',
    description: 'Walk, bicycle, or use public transport for all short trips (under 5 km) for a full week.',
    tier: 'medium',
    co2Saved: 15,
    xpReward: 120,
    duration: '7 days'
  },
  {
    id: 'zero_waste_week',
    title: 'Plastic Purge',
    description: 'Avoid all single-use plastics (bottles, grocery bags, straws, plastic utensils) for 7 days.',
    tier: 'medium',
    co2Saved: 10,
    xpReward: 120,
    duration: '7 days'
  },
  {
    id: 'local_diet',
    title: 'Locavore',
    description: 'Consume only locally-sourced, seasonal foods (within 100 miles) for 3 consecutive days.',
    tier: 'medium',
    co2Saved: 12,
    xpReward: 120,
    duration: '3 days'
  },

  // ── Hard ──────────────────────────────────────────────────────────────────
  {
    id: 'vegetarian_month',
    title: 'Herbivore Era',
    description: 'Adopt a fully vegetarian diet for 30 consecutive days.',
    tier: 'hard',
    co2Saved: 80,
    xpReward: 300,
    duration: '30 days'
  },
  {
    id: 'car_free_month',
    title: 'Pedal & Rail',
    description: 'Commute entirely without driving your personal car for 30 days.',
    tier: 'hard',
    co2Saved: 120,
    xpReward: 400,
    duration: '30 days'
  },
  {
    id: 'energy_efficiency_audit',
    title: 'Smart Home Energy',
    description: 'Install smart power strips, program your HVAC system, or switch electricity supply to green energy.',
    tier: 'hard',
    co2Saved: 150,
    xpReward: 300,
    duration: 'One-off'
  }
];

// ---------------------------------------------------------------------------
// ChallengeManager class
// ---------------------------------------------------------------------------

/**
 * Provides static methods to query and manage challenge lifecycle transitions:
 * accept → (abandon | complete).
 */
export class ChallengeManager {
  /**
   * Return all available challenges.
   *
   * @returns {Challenge[]} Full challenge catalogue.
   */
  static getAll() {
    return CHALLENGES;
  }

  /**
   * Find a single challenge by its unique identifier.
   *
   * @param {string} id - Challenge identifier to look up.
   * @returns {Challenge|undefined} Matching challenge, or `undefined` if not found.
   */
  static getById(id) {
    return CHALLENGES.find((challenge) => challenge.id === id);
  }

  /**
   * Accept a challenge and add it to the user's active list.
   * If the challenge was previously completed, it is removed from completed
   * before being re-accepted (re-take allowed).
   * No-op if the challenge is already in the active list.
   *
   * @param {string} challengeId - ID of the challenge to accept.
   * @returns {Object} Updated user state.
   * @throws {Error} When `challengeId` does not match any known challenge.
   */
  static acceptChallenge(challengeId) {
    const challenge = this.getById(challengeId);

    if (!challenge) {
      throw new Error(`[EcoSync] Challenge not found: "${challengeId}"`);
    }

    const state = Tracker.loadState();

    // Already active — nothing to do
    if (state.acceptedChallenges.includes(challengeId)) {
      return state;
    }

    // Allow re-taking previously completed challenges
    if (state.completedChallenges.includes(challengeId)) {
      state.completedChallenges = state.completedChallenges.filter((id) => id !== challengeId);
    }

    state.acceptedChallenges.push(challengeId);
    Tracker.saveState(state);
    return state;
  }

  /**
   * Abandon (cancel) an active challenge without awarding XP or carbon credits.
   *
   * @param {string} challengeId - ID of the challenge to abandon.
   * @returns {Object} Updated user state.
   */
  static abandonChallenge(challengeId) {
    const state = Tracker.loadState();
    state.acceptedChallenges = state.acceptedChallenges.filter((id) => id !== challengeId);
    Tracker.saveState(state);
    return state;
  }

  /**
   * Mark an active challenge as complete, award CO2 credits and XP,
   * and evaluate badge unlocks via the Tracker.
   *
   * @param {string} challengeId - ID of the challenge to complete.
   * @returns {{ state: Object, leveledUp: boolean, co2Saved: number, xpReward: number }}
   * @throws {Error} When `challengeId` does not match any known challenge.
   */
  static completeChallenge(challengeId) {
    const challenge = this.getById(challengeId);

    if (!challenge) {
      throw new Error(`[EcoSync] Challenge not found: "${challengeId}"`);
    }

    let state = Tracker.loadState();

    // Move from active → completed
    state.acceptedChallenges  = state.acceptedChallenges.filter((id) => id !== challengeId);
    if (!state.completedChallenges.includes(challengeId)) {
      state.completedChallenges.push(challengeId);
    }

    // Apply carbon credit
    state.totalCarbonSaved += challenge.co2Saved;

    // Apply XP via Tracker to trigger levelling and badge checks
    const xpResult = Tracker.addXP(state, challenge.xpReward);
    state = xpResult.state;

    Tracker.saveState(state);

    return {
      state,
      leveledUp: xpResult.leveledUp,
      co2Saved:  challenge.co2Saved,
      xpReward:  challenge.xpReward
    };
  }
}
