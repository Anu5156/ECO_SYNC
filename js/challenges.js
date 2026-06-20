/**
 * EcoSync Gamified Challenges
 * Contains challenge lists and acceptance/completion state transitions.
 */

import { Tracker } from './tracker.js';

export const CHALLENGES = [
  // Easy Challenges
  {
    id: 'unplug_vampires',
    title: 'Vampire Slayer',
    description: 'Unplug all vampire electronics (chargers, appliances, TVs in standby) before sleep for 3 days.',
    tier: 'easy',
    co2Saved: 5, // kg
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

  // Medium Challenges
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

  // Hard Challenges
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

export class ChallengeManager {
  /**
   * Get all challenges
   */
  static getAll() {
    return CHALLENGES;
  }

  /**
   * Get challenge by ID
   */
  static getById(id) {
    return CHALLENGES.find(c => c.id === id);
  }

  /**
   * Accept a challenge
   * @param {string} challengeId 
   */
  static acceptChallenge(challengeId) {
    const state = Tracker.loadState();
    const challenge = this.getById(challengeId);

    if (!challenge) {
      throw new Error(`Challenge with ID ${challengeId} not found.`);
    }

    if (state.acceptedChallenges.includes(challengeId)) {
      return state; // Already accepted
    }

    if (state.completedChallenges.includes(challengeId)) {
      // Allow re-taking of challenges, or just block it. Let's allow but remove from completed first
      state.completedChallenges = state.completedChallenges.filter(id => id !== challengeId);
    }

    state.acceptedChallenges.push(challengeId);
    Tracker.saveState(state);
    return state;
  }

  /**
   * Abandon/Cancel an accepted challenge
   * @param {string} challengeId 
   */
  static abandonChallenge(challengeId) {
    const state = Tracker.loadState();
    state.acceptedChallenges = state.acceptedChallenges.filter(id => id !== challengeId);
    Tracker.saveState(state);
    return state;
  }

  /**
   * Complete a challenge
   * @param {string} challengeId 
   */
  static completeChallenge(challengeId) {
    let state = Tracker.loadState();
    const challenge = this.getById(challengeId);

    if (!challenge) {
      throw new Error(`Challenge with ID ${challengeId} not found.`);
    }

    // Remove from active
    state.acceptedChallenges = state.acceptedChallenges.filter(id => id !== challengeId);

    // Add to completed if not already there
    if (!state.completedChallenges.includes(challengeId)) {
      state.completedChallenges.push(challengeId);
    }

    // Add carbon credit and XP
    state.totalCarbonSaved += challenge.co2Saved;
    
    // Add XP via Tracker to leverage leveling and badges check
    const xpResult = Tracker.addXP(state, challenge.xpReward);
    state = xpResult.state;

    Tracker.saveState(state);

    return {
      state,
      leveledUp: xpResult.leveledUp,
      co2Saved: challenge.co2Saved,
      xpReward: challenge.xpReward
    };
  }
}
