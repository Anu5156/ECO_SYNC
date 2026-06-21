/**
 * @module calculator
 * @description EcoSync Carbon Calculator Core.
 * Contains emission factors and computation formulas based on IPCC and EPA guidelines.
 * All calculations return annual kg CO2 equivalent (CO2e) values.
 */

// ---------------------------------------------------------------------------
// Named constants — no magic numbers in logic functions
// ---------------------------------------------------------------------------

/** Weeks in one calendar year. */
const WEEKS_PER_YEAR = 52;

/** Months in one calendar year. */
const MONTHS_PER_YEAR = 12;

/** Average short-haul flight distance in km (ICAO benchmark). */
const AVG_SHORT_FLIGHT_KM = 800;

/** Average long-haul flight distance in km (ICAO benchmark). */
const AVG_LONG_FLIGHT_KM = 5000;

/** Global average annual carbon footprint per person in metric tons CO2e (IPCC). */
const GLOBAL_AVERAGE_TONS = 4.0;

/** Paris Agreement 2050 individual carbon budget target in metric tons CO2e. */
const PARIS_TARGET_TONS = 2.0;

/** Maximum percentage allowed for recycling reduction factor input (0–100%). */
const MAX_RECYCLING_PERCENT = 100;

/** Maximum CO2 reduction fraction achievable through recycling (20%). */
const RECYCLING_MAX_REDUCTION = 0.2;

/** Conversion factor: kilograms to metric tons. */
const KG_TO_TONS = 1000;

// ---------------------------------------------------------------------------
// Emission factors (source: IPCC AR6, EPA eGRID 2023)
// ---------------------------------------------------------------------------

/**
 * Emission factors by category and sub-type.
 * Units are annotated per property.
 *
 * @type {Object}
 */
export const EMISSION_FACTORS = {
  car: {
    gasoline:   0.192, // kg CO2e / km
    diesel:     0.171, // kg CO2e / km
    hybrid:     0.109, // kg CO2e / km
    electric:   0.047  // kg CO2e / km (average electricity mix)
  },
  publicTransport: {
    bus:   0.089, // kg CO2e / km
    train: 0.035  // kg CO2e / km (subway, light rail, intercity rail)
  },
  flight: {
    short: 0.254, // kg CO2e / km (< 1500 km)
    long:  0.195  // kg CO2e / km (>= 1500 km)
  },
  electricity: 0.385, // kg CO2e / kWh (standard grid average)
  heating: {
    gas:         0.181, // kg CO2e / kWh
    oil:         0.264, // kg CO2e / kWh
    biomass:     0.015, // kg CO2e / kWh
    lpg:         0.214, // kg CO2e / kWh
    electricity: 0.385  // kg CO2e / kWh
  },
  diet: {
    heavyMeat:   2900, // kg CO2e / year
    averageMeat: 2000, // kg CO2e / year
    vegetarian:  1300, // kg CO2e / year
    vegan:        800  // kg CO2e / year
  },
  consumption: {
    high:    2200, // kg CO2e / year
    average: 1100, // kg CO2e / year
    low:      400  // kg CO2e / year
  }
};

/**
 * Unit conversion factors.
 *
 * @type {{ mileToKm: number, lbToKg: number }}
 */
export const UNIT_CONVERSIONS = {
  mileToKm:  1.60934,
  lbToKg:    0.453592
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a value to a non-negative finite float.
 * Returns `fallback` when the parsed result is NaN, infinite, or negative.
 *
 * @param {*}      val      - Value to parse.
 * @param {number} [fallback=0] - Default value when parsing fails.
 * @returns {number} A valid, non-negative, finite number.
 */
function safeParseFloat(val, fallback = 0) {
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) || parsed < 0 ? fallback : parsed;
}

// ---------------------------------------------------------------------------
// CarbonCalculator class
// ---------------------------------------------------------------------------

/**
 * Provides static methods to calculate annual carbon footprints
 * across transport, energy, food, and consumption categories.
 */
export class CarbonCalculator {
  /**
   * Calculate annual transport emissions in kg CO2e.
   *
   * @param {Object} inputs                     - Transport input values.
   * @param {number} [inputs.carDistance=0]     - Weekly car driving distance (km or miles).
   * @param {string} [inputs.carFuelType='gasoline'] - Car fuel type key (see EMISSION_FACTORS.car).
   * @param {number} [inputs.publicDistance=0]  - Weekly public-transport distance (km or miles).
   * @param {string} [inputs.publicType='bus']  - Public transport type key.
   * @param {number} [inputs.shortFlights=0]    - Annual count of short-haul flights (< 1500 km).
   * @param {number} [inputs.longFlights=0]     - Annual count of long-haul flights (>= 1500 km).
   * @param {string} [unit='metric']            - Unit system: 'metric' (km) or 'imperial' (miles).
   * @returns {number} Annual kg CO2e from all transport sources.
   */
  static calculateTransport(inputs, unit = 'metric') {
    const distanceConversion = unit === 'imperial' ? UNIT_CONVERSIONS.mileToKm : 1;

    // Personal vehicle
    const carDistanceAnnual = safeParseFloat(inputs.carDistance) * WEEKS_PER_YEAR * distanceConversion;
    const carFuelType = inputs.carFuelType || 'gasoline';
    const carFactor = EMISSION_FACTORS.car[carFuelType] ?? EMISSION_FACTORS.car.gasoline;
    const carEmissions = carDistanceAnnual * carFactor;

    // Public transport
    const publicDistanceAnnual = safeParseFloat(inputs.publicDistance) * WEEKS_PER_YEAR * distanceConversion;
    const publicType = inputs.publicType || 'bus';
    const publicFactor = EMISSION_FACTORS.publicTransport[publicType] ?? EMISSION_FACTORS.publicTransport.bus;
    const publicEmissions = publicDistanceAnnual * publicFactor;

    // Flights (annual count × average distance × emission factor)
    const shortFlightEmissions = safeParseFloat(inputs.shortFlights) * AVG_SHORT_FLIGHT_KM * EMISSION_FACTORS.flight.short;
    const longFlightEmissions  = safeParseFloat(inputs.longFlights)  * AVG_LONG_FLIGHT_KM  * EMISSION_FACTORS.flight.long;

    return carEmissions + publicEmissions + shortFlightEmissions + longFlightEmissions;
  }

  /**
   * Calculate annual home-energy emissions in kg CO2e, divided by household size.
   *
   * @param {Object} inputs                        - Home energy input values.
   * @param {number} [inputs.householdSize=1]      - Number of people sharing the utility bills.
   * @param {number} [inputs.electricityKwh=0]     - Monthly electricity consumption (kWh).
   * @param {number} [inputs.heatingKwh=0]         - Monthly heating energy consumption (kWh).
   * @param {string} [inputs.heatingType='gas']    - Heating fuel type key (see EMISSION_FACTORS.heating).
   * @returns {number} Annual kg CO2e attributed to this individual.
   */
  static calculateHomeEnergy(inputs) {
    const householdSize = Math.max(1, safeParseFloat(inputs.householdSize, 1));

    const electricityAnnual =
      safeParseFloat(inputs.electricityKwh) * MONTHS_PER_YEAR * EMISSION_FACTORS.electricity;

    const heatingType = inputs.heatingType || 'gas';
    const heatingFactor = EMISSION_FACTORS.heating[heatingType] ?? EMISSION_FACTORS.heating.gas;
    const heatingAnnual = safeParseFloat(inputs.heatingKwh) * MONTHS_PER_YEAR * heatingFactor;

    return (electricityAnnual + heatingAnnual) / householdSize;
  }

  /**
   * Return annual food-related emissions in kg CO2e based on diet type.
   *
   * @param {Object} inputs                          - Food input values.
   * @param {string} [inputs.dietType='averageMeat'] - Diet type key (see EMISSION_FACTORS.diet).
   * @returns {number} Annual kg CO2e from dietary choices.
   */
  static calculateFood(inputs) {
    const dietType = inputs.dietType || 'averageMeat';
    return EMISSION_FACTORS.diet[dietType] ?? EMISSION_FACTORS.diet.averageMeat;
  }

  /**
   * Calculate annual consumption and waste emissions in kg CO2e.
   * Recycling rate reduces the base footprint by up to 20%.
   *
   * @param {Object} inputs                         - Consumption input values.
   * @param {string} [inputs.shoppingLevel='average'] - Shopping intensity key (see EMISSION_FACTORS.consumption).
   * @param {number} [inputs.recyclingRate=0]       - Recycling rate as a percentage (0–100).
   * @returns {number} Annual kg CO2e from goods and waste.
   */
  static calculateConsumption(inputs) {
    const shoppingLevel = inputs.shoppingLevel || 'average';
    const baseEmissions = EMISSION_FACTORS.consumption[shoppingLevel] ?? EMISSION_FACTORS.consumption.average;

    const recyclingPercent = Math.min(MAX_RECYCLING_PERCENT, safeParseFloat(inputs.recyclingRate));
    const reductionFactor = 1 - RECYCLING_MAX_REDUCTION * (recyclingPercent / MAX_RECYCLING_PERCENT);

    return baseEmissions * reductionFactor;
  }

  /**
   * Calculate a complete annual carbon footprint with category breakdown.
   *
   * @param {Object} inputs              - Nested input object.
   * @param {Object} [inputs.transport]  - Transport inputs (passed to calculateTransport).
   * @param {Object} [inputs.energy]     - Energy inputs (passed to calculateHomeEnergy).
   * @param {Object} [inputs.food]       - Food inputs (passed to calculateFood).
   * @param {Object} [inputs.consumption] - Consumption inputs (passed to calculateConsumption).
   * @param {string} [unit='metric']     - Unit system: 'metric' or 'imperial'.
   * @returns {{
   *   totalKg: number,
   *   totalTons: number,
   *   breakdown: { transport: number, energy: number, food: number, consumption: number },
   *   shares: { transport: number, energy: number, food: number, consumption: number },
   *   comparisons: { globalAverageTons: number, regionalTargetTons: number,
   *                  percentOfGlobalAverage: number, percentOfTarget: number, status: string }
   * }} Full footprint result object.
   */
  static calculateFootprint(inputs, unit = 'metric') {
    const transport   = this.calculateTransport(inputs.transport   || {}, unit);
    const energy      = this.calculateHomeEnergy(inputs.energy     || {});
    const food        = this.calculateFood(inputs.food             || {});
    const consumption = this.calculateConsumption(inputs.consumption || {});

    const totalKg   = transport + energy + food + consumption;
    const totalTons = totalKg / KG_TO_TONS;

    /** @param {number} part */
    const shareOf = (part) => (totalKg > 0 ? (part / totalKg) * 100 : 0);

    return {
      totalKg,
      totalTons,
      breakdown: {
        transport:   Math.round(transport),
        energy:      Math.round(energy),
        food:        Math.round(food),
        consumption: Math.round(consumption)
      },
      shares: {
        transport:   shareOf(transport),
        energy:      shareOf(energy),
        food:        shareOf(food),
        consumption: shareOf(consumption)
      },
      comparisons: {
        globalAverageTons:      GLOBAL_AVERAGE_TONS,
        regionalTargetTons:     PARIS_TARGET_TONS,
        percentOfGlobalAverage: (totalTons / GLOBAL_AVERAGE_TONS) * 100,
        percentOfTarget:        (totalTons / PARIS_TARGET_TONS)   * 100,
        status: totalTons <= PARIS_TARGET_TONS
          ? 'low'
          : totalTons <= GLOBAL_AVERAGE_TONS
            ? 'medium'
            : 'high'
      }
    };
  }
}
