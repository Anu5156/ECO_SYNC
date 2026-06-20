/**
 * EcoSync Quiz System
 * Contains curated environmental questions, score calculator, and tracker hook.
 */

import { Tracker } from './tracker.js';

export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: 'Which sector contributes the most greenhouse gas emissions globally?',
    options: [
      'Transportation',
      'Electricity & Heat Production',
      'Agriculture & Forestry',
      'Manufacturing & Industry'
    ],
    correctAnswerIndex: 1,
    explanation: 'Electricity and heat production combined account for about 25% of global greenhouse gas emissions (IPCC), primarily due to burning coal, natural gas, and oil.'
  },
  {
    id: 'q2',
    question: 'What does a "carbon footprint" measure?',
    options: [
      'The size of carbon residue left behind by manufacturing plants',
      'The total greenhouse gas emissions caused directly and indirectly by an individual, organization, event, or product',
      'The amount of physical coal consumed in a household annually',
      'The amount of carbon dioxide absorbed by a forest'
    ],
    correctAnswerIndex: 1,
    explanation: 'A carbon footprint is the total sum of greenhouse gases (including carbon dioxide and methane) emitted by our actions, measured in tons or kilograms of CO2 equivalent (CO2e).'
  },
  {
    id: 'q3',
    question: 'Which diet has, on average, the lowest annual carbon footprint?',
    options: [
      'Vegetarian diet (no meat, includes dairy/eggs)',
      'Heavy meat diet (daily red meat/poultry)',
      'Vegan diet (entirely plant-based)',
      'Mediterranean diet (mostly fish, olive oil, vegetables)'
    ],
    correctAnswerIndex: 2,
    explanation: 'A plant-based vegan diet has the lowest carbon footprint (~800 kg CO2e/year) because plant cultivation requires far less energy, land, and water than livestock, which also emit methane.'
  },
  {
    id: 'q4',
    question: 'What is the target limit of global temperature rise set by the Paris Agreement?',
    options: [
      'Well below 2.0°C, aiming for 1.5°C',
      'Exactly 3.0°C',
      'Below 0.5°C',
      'No specific warming target'
    ],
    correctAnswerIndex: 0,
    explanation: 'The Paris Agreement aims to hold global warming to well below 2°C, and pursue efforts to limit it to 1.5°C compared to pre-industrial levels, to avoid the worst impacts of climate change.'
  },
  {
    id: 'q5',
    question: 'Why does unplugging idle electronics (like chargers and TVs) save electricity?',
    options: [
      'It prevents electricity from leaking onto the floor',
      'Idle electronics emit heat that increases air conditioning costs',
      'Many electronics draw "phantom" or "vampire" power even when turned off or in standby mode',
      'It extends the battery life of the device'
    ],
    correctAnswerIndex: 2,
    explanation: 'Phantom/vampire loads from appliances in standby mode can account for up to 10% of standard household electricity usage. Unplugging them or using smart power strips eliminates this waste.'
  },
  {
    id: 'q6',
    question: 'Which transportation method has the lowest greenhouse gas emissions per passenger-kilometer?',
    options: [
      'Solo car driving (Gasoline)',
      'Taking a public train or subway',
      'Flying on a short-haul flight',
      'Taking a rideshare (Uber/Lyft) with one passenger'
    ],
    correctAnswerIndex: 1,
    explanation: 'Public rail/subway transport is highly efficient and runs on average around 0.035 kg CO2e per passenger-km, which is up to 5-6 times lower than driving a fossil-fuel vehicle.'
  },
  {
    id: 'q7',
    question: 'What is the main greenhouse gas emitted by decomposing organic waste in landfills?',
    options: [
      'Nitrous Oxide',
      'Methane',
      'Carbon Monoxide',
      'Helium'
    ],
    correctAnswerIndex: 1,
    explanation: 'Decomposing organic waste in anaerobic (oxygen-poor) landfills produces methane (CH4), a potent greenhouse gas that is 28-36 times more effective than CO2 at trapping heat over 100 years.'
  },
  {
    id: 'q8',
    question: 'What is the difference between Scope 1, Scope 2, and Scope 3 emissions?',
    options: [
      'Scope 1 is local, Scope 2 is regional, and Scope 3 is global emissions',
      'Scope 1 is direct emissions, Scope 2 is indirect emissions from electricity/heat, and Scope 3 is all other indirect value chain emissions',
      'Scope 1 is carbon, Scope 2 is methane, and Scope 3 is nitrous oxide',
      'Scope 1 is household, Scope 2 is corporate, and Scope 3 is agricultural emissions'
    ],
    correctAnswerIndex: 1,
    explanation: 'Scope 1 represents direct emissions from sources owned/controlled (e.g. boilers, cars). Scope 2 represents indirect emissions from purchased power. Scope 3 covers all other indirect emissions in the lifecycle.'
  }
];

export class QuizManager {
  /**
   * Get a random set of N questions
   * @param {number} numQuestions 
   */
  static getRandomQuiz(numQuestions = 5) {
    const shuffled = [...QUIZ_QUESTIONS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numQuestions);
  }

  /**
   * Record a quiz attempt, awards XP, and returns results details
   * @param {number} score - count of correct answers
   * @param {number} total - count of total questions
   * @returns {Object} result summary including points and state updates
   */
  static recordAttempt(score, total) {
    const state = Tracker.loadState();
    
    // Calculate XP award: 20 XP per correct answer. If perfect score, +50 XP bonus!
    let xpEarned = score * 20;
    if (score === total && total > 0) {
      xpEarned += 50; // Perfect score bonus
    }

    const today = new Date().toISOString().split('T')[0];
    state.quizAttempts.push({
      date: today,
      score,
      total
    });

    state.totalCarbonSaved += 0; // Quizzes don't directly save physical CO2, but provide educational value
    
    const xpResult = Tracker.addXP(state, xpEarned);
    
    // Save new state
    Tracker.saveState(xpResult.state);

    return {
      state: xpResult.state,
      leveledUp: xpResult.leveledUp,
      xpEarned,
      isPerfect: score === total && total > 0
    };
  }
}
