/**
 * EcoSync Carbon Calculator Core
 * Contains emission factors and formulas based on IPCC and EPA guidelines.
 */

export const EMISSION_FACTORS = {
  car: {
    gasoline: 0.192,    // kg CO2e / km
    diesel: 0.171,      // kg CO2e / km
    hybrid: 0.109,      // kg CO2e / km
    electric: 0.047     // kg CO2e / km (average electricity mix)
  },
  publicTransport: {
    bus: 0.089,         // kg CO2e / km
    train: 0.035        // kg CO2e / km (subway, light rail, trains)
  },
  flight: {
    short: 0.254,       // kg CO2e / km (< 1500 km)
    long: 0.195         // kg CO2e / km (>= 1500 km)
  },
  electricity: 0.385,   // kg CO2e / kWh (standard grid average)
  heating: {
    gas: 0.181,         // kg CO2e / kWh
    oil: 0.264,         // kg CO2e / kWh
    biomass: 0.015,     // kg CO2e / kWh
    lpg: 0.214,         // kg CO2e / kWh
    electricity: 0.385  // kg CO2e / kWh
  },
  diet: {
    heavyMeat: 2900,    // kg CO2e / year
    averageMeat: 2000,  // kg CO2e / year
    vegetarian: 1300,   // kg CO2e / year
    vegan: 800          // kg CO2e / year
  },
  consumption: {
    high: 2200,         // kg CO2e / year
    average: 1100,      // kg CO2e / year
    low: 400            // kg CO2e / year
  }
};

export const UNIT_CONVERSIONS = {
  mileToKm: 1.60934,
  lbToKg: 0.453592
};

function safeParseFloat(val, fallback = 0) {
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) || parsed < 0 ? fallback : parsed;
}

export class CarbonCalculator {
  /**
   * Calculate transport emissions in kg CO2 per year
   * @param {Object} transportInputs 
   * @param {string} unit - 'metric' or 'imperial'
   */
  static calculateTransport(inputs, unit = 'metric') {
    const isImperial = unit === 'imperial';
    const conversion = isImperial ? UNIT_CONVERSIONS.mileToKm : 1;

    // Car calculations
    const carDistanceWeekly = safeParseFloat(inputs.carDistance, 0);
    const carDistanceAnnual = carDistanceWeekly * 52 * conversion; // convert weekly to annual
    const carFuelType = inputs.carFuelType || 'gasoline';
    const carFactor = EMISSION_FACTORS.car[carFuelType] || EMISSION_FACTORS.car.gasoline;
    const carEmissions = carDistanceAnnual * carFactor;

    // Public transport calculations
    const publicDistanceWeekly = safeParseFloat(inputs.publicDistance, 0);
    const publicDistanceAnnual = publicDistanceWeekly * 52 * conversion;
    const publicType = inputs.publicType || 'bus';
    const publicFactor = EMISSION_FACTORS.publicTransport[publicType] || EMISSION_FACTORS.publicTransport.bus;
    const publicEmissions = publicDistanceAnnual * publicFactor;

    // Flight calculations (short/long are already annual estimates or hours, we ask for annual flights)
    const shortFlightsCount = safeParseFloat(inputs.shortFlights, 0);
    // Assume average short flight is 800 km
    const shortFlightEmissions = shortFlightsCount * 800 * EMISSION_FACTORS.flight.short;

    const longFlightsCount = safeParseFloat(inputs.longFlights, 0);
    // Assume average long flight is 5000 km
    const longFlightEmissions = longFlightsCount * 5000 * EMISSION_FACTORS.flight.long;

    return carEmissions + publicEmissions + shortFlightEmissions + longFlightEmissions;
  }

  /**
   * Calculate home energy emissions in kg CO2 per year
   * @param {Object} inputs 
   */
  static calculateHomeEnergy(inputs) {
    const householdSize = Math.max(1, safeParseFloat(inputs.householdSize, 1));
    const electricityMonthly = safeParseFloat(inputs.electricityKwh, 0);
    const electricityAnnual = (electricityMonthly * 12) * EMISSION_FACTORS.electricity;

    const heatingMonthly = safeParseFloat(inputs.heatingKwh, 0);
    const heatingType = inputs.heatingType || 'gas';
    const heatingFactor = EMISSION_FACTORS.heating[heatingType] || EMISSION_FACTORS.heating.gas;
    const heatingAnnual = (heatingMonthly * 12) * heatingFactor;

    // Emissions are shared among household members
    return (electricityAnnual + heatingAnnual) / householdSize;
  }

  /**
   * Calculate food emissions in kg CO2 per year
   * @param {Object} inputs 
   */
  static calculateFood(inputs) {
    const dietType = inputs.dietType || 'averageMeat';
    return EMISSION_FACTORS.diet[dietType] || EMISSION_FACTORS.diet.averageMeat;
  }

  /**
   * Calculate consumption and waste emissions in kg CO2 per year
   * @param {Object} inputs 
   */
  static calculateConsumption(inputs) {
    const shoppingLevel = inputs.shoppingLevel || 'average';
    const baseEmissions = EMISSION_FACTORS.consumption[shoppingLevel] || EMISSION_FACTORS.consumption.average;
    
    // Recycling reduction (up to 20% reduction on waste footprint)
    const recyclingRate = Math.min(100, safeParseFloat(inputs.recyclingRate, 0)); // 0 to 100
    const reductionFactor = 1 - (0.2 * (recyclingRate / 100));

    return baseEmissions * reductionFactor;
  }

  /**
   * Calculate full breakdown and annual totals
   * @param {Object} inputs - contains category sub-objects
   * @param {string} unit - 'metric' or 'imperial'
   * @returns {Object} breakdown and statistics
   */
  static calculateFootprint(inputs, unit = 'metric') {
    const transport = this.calculateTransport(inputs.transport || {}, unit);
    const energy = this.calculateHomeEnergy(inputs.energy || {});
    const food = this.calculateFood(inputs.food || {});
    const consumption = this.calculateConsumption(inputs.consumption || {});

    const totalKg = transport + energy + food + consumption;
    const totalTons = totalKg / 1000;

    // Comparisons
    const globalAverageTons = 4.0; // 4 tons
    const regionalTargetTons = 2.0; // 2 tons (Paris Agreement target)

    const percentOfGlobalAverage = (totalTons / globalAverageTons) * 100;
    const percentOfTarget = (totalTons / regionalTargetTons) * 100;

    return {
      totalKg,
      totalTons,
      breakdown: {
        transport: Math.round(transport),
        energy: Math.round(energy),
        food: Math.round(food),
        consumption: Math.round(consumption)
      },
      shares: {
        transport: totalKg > 0 ? (transport / totalKg) * 100 : 0,
        energy: totalKg > 0 ? (energy / totalKg) * 100 : 0,
        food: totalKg > 0 ? (food / totalKg) * 100 : 0,
        consumption: totalKg > 0 ? (consumption / totalKg) * 100 : 0
      },
      comparisons: {
        globalAverageTons,
        regionalTargetTons,
        percentOfGlobalAverage,
        percentOfTarget,
        status: totalTons <= regionalTargetTons ? 'low' : totalTons <= globalAverageTons ? 'medium' : 'high'
      }
    };
  }
}
