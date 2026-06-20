# EcoSync - Carbon Footprint Tracker & Action Hub

EcoSync is a premium, client-side, interactive Single Page Application (SPA) designed to help individuals understand, track, and reduce their carbon footprint through simple actions, gamified progressions, and personalized insights.

## 🌟 Chosen Vertical

**Personal Environmental Sustainability & Gamified Habit Formation**

The challenge of climate change is often abstract and hard for individuals to relate to their daily choices. EcoSync bridge this gap by bringing carbon footprint calculation, daily log actions, active challenges, and education under one integrated dashboard. By applying gamification mechanics (XP, levels, and achievement badges), it turns carbon tracking from a chore into a rewarding habit.

---

## 🛠️ Technical Approach & Logic

### 1. Emission Calculation Logic
The calculation engine is based on standard scientific guidelines from the **Intergovernmental Panel on Climate Change (IPCC)** and **Environmental Protection Agency (EPA)**.
- **Transportation**: Extrapolates weekly vehicle and transit travel to annual distances, factoring in fuel types (gasoline, diesel, hybrid, electric) and transit modes (bus, train). Includes flight emissions (short vs. long-haul flights).
- **Home Energy**: Computes monthly electricity and heating usage, adjusts based on the heating source fuel type, and divides the total emissions among household members to calculate the individual share.
- **Diet & Consumption**: Uses benchmarked annual emission factors for dietary profiles (vegan, vegetarian, meat-rich) and consumption behavior (minimalist, average, high) offset by household recycling rate.

### 2. Gamification & Progression Engine
- **Leveling Curve**: A custom arithmetic progression is implemented where each level $L$ requires $L \times 100\text{ XP}$ to level up. This provides a gradual and engaging progression.
- **Badges**: Unlocked dynamically based on achievements:
  - Completing the initial assessment.
  - Reaching milestone levels (Levels 5 and 10).
  - Reaching carbon savings milestones (50 kg and 200 kg).
  - Scoring 100% on the Eco-Quiz.
  - Completing 5 active challenges.

### 3. Client-Side SPA Architecture
Built strictly with vanilla CSS, modern HTML5, and ES6 Javascript. Data is persisted securely in local browser storage (`localStorage`), meaning no user data ever leaves their device, satisfying strict privacy compliance.

---

## 🚀 How the Solution Works

1. **Baseline Assessment (Calculator Wizard)**:
   A clean, accessible multi-step form allows users to enter transportation, heating, electricity, diet, and consumption metrics. It immediately produces an annual emission footprint, compares it to the **2-ton Paris Agreement target**, and labels the user's status (`low`, `medium`, `high`).
2. **Personalized Goals**:
   After the assessment, users select a carbon reduction goal (10%, 20%, 30%, or 50% reduction). A circular gauge tracks progress in real-time as activities are logged.
3. **Daily Action Logger**:
   Users record positive daily choices (e.g., walking, taking transit, meat-free meals, recycling). These actions offset carbon from their baseline and award XP.
4. **Gamified Challenges**:
   Users can browse and accept easy, medium, and hard challenges (e.g., "Veggie Power" for 1 day, or "Pedal & Rail" for 30 days) to earn large XP rewards and achieve massive offsets.
5. **Eco-Quiz & Library**:
   Users learn key environmental terms (Scopes 1, 2, 3, etc.) through articles in the Eco-Library and can test their knowledge in the interactive Eco-Quiz module to earn bonus XP.

---

## 📐 Assumptions Made

- **Extrapolation**: Weekly transit averages and monthly energy utility values are assumed to represent consistent annual habits (multiplied by 52 and 12, respectively).
- **Emission Averages**: Carbon calculations utilize average grid emissions and average car consumption models (e.g., a standard passenger car emits roughly $0.192\text{ kg CO}_2\text{e/km}$ gasoline).
- **Static Baseline**: Setting a new baseline (re-assessment) overrides the old footprint target. The daily log saves are maintained but the active goal limit resets to the new baseline.
- **Single Device Storage**: Since data is saved strictly in `localStorage`, the state is tied to the current browser/device.

---

## 🛠️ Verification, Tests & Compliance

### Evaluation Parameters Addressed:
1. **Code Quality**: Structured into clear module files (`js/calculator.js`, `js/tracker.js`, `js/challenges.js`, `js/quiz.js`, `js/app.js`) with complete JSDoc comments.
2. **Security**: Inputs are heavily sanitized. The calculator and logger reject negative numbers, `NaN`, and `Infinity` to protect against state corruption. Custom SVG rendering uses standard safely populated attributes.
3. **Efficiency**: Under 10MB total repository size by using a strict `.gitignore` to exclude `node_modules` and testing artifacts. Calculations execute in $\mathcal{O}(1)$ time.
4. **Testing**: 13 unit tests written using **Jest** covering mathematical precision, leveling curves, challenge transition, quiz bonuses, and security sanitization. Run `npm test` to execute.
5. **Accessibility**: Aligned with **WCAG 2.1 AA** guidelines:
   - Full keyboard navigation focus rings (`:focus-visible`).
   - Accessible skip-links.
   - Screen-reader tags (`aria-live`, `role="tab"`, `aria-selected`).
   - Programmatic focus shifting to active sections/modals.
   - Keyboard Escape key & backdrop click support to close active overlays.
6. **Problem Alignment**: Directly targets individual awareness, habits, actions, and education in personal sustainability.
