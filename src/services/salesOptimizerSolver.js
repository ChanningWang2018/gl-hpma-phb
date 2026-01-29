import SalesOptimizerLoader from "./salesOptimizerLoader.js";
import solver from "javascript-lp-solver";

export default class SalesOptimizerSolver {
  static calculateAdjustedPrices(
    baseItems,
    currency,
    plantsRate,
    dishesRate,
    talentBonus,
  ) {
    const prices = {};

    for (const item of baseItems) {
      if (item[currency] <= 0) continue;

      const rateMultiplier =
        item.type === "plants" ? 1 + plantsRate : 1 + dishesRate;
      let adjustedPrice;

      if (item.type === "plants") {
        adjustedPrice = Math.floor(item[currency] * rateMultiplier);
      } else {
        const talentMultiplier = 1 + talentBonus / 100;
        adjustedPrice = Math.floor(
          item[currency] * rateMultiplier * talentMultiplier,
        );
      }

      const key = `${item.name}_${item.tier}`;
      prices[key] = adjustedPrice;
    }

    return prices;
  }

static generateInventoryItems(
    selectedPlants,
    selectedDishes,
    inventory,
    hvaSet,
    adjustedPrices,
    currency,
  ) {
    const items = [];

    for (const plantName of selectedPlants) {
      const plantTiers = SalesOptimizerLoader.getPlantTiers();
      for (const tier of plantTiers) {
        const count = parseInt(inventory[`${plantName}_${tier}`] || 0, 10);
        if (count <= 0) continue;

        const price = adjustedPrices[`${plantName}_${tier}`] || 0;
        const isHVA = hvaSet.has(`${plantName}_${tier}`);

        items.push({
          name: plantName,
          tier,
          type: "plants",
          price,
          count,
          isHVA,
        });
      }
    }

    for (const dishName of selectedDishes) {
      const dishTiers = SalesOptimizerLoader.getDishTiers();
      for (const tier of dishTiers) {
        const count = parseInt(inventory[`${dishName}_${tier}`] || 0, 10);
        if (count <= 0) continue;

        const price = adjustedPrices[`${dishName}_${tier}`] || 0;
        const isHVA = hvaSet.has(`${dishName}_${tier}`);

        items.push({
          name: dishName,
          tier,
          type: "dishes",
          price,
          count,
          isHVA,
        });
      }
    }

    return items;
  }

static lpKnapsack(items, budget) {
    if (items.length === 0 || budget <= 0) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    const validItems = items.filter(
      (item) => item.price > 0 && item.price <= budget
    );
    if (validItems.length === 0) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    const model = {
      optimize: 'totalValue',
      opType: 'max',
      constraints: {
        budget: { max: budget }
      },
      variables: {},
      ints: {},
      timeout: 3000,
      tolerance: 1e-10
    };

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const varName = `item_${i}`;
      const maxCountVarName = `max_${i}`;
      
      model.variables[varName] = {
        totalValue: item.price,
        budget: item.price,
        [maxCountVarName]: 1
      };
      
      model.constraints[maxCountVarName] = { max: item.count };
      model.ints[varName] = 1;
    }

    const result = solver.Solve(model);

    if (!result.feasible) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    const selectedItems = [];
    for (let i = 0; i < validItems.length; i++) {
      const varName = `item_${i}`;
      const selectedCount = Math.round(result[varName]);
      if (selectedCount > 0) {
        const item = validItems[i];
        for (let k = 0; k < selectedCount; k++) {
          selectedItems.push({
            name: item.name,
            tier: item.tier,
            type: item.type,
            price: item.price,
            isHVA: item.isHVA
          });
        }
      }
    }

    const totalValue = selectedItems.reduce((sum, item) => sum + item.price, 0);

    return {
      items: selectedItems,
      totalValue,
      remaining: budget - totalValue
    };
  }

  static groupResults(items) {
    const grouped = {};

    for (const item of items) {
      const key = `${item.name}_${item.tier}`;
      if (!grouped[key]) {
        grouped[key] = {
          name: item.name,
          tier: item.tier,
          price: item.price,
          count: 0,
          type: item.type,
        };
      }
      grouped[key].count++;
    }

    const result = {
      itemCount: items.length,
      solution: Object.values(grouped).sort((a, b) => b.price - a.price),
    };

    return result;
  }

  static async solve(params) {
    const {
      budget,
      strategy,
      inventory,
      currency,
      plantsRate,
      dishesRate,
      talentBonus,
      selectedPlants,
      selectedDishes,
    } = params;

    try {
      const plantsData = await SalesOptimizerLoader.loadPlantsData();
      const dishesData = await SalesOptimizerLoader.loadDishesData();

      const allItems = [...plantsData, ...dishesData];
      const currencyItems = allItems.filter((item) => item[currency] > 0);

      const adjustedPrices = this.calculateAdjustedPrices(
        currencyItems,
        currency,
        plantsRate,
        dishesRate,
        talentBonus,
      );

const inventoryItems = this.generateInventoryItems(
        selectedPlants,
        selectedDishes,
        inventory,
        new Set(),
        adjustedPrices,
        currency,
      );

      if (inventoryItems.length === 0) {
        return {
          totalValue: 0,
          totalCount: 0,
          remainingBudget: budget,
          solution: [],
        };
      }

      const solution = this.lpKnapsack(inventoryItems, budget);

      const groupedResults = this.groupResults(solution.items);

      return {
        totalValue: solution.totalValue,
        totalCount: solution.items.length,
        remainingBudget: solution.remaining,
        solution: groupedResults.solution,
        itemCount: groupedResults.itemCount,
      };
    } catch (error) {
      console.error("Solver error:", error);
      throw error;
    }
  }
}
