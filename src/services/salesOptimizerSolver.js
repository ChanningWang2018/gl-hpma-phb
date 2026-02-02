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

static lpKnapsack(items, budget, strategy = 'minimize_stock') {
    if (items.length === 0 || budget <= 0) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    const validItems = items.filter(
      (item) => item.price > 0 && item.price <= budget
    );
    if (validItems.length === 0) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    // Stage 1: Find optimal value
    const stage1Model = {
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
      
      stage1Model.variables[varName] = {
        totalValue: item.price,
        budget: item.price,
        [maxCountVarName]: 1
      };
      
      stage1Model.constraints[maxCountVarName] = { max: item.count };
      stage1Model.ints[varName] = 1;
    }

    const stage1Result = solver.Solve(stage1Model);

    if (!stage1Result.feasible) {
      return { items: [], totalValue: 0, remaining: budget };
    }

    // Get optimal value from Stage 1
    const optimalValue = Math.round(stage1Result.result);

    // Stage 2: Optimize item count with fixed optimal value
    const stage2Model = {
      optimize: 'itemCount',
      opType: strategy === 'minimize_stock' ? 'max' : 'min',
      constraints: {
        budget: { max: budget },
        totalValue: { min: optimalValue - 0.01 } // Allow tiny floating point tolerance
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
      
      stage2Model.variables[varName] = {
        itemCount: 1,
        totalValue: item.price,
        budget: item.price,
        [maxCountVarName]: 1
      };
      
      stage2Model.constraints[maxCountVarName] = { max: item.count };
      stage2Model.ints[varName] = 1;
    }

    const stage2Result = solver.Solve(stage2Model);

    if (!stage2Result.feasible) {
      // Fallback to Stage 1 result if Stage 2 fails
      const selectedItems = [];
      for (let i = 0; i < validItems.length; i++) {
        const varName = `item_${i}`;
        const selectedCount = Math.round(stage1Result[varName]);
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

    // Extract solution from Stage 2
    const selectedItems = [];
    for (let i = 0; i < validItems.length; i++) {
      const varName = `item_${i}`;
      const selectedCount = Math.round(stage2Result[varName]);
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

      const solution = this.lpKnapsack(inventoryItems, budget, strategy || 'minimize_stock');

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
