/**
 * EcoSync SPA Controller
 * Connects UI actions, local storage, calculations, quiz flow, and SVG rendering.
 */

import { CarbonCalculator } from './calculator.js';
import { Tracker, ECO_ACTIVITIES, BADGES } from './tracker.js';
import { ChallengeManager } from './challenges.js';
import { QuizManager } from './quiz.js';

// --- DOM References ---
const navTabs = document.querySelectorAll('.nav-tab');
const sections = document.querySelectorAll('.tab-section');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');

// User Profile Stats (Header)
const headerUserLevel = document.getElementById('user-level-val');
const headerUserXpFill = document.getElementById('user-xp-fill-mini-val');

// Dashboard Stat Counters
const dashFootprint = document.getElementById('dash-footprint-val');
const dashFootprintTrend = document.getElementById('dash-footprint-trend');
const dashSaved = document.getElementById('dash-saved-val');
const dashSavedPct = document.getElementById('dash-saved-pct');
const dashGoal = document.getElementById('dash-goal-val');
const dashGoalTrend = document.getElementById('dash-goal-trend-lbl');
const dashXp = document.getElementById('dash-xp-val');
const dashXpToNext = document.getElementById('dash-xp-to-next');

// Charts
const donutChartSvg = document.getElementById('donut-chart-svg');
const donutChartLegend = document.getElementById('donut-chart-legend');
const donutTotalValue = document.getElementById('chart-total-value');
const weeklyBarChart = document.getElementById('weekly-bar-chart');

// Calculator Wizard
const wizardSteps = document.querySelectorAll('.wizard-step-card');
const wizardNodes = document.querySelectorAll('.wizard-step-node');
const wizardProgressBar = document.getElementById('wizard-progress-bar-fill');
const calcUnitsSelect = document.getElementById('calc-units');
const carDistLabel = document.getElementById('car-dist-label');
const publicDistLabel = document.getElementById('public-dist-label');
const footprintForm = document.getElementById('footprint-form');
const btnRecalculate = document.getElementById('btn-recalculate');
const btnGoDashboard = document.getElementById('btn-go-dashboard');

// Daily Logger
const activitiesButtonGrid = document.getElementById('activities-button-grid');
const activitiesHistoryContainer = document.getElementById('activities-history-container');
const btnClearLogs = document.getElementById('btn-clear-logs');

// Daily Logger Modal
const activityLogModal = document.getElementById('activity-log-modal');
const activityLogForm = document.getElementById('activity-log-form');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalActivityId = document.getElementById('modal-activity-id');
const modalInputLabel = document.getElementById('modal-input-label');
const modalInputAmount = document.getElementById('modal-input-amount');
const btnCloseModal = document.getElementById('btn-close-modal');

// Action Hub
const circleProgressFill = document.getElementById('circle-progress-fill');
const goalCirclePercent = document.getElementById('goal-circle-percent');
const goalStatusText = document.getElementById('goal-status-text');
const challengesContainer = document.getElementById('challenges-container');
const badgesGridContainer = document.getElementById('badges-grid-container');

// Eco-Quiz Box
const quizContainerBox = document.getElementById('quiz-container-box');

// Toast
const levelUpToast = document.getElementById('level-up-toast-notification');
const toastLevelVal = document.getElementById('toast-level-val');

// --- Global SPA State ---
let currentWizardStep = 1;
let currentQuizQuestionIndex = 0;
let currentQuizQuestions = [];
let currentQuizScore = 0;
let selectedQuizAnswer = null;

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupNavigation();
  setupWizard();
  setupLogger();
  setupGoalSelection();
  renderApp();
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('ecosync_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ecosync_theme', newTheme);
    updateThemeUI(newTheme);
  });
}

function updateThemeUI(theme) {
  if (theme === 'light') {
    themeIcon.className = 'fa-solid fa-sun';
    themeIcon.style.color = '#e2e8f0';
    themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
  } else {
    themeIcon.className = 'fa-solid fa-moon';
    themeIcon.style.color = '';
    themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
  }
}

// --- Navigation Tabs ---
function setupNavigation() {
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-target');
      
      navTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      sections.forEach(s => s.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetSec = document.getElementById(`sec-${target}`);
      if (targetSec) {
        targetSec.classList.add('active');
      }

      // Re-trigger dynamic rendering to make sure updates are fresh
      renderApp();
    });
  });
}

// --- Render Core UI ---
function renderApp() {
  const state = Tracker.loadState();
  
  // 1. Header & Level badges
  headerUserLevel.innerText = state.level;
  const xpNeeded = state.level * 100;
  const xpPct = (state.xp / xpNeeded) * 100;
  headerUserXpFill.style.width = `${xpPct}%`;
  document.querySelector('.user-xp-bar-mini').setAttribute('aria-valuenow', Math.round(xpPct));
  
  // 2. Dashboard values
  if (state.footprintResult) {
    const totalTons = state.footprintResult.totalTons;
    dashFootprint.innerText = `${totalTons.toFixed(1)} t`;
    
    // Status color classes and labels
    const comparisons = state.footprintResult.comparisons;
    let trendHtml = '';
    if (comparisons.status === 'low') {
      trendHtml = `<span style="color: var(--accent-primary)"><i class="fa-solid fa-seedling"></i> Target Met (Under 2t)</span>`;
    } else if (comparisons.status === 'medium') {
      trendHtml = `<span style="color: var(--accent-warning)"><i class="fa-solid fa-shield-halved"></i> Global Avg Level</span>`;
    } else {
      trendHtml = `<span style="color: var(--accent-danger)"><i class="fa-solid fa-triangle-exclamation"></i> High (Over 4t)</span>`;
    }
    dashFootprintTrend.innerHTML = trendHtml;
  } else {
    dashFootprint.innerText = '--';
    dashFootprintTrend.innerHTML = '<span>No calculator data</span>';
  }

  // Savings
  dashSaved.innerText = `${state.totalCarbonSaved.toFixed(1)} kg`;
  
  // Goal progress info
  const goalProgress = Tracker.getGoalProgress();
  if (goalProgress) {
    dashGoal.innerText = `${goalProgress.progressPercent}%`;
    dashGoalTrend.innerHTML = `<span>Saved ${goalProgress.currentSavedKg.toFixed(0)} of ${goalProgress.targetReductionKg.toFixed(0)} kg</span>`;
  } else {
    dashGoal.innerText = '0%';
    dashGoalTrend.innerHTML = '<span>No goal active</span>';
  }

  // XP
  dashXp.innerText = `${state.xp} XP`;
  dashXpToNext.innerText = `${xpNeeded - state.xp} XP to Lvl ${state.level + 1}`;

  // 3. Render Dashboard Charts
  renderDonutChart(state);
  renderWeeklyChart(state);

  // 4. Render Daily Activity Log elements
  renderLogHistory(state);

  // 5. Render Goal details & challenges
  renderGoalTrackerCard(goalProgress, state);
  renderChallenges(state);
  renderBadges(state);

  // 6. Render Quiz bank
  renderQuizModule();
}

// --- Render SVG Donut Chart ---
function renderDonutChart(state) {
  // Clear dynamic segments
  const segments = donutChartSvg.querySelectorAll('.chart-ring-segment');
  segments.forEach(s => s.remove());

  if (!state.footprintResult) {
    donutTotalValue.innerText = '0.0';
    donutChartLegend.innerHTML = `
      <div style="grid-column: 1 / span 2; text-align: center; color: var(--text-secondary); font-size:0.85rem; padding-top: 1rem;">
        No emissions data yet. Fill out the <strong>Calculator</strong>!
      </div>
    `;
    return;
  }

  const result = state.footprintResult;
  donutTotalValue.innerText = result.totalTons.toFixed(1);

  const categories = [
    { name: 'Transport', key: 'transport', color: '#10b981' },
    { name: 'Home Energy', key: 'energy', color: '#06b6d4' },
    { name: 'Food/Diet', key: 'food', color: '#a855f7' },
    { name: 'Goods/Waste', key: 'consumption', color: '#f59e0b' }
  ];

  const circumference = 219.91; // 2 * PI * r (35)
  let accumulatedPercent = 0;
  let legendHtml = '';

  categories.forEach(cat => {
    const value = result.breakdown[cat.key];
    const share = result.shares[cat.key];
    const percentageVal = Math.round(share);

    if (percentageVal > 0) {
      // Create SVG circle segment
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '35');
      circle.setAttribute('class', 'chart-ring-segment');
      circle.setAttribute('stroke', cat.color);
      
      const strokeDash = (share / 100) * circumference;
      const strokeOffset = -((accumulatedPercent / 100) * circumference);
      
      circle.setAttribute('stroke-dasharray', `${strokeDash} ${circumference}`);
      circle.setAttribute('stroke-dashoffset', strokeOffset.toString());
      
      donutChartSvg.appendChild(circle);
      accumulatedPercent += share;
    }

    legendHtml += `
      <div class="legend-item">
        <span class="legend-color" style="background:${cat.color}"></span>
        <span>${cat.name}: <strong>${percentageVal}%</strong> (${(value/1000).toFixed(2)} t)</span>
      </div>
    `;
  });

  donutChartLegend.innerHTML = legendHtml;
}

// --- Render SVG Weekly Bar Chart ---
function renderWeeklyChart(state) {
  weeklyBarChart.innerHTML = '';

  if (!state.dailyLogs || state.dailyLogs.length === 0) {
    weeklyBarChart.innerHTML = `
      <div style="text-align: center; width: 100%; color: var(--text-secondary); font-weight: 500;">
        No logged activities. Go to the <strong>Daily Log</strong> tab to log actions!
      </div>
    `;
    return;
  }

  // Get last 7 days inclusive of today
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split('T')[0]);
  }

  // Group log savings by date
  const savingsByDate = {};
  last7Days.forEach(date => {
    savingsByDate[date] = 0;
  });

  state.dailyLogs.forEach(log => {
    if (savingsByDate[log.date] !== undefined) {
      savingsByDate[log.date] += log.co2Saved;
    }
  });

  const maxSaving = Math.max(...Object.values(savingsByDate), 1); // Avoid division by zero

  last7Days.forEach(date => {
    const val = savingsByDate[date];
    const percentageHeight = Math.max(5, (val / maxSaving) * 90); // Min height 5% for visual impact
    
    // Parse nice date label (e.g. "Jun 19")
    const dateObj = new Date(date);
    const label = dateObj.toLocaleDateString(undefined, { weekday: 'short' });

    const barWrapper = document.createElement('div');
    barWrapper.className = 'bar-wrapper';

    const barFill = document.createElement('div');
    barFill.className = 'bar-fill';
    barFill.style.height = `${percentageHeight}%`;
    barFill.setAttribute('tabindex', '0');
    barFill.setAttribute('aria-label', `Saved ${val.toFixed(1)} kg of CO2 on ${label}`);

    const tooltip = document.createElement('span');
    tooltip.className = 'bar-tooltip';
    tooltip.innerText = `${val.toFixed(1)} kg CO₂`;
    barFill.appendChild(tooltip);

    const barLabel = document.createElement('span');
    barLabel.className = 'bar-label';
    barLabel.innerText = label;

    barWrapper.appendChild(barFill);
    barWrapper.appendChild(barLabel);
    weeklyBarChart.appendChild(barWrapper);
  });
}

// --- Calculator Wizard Handling ---
function setupWizard() {
  // Unit toggle influence labels
  calcUnitsSelect.addEventListener('change', (e) => {
    const isImperial = e.target.value === 'imperial';
    carDistLabel.innerText = isImperial ? 'Weekly Car Travel (miles)' : 'Weekly Car Travel (km)';
    publicDistLabel.innerText = isImperial ? 'Weekly Public Transport Travel (miles)' : 'Weekly Public Transport Travel (km)';
  });

  // Next buttons
  document.querySelectorAll('.btn-next-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStep = parseInt(btn.getAttribute('data-next'));
      goToWizardStep(nextStep);
    });
  });

  // Back buttons
  document.querySelectorAll('.btn-prev-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevStep = parseInt(btn.getAttribute('data-prev'));
      goToWizardStep(prevStep);
    });
  });

  // Wizard Step Node Click (allow jumping back to completed steps)
  wizardNodes.forEach(node => {
    node.addEventListener('click', () => {
      const step = parseInt(node.getAttribute('data-step'));
      const state = Tracker.loadState();
      
      // Only allow skipping to steps if calculator already has run, or step <= current step
      if (step <= currentWizardStep || state.footprintResult) {
        goToWizardStep(step);
      }
    });
  });

  // Submit Calculator Form
  footprintForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const unitSystem = calcUnitsSelect.value;
    
    // Package inputs
    const inputs = {
      transport: {
        carDistance: parseFloat(document.getElementById('input-car-dist').value) || 0,
        carFuelType: document.getElementById('input-car-fuel').value,
        publicDistance: parseFloat(document.getElementById('input-public-dist').value) || 0,
        publicType: document.getElementById('input-public-type').value,
        shortFlights: parseFloat(document.getElementById('input-flights-short').value) || 0,
        longFlights: parseFloat(document.getElementById('input-flights-long').value) || 0
      },
      energy: {
        householdSize: parseFloat(document.getElementById('input-household-size').value) || 1,
        electricityKwh: parseFloat(document.getElementById('input-electricity').value) || 0,
        heatingKwh: parseFloat(document.getElementById('input-heating').value) || 0,
        heatingType: document.getElementById('input-heating-type').value
      },
      food: {
        dietType: document.getElementById('input-diet').value
      },
      consumption: {
        shoppingLevel: document.getElementById('input-shopping').value,
        recyclingRate: parseFloat(document.getElementById('input-recycling').value) || 0
      }
    };

    // Calculate footprint result
    const footprint = CarbonCalculator.calculateFootprint(inputs, unitSystem);
    
    // Save to tracker state
    const state = Tracker.loadState();
    state.calculatorInputs = inputs;
    state.footprintResult = footprint;
    
    // Award 100 XP for first calculation
    if (!state.badges.includes('first_step')) {
      const xpRes = Tracker.addXP(state, 100);
      Tracker.saveState(xpRes.state);
      if (xpRes.leveledUp) {
        showLevelUpToast(xpRes.state.level);
      }
    } else {
      Tracker.saveState(state);
    }

    // Unlocking first step badge checks automatically
    const newState = Tracker.loadState();
    Tracker.checkBadges(newState);
    Tracker.saveState(newState);

    // Display step 6 results
    const resultsCo2 = document.getElementById('results-co2-val');
    resultsCo2.innerText = `${footprint.totalTons.toFixed(2)} Tons CO₂e`;

    const resultsComparison = document.getElementById('results-comparison-box');
    let comparisonHtml = '';
    if (footprint.totalTons <= 2.0) {
      comparisonHtml = `
        <p style="color:var(--accent-primary); font-weight:700;"><i class="fa-solid fa-square-poll-vertical"></i> Exceptional!</p>
        <p style="font-size:0.9rem;">Your footprint is <strong>${footprint.comparisons.percentOfTarget.toFixed(0)}%</strong> of the Paris Agreement target (2.0t) and well below the global average (4.0t).</p>
      `;
    } else if (footprint.totalTons <= 4.0) {
      comparisonHtml = `
        <p style="color:var(--accent-warning); font-weight:700;"><i class="fa-solid fa-square-poll-vertical"></i> Good Progress</p>
        <p style="font-size:0.9rem;">Your footprint is <strong>${footprint.comparisons.percentOfGlobalAverage.toFixed(0)}%</strong> of the global average. Aim to cut emissions by another <strong>${Math.round(footprint.comparisons.percentOfTarget - 100)}%</strong> to reach the 2-ton sustainability target.</p>
      `;
    } else {
      comparisonHtml = `
        <p style="color:var(--accent-danger); font-weight:700;"><i class="fa-solid fa-square-poll-vertical"></i> Action Needed</p>
        <p style="font-size:0.9rem;">Your footprint is <strong>${(footprint.totalTons / 4.0).toFixed(1)}x</strong> the global average. Start accepting eco challenges to reduce your footprint.</p>
      `;
    }
    resultsComparison.innerHTML = comparisonHtml;

    goToWizardStep(6);
    renderApp();
  });

  // Range Slider text labels
  const rangeRecycling = document.getElementById('input-recycling');
  const labelRecycling = document.getElementById('recycling-pct-label');
  rangeRecycling.addEventListener('input', (e) => {
    labelRecycling.innerText = `${e.target.value}%`;
  });

  // Recalculate
  btnRecalculate.addEventListener('click', () => {
    currentWizardStep = 1;
    goToWizardStep(1);
  });

  // Go to Dashboard
  btnGoDashboard.addEventListener('click', () => {
    document.getElementById('tab-dashboard').click();
  });
}

function goToWizardStep(step) {
  currentWizardStep = step;

  // Render wizard steps visually
  wizardSteps.forEach(card => {
    card.classList.remove('active');
    if (parseInt(card.getAttribute('data-step')) === step) {
      card.classList.add('active');
      card.setAttribute('tabindex', '-1');
      // Set focus to the active wizard step card to announce changes to assistive technologies
      setTimeout(() => {
        card.focus();
      }, 50);
    }
  });

  // Update nodes
  wizardNodes.forEach(node => {
    const nodeStep = parseInt(node.getAttribute('data-step'));
    node.classList.remove('active', 'completed');
    if (nodeStep === step) {
      node.classList.add('active');
    } else if (nodeStep < step) {
      node.classList.add('completed');
    }
  });

  // Update progress line
  const progressPercent = ((step - 1) / (wizardNodes.length - 1)) * 100;
  wizardProgressBar.style.width = `${progressPercent}%`;
}

// --- Daily Activity Logger ---
function setupLogger() {
  // Generate logger buttons dynamically
  let buttonsHtml = '';
  Object.keys(ECO_ACTIVITIES).forEach(key => {
    const act = ECO_ACTIVITIES[key];
    let iconClass = 'fa-solid fa-bicycle';
    if (act.id === 'public_transit') iconClass = 'fa-solid fa-bus';
    if (act.id === 'meat_free_meal') iconClass = 'fa-solid fa-leaf';
    if (act.id === 'unplug_devices') iconClass = 'fa-solid fa-plug';
    if (act.id === 'recycle_waste') iconClass = 'fa-solid fa-recycle';
    if (act.id === 'reusable_items') iconClass = 'fa-solid fa-bag-shopping';

    buttonsHtml += `
      <button class="activity-btn-card" data-activity-id="${act.id}" type="button">
        <div>
          <div class="activity-icon"><i class="${iconClass}"></i></div>
          <div class="activity-label">${act.label}</div>
          <div class="activity-desc">${act.description}</div>
        </div>
        <div class="activity-reward-badge">
          <i class="fa-solid fa-bolt"></i> +${act.xpAward} XP / ${act.unit}
        </div>
      </button>
    `;
  });
  activitiesButtonGrid.innerHTML = buttonsHtml;

  let lastActiveElement = null;

  // Add click events to open Modal
  activitiesButtonGrid.querySelectorAll('.activity-btn-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const actId = btn.getAttribute('data-activity-id');
      const act = ECO_ACTIVITIES[actId];
      if (act) {
        lastActiveElement = document.activeElement;
        modalActivityId.value = act.id;
        modalTitle.innerText = `Log "${act.label}"`;
        modalDesc.innerText = act.description;
        modalInputLabel.innerText = `Quantity (${act.unit})`;
        modalInputAmount.value = '';
        
        activityLogModal.style.display = 'flex';
        activityLogModal.setAttribute('aria-hidden', 'false');
        modalInputAmount.focus();
      }
    });
  });

  // Close modal
  const closeModalFunc = () => {
    activityLogModal.style.display = 'none';
    activityLogModal.setAttribute('aria-hidden', 'true');
    if (lastActiveElement) {
      lastActiveElement.focus();
    }
  };

  btnCloseModal.addEventListener('click', closeModalFunc);

  // Close modal when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activityLogModal.style.display === 'flex') {
      closeModalFunc();
    }
  });

  // Close modal when clicking on backdrop
  activityLogModal.addEventListener('click', (e) => {
    if (e.target === activityLogModal) {
      closeModalFunc();
    }
  });
  
  // Submit modal logger
  activityLogForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const actId = modalActivityId.value;
    const qty = parseFloat(modalInputAmount.value);

    if (qty > 0) {
      const logRes = Tracker.logActivity(actId, qty);
      closeModalFunc();
      
      if (logRes.leveledUp) {
        showLevelUpToast(logRes.state.level);
      }
      
      // Update alerts or quick success messages
      alert(`Success! Logged action saving ${logRes.carbonSaved.toFixed(1)} kg CO₂ and earned +${logRes.pointsEarned} XP!`);
      
      renderApp();
    }
  });

  // Clear logs button
  btnClearLogs.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all your daily logged activities and carbon history? This does not reset calculator results.')) {
      const state = Tracker.loadState();
      state.dailyLogs = [];
      state.totalCarbonSaved = 0;
      Tracker.saveState(state);
      renderApp();
    }
  });
}

function renderLogHistory(state) {
  activitiesHistoryContainer.innerHTML = '';
  
  if (!state.dailyLogs || state.dailyLogs.length === 0) {
    activitiesHistoryContainer.innerHTML = `
      <div style="text-align:center; padding: 3rem 0; color: var(--text-muted);">
        No activities logged yet. Get started today!
      </div>
    `;
    return;
  }

  // Show reverse-chronological list of daily logs
  const logsReversed = [...state.dailyLogs].reverse();
  
  logsReversed.forEach(log => {
    const act = ECO_ACTIVITIES[log.activityId];
    if (!act) return;

    const row = document.createElement('div');
    row.className = 'history-item';

    row.innerHTML = `
      <div class="history-item-details">
        <span class="history-item-title">${act.label} (${log.amount} ${act.unit})</span>
        <span class="history-item-date">${log.date}</span>
      </div>
      <div class="history-item-stats">
        <span class="history-item-saved">-${log.co2Saved.toFixed(2)} kg CO₂</span>
        <div class="history-item-xp">+${log.xpEarned} XP</div>
      </div>
    `;
    activitiesHistoryContainer.appendChild(row);
  });
}

// --- Action Hub / Goals ---
function setupGoalSelection() {
  document.querySelectorAll('.goal-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle button selection styling
      document.querySelectorAll('.goal-select-btn').forEach(b => b.className = 'btn btn-secondary goal-select-btn');
      btn.className = 'btn btn-primary goal-select-btn';

      const pct = parseInt(btn.getAttribute('data-goal-pct'));
      
      try {
        Tracker.setGoal(pct);
        alert(`Goal Set! Target reduction of ${pct}% saved carbon activated.`);
        renderApp();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

function renderGoalTrackerCard(goalProgress, state) {
  if (!goalProgress) {
    circleProgressFill.style.strokeDashoffset = '251.2';
    goalCirclePercent.innerText = '0%';
    goalStatusText.innerHTML = `
      <p style="margin-bottom:1rem;">Set a reduction goal using the options below or in the Carbon Calculator wizard results screen.</p>
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.5rem;">
        <button class="btn btn-secondary goal-select-btn" data-goal-pct="10">10%</button>
        <button class="btn btn-secondary goal-select-btn" data-goal-pct="20">20%</button>
        <button class="btn btn-secondary goal-select-btn" data-goal-pct="30">30%</button>
        <button class="btn btn-secondary goal-select-btn" data-goal-pct="50">50%</button>
      </div>
    `;
    
    // Bind click events on these temporary goal buttons
    goalStatusText.querySelectorAll('.goal-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseInt(btn.getAttribute('data-goal-pct'));
        try {
          Tracker.setGoal(pct);
          alert(`Goal Set! Target reduction of ${pct}% saved carbon activated.`);
          renderApp();
        } catch (e) {
          alert(e.message);
        }
      });
    });
    return;
  }

  const offset = 251.2 - (goalProgress.progressPercent / 100) * 251.2;
  circleProgressFill.style.strokeDashoffset = offset;
  goalCirclePercent.innerText = `${goalProgress.progressPercent}%`;

  goalStatusText.innerHTML = `
    <p>Targeting a <strong>${goalProgress.targetPercent}% reduction</strong> of your baseline.</p>
    <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.5rem;">
      Baseline: ${(goalProgress.baseFootprintKg/1000).toFixed(1)}t CO₂e | Goal limit: ${(goalProgress.targetFootprintKg/1000).toFixed(1)}t CO₂e<br>
      Total CO₂ offset logged: <strong>${goalProgress.currentSavedKg.toFixed(1)} kg</strong>
    </p>
  `;
}

function renderChallenges(state) {
  challengesContainer.innerHTML = '';
  const challenges = ChallengeManager.getAll();

  challenges.forEach(chal => {
    const isCompleted = state.completedChallenges.includes(chal.id);
    const isActive = state.acceptedChallenges.includes(chal.id);

    const card = document.createElement('div');
    card.className = 'challenge-card';

    let actionButtonsHtml = '';
    if (isCompleted) {
      actionButtonsHtml = `<span style="color:var(--accent-primary); font-weight:700; font-size:0.9rem;"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    } else if (isActive) {
      actionButtonsHtml = `
        <button class="btn btn-primary btn-complete-chal" data-id="${chal.id}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Complete</button>
        <button class="btn btn-secondary btn-abandon-chal" data-id="${chal.id}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Abandon</button>
      `;
    } else {
      actionButtonsHtml = `
        <button class="btn btn-secondary btn-accept-chal" data-id="${chal.id}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Accept</button>
      `;
    }

    card.innerHTML = `
      <div class="challenge-info">
        <div class="challenge-header-row">
          <span class="challenge-title">${chal.title}</span>
          <span class="challenge-badge-tier tier-${chal.tier}">${chal.tier}</span>
        </div>
        <div class="challenge-desc">${chal.description}</div>
        <div class="challenge-rewards">
          <span style="color:var(--accent-primary);"><i class="fa-solid fa-leaf"></i> -${chal.co2Saved} kg CO₂</span>
          <span style="color:var(--accent-warning);"><i class="fa-solid fa-bolt"></i> +${chal.xpReward} XP</span>
          <span style="color:var(--text-muted);"><i class="fa-solid fa-hourglass-half"></i> ${chal.duration}</span>
        </div>
      </div>
      <div class="challenge-actions">
        ${actionButtonsHtml}
      </div>
    `;

    // Hook button event listeners
    const btnAccept = card.querySelector('.btn-accept-chal');
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        ChallengeManager.acceptChallenge(chal.id);
        renderApp();
      });
    }

    const btnAbandon = card.querySelector('.btn-abandon-chal');
    if (btnAbandon) {
      btnAbandon.addEventListener('click', () => {
        ChallengeManager.abandonChallenge(chal.id);
        renderApp();
      });
    }

    const btnComplete = card.querySelector('.btn-complete-chal');
    if (btnComplete) {
      btnComplete.addEventListener('click', () => {
        const res = ChallengeManager.completeChallenge(chal.id);
        if (res.leveledUp) {
          showLevelUpToast(res.state.level);
        }
        alert(`Awesome job! Completed "${chal.title}". Saved ${res.co2Saved} kg carbon and earned +${res.xpReward} XP!`);
        renderApp();
      });
    }

    challengesContainer.appendChild(card);
  });
}

function renderBadges(state) {
  badgesGridContainer.innerHTML = '';

  BADGES.forEach(badge => {
    const isUnlocked = state.badges.includes(badge.id);
    
    const badgeItem = document.createElement('div');
    badgeItem.className = `badge-item ${isUnlocked ? 'unlocked' : ''}`;
    badgeItem.setAttribute('tabindex', '0');
    badgeItem.setAttribute('aria-label', `${badge.name}: ${badge.desc}. ${isUnlocked ? 'Unlocked' : 'Locked'}`);
    
    badgeItem.innerHTML = `
      <div class="badge-circle">${badge.icon}</div>
      <span class="badge-name">${badge.name}</span>
    `;

    // Tooltip trigger on hover/focus
    badgeItem.addEventListener('click', () => {
      alert(`${badge.name}\n${badge.desc}\nStatus: ${isUnlocked ? 'Unlocked' : 'Locked'}`);
    });
    
    badgesGridContainer.appendChild(badgeItem);
  });
}

// --- Educational Quiz Controller ---
function renderQuizModule() {
  const state = Tracker.loadState();

  // If quiz is not in progress, render welcome screen
  if (currentQuizQuestions.length === 0) {
    quizContainerBox.innerHTML = `
      <div class="quiz-welcome-state">
        <p style="color:var(--text-secondary); margin-bottom:1.5rem; font-size:0.9rem;">
          Test your ecological knowledge! Complete our 5-question Eco-Quiz to earn up to +150 XP towards leveling up.
        </p>
        <button class="btn btn-primary" id="btn-start-quiz">Start Quiz <i class="fa-solid fa-play"></i></button>
      </div>
    `;

    document.getElementById('btn-start-quiz').addEventListener('click', () => {
      currentQuizQuestions = QuizManager.getRandomQuiz(5);
      currentQuizQuestionIndex = 0;
      currentQuizScore = 0;
      selectedQuizAnswer = null;
      renderQuizModule();
    });
    return;
  }

  // If quiz completed, render score card
  if (currentQuizQuestionIndex >= currentQuizQuestions.length) {
    const attempt = QuizManager.recordAttempt(currentQuizScore, currentQuizQuestions.length);
    
    quizContainerBox.innerHTML = `
      <div class="quiz-welcome-state">
        <h3 style="font-size:1.35rem; color:var(--accent-primary);">Quiz Complete!</h3>
        <p style="font-size: 2.2rem; font-weight:800; margin:1rem 0;">${currentQuizScore} / ${currentQuizQuestions.length}</p>
        <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:1.5rem;">
          You earned <strong>+${attempt.xpEarned} XP</strong>! ${attempt.isPerfect ? "Perfect score! Quiz Genius Badge Unlocked!" : ""}
        </p>
        <button class="btn btn-secondary" id="btn-restart-quiz"><i class="fa-solid fa-rotate-right"></i> Take Another Quiz</button>
      </div>
    `;

    if (attempt.leveledUp) {
      showLevelUpToast(attempt.state.level);
    }

    document.getElementById('btn-restart-quiz').addEventListener('click', () => {
      currentQuizQuestions = [];
      renderQuizModule();
    });
    return;
  }

  // Active quiz render
  const questionObj = currentQuizQuestions[currentQuizQuestionIndex];
  
  let optionsHtml = '';
  questionObj.options.forEach((opt, idx) => {
    let btnClass = 'quiz-option-btn';
    if (selectedQuizAnswer !== null) {
      if (idx === questionObj.correctAnswerIndex) {
        btnClass += ' correct';
      } else if (idx === selectedQuizAnswer) {
        btnClass += ' incorrect';
      }
    }
    optionsHtml += `
      <button class="${btnClass}" data-idx="${idx}" ${selectedQuizAnswer !== null ? 'disabled' : ''} type="button">
        ${opt}
      </button>
    `;
  });

  let feedbackHtml = '';
  if (selectedQuizAnswer !== null) {
    feedbackHtml = `
      <div class="quiz-explanation">
        <strong>${selectedQuizAnswer === questionObj.correctAnswerIndex ? 'Correct!' : 'Incorrect!'}</strong> ${questionObj.explanation}
      </div>
      <button class="btn btn-primary" id="btn-next-quiz-q" style="margin-top:1.2rem; width:100%;">
        ${currentQuizQuestionIndex === currentQuizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'} <i class="fa-solid fa-arrow-right"></i>
      </button>
    `;
  }

  quizContainerBox.innerHTML = `
    <div class="quiz-active-state">
      <div class="quiz-progress-text">Question ${currentQuizQuestionIndex + 1} of ${currentQuizQuestions.length}</div>
      <div class="quiz-question-box">${questionObj.question}</div>
      <div class="quiz-options-container">
        ${optionsHtml}
      </div>
      ${feedbackHtml}
    </div>
  `;

  // Option select click events
  quizContainerBox.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      selectedQuizAnswer = idx;
      if (idx === questionObj.correctAnswerIndex) {
        currentQuizScore++;
      }
      renderQuizModule();
    });
  });

  // Next question click event
  const btnNext = document.getElementById('btn-next-quiz-q');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentQuizQuestionIndex++;
      selectedQuizAnswer = null;
      renderQuizModule();
    });
  }
}

// --- Toast Level Up Alert ---
function showLevelUpToast(levelNum) {
  toastLevelVal.innerText = levelNum;
  levelUpToast.classList.add('show');
  setTimeout(() => {
    levelUpToast.classList.remove('show');
  }, 4500);
}
