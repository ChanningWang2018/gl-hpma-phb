import { describe, it, expect, beforeAll } from 'vitest';
import SalesOptimizerSolver from '../../src/services/salesOptimizerSolver.js';
import SalesOptimizerLoader from '../../src/services/salesOptimizerLoader.js';

// Mock test data - simplified version of actual CSV structure
const mockPlantsData = [
  { name: 'rose', tier: 'radiant', gold: 100, gems: 0, type: 'plants' },
  { name: 'rose', tier: 'flourishing', gold: 50, gems: 0, type: 'plants' },
  { name: 'rose', tier: 'hardy', gold: 25, gems: 0, type: 'plants' },
  { name: 'gillyweed', tier: 'radiant', gold: 80, gems: 0, type: 'plants' },
  { name: 'gillyweed', tier: 'flourishing', gold: 40, gems: 0, type: 'plants' },
  { name: 'gillyweed', tier: 'hardy', gold: 20, gems: 0, type: 'plants' },
];

const mockDishesData = [
  { name: 'simple_seared_scallops', tier: 'legendary', gold: 200, gems: 0, type: 'dishes' },
  { name: 'simple_seared_scallops', tier: 'epic', gold: 100, gems: 0, type: 'dishes' },
  { name: 'simple_seared_scallops', tier: 'rare', gold: 50, gems: 0, type: 'dishes' },
  { name: 'saltbaked_shrimp', tier: 'legendary', gold: 150, gems: 0, type: 'dishes' },
  { name: 'saltbaked_shrimp', tier: 'epic', gold: 75, gems: 0, type: 'dishes' },
  { name: 'saltbaked_shrimp', tier: 'rare', gold: 35, gems: 0, type: 'dishes' },
];

describe('SalesOptimizerSolver', () => {
  describe('calculateAdjustedPrices', () => {
    it('should calculate adjusted prices with rate multipliers', () => {
      const baseItems = mockPlantsData.slice(0, 3);
      const prices = SalesOptimizerSolver.calculateAdjustedPrices(
        baseItems,
        'gold',
        1, // +100% plants rate
        0,
        0
      );

      // rose radiant: 100 * (1 + 1) = 200
      expect(prices['rose_radiant']).toBe(200);
      // rose flourishing: 50 * (1 + 1) = 100
      expect(prices['rose_flourishing']).toBe(100);
      // rose hardy: 25 * (1 + 1) = 50
      expect(prices['rose_hardy']).toBe(50);
    });

    it('should calculate adjusted prices with talent bonus for dishes', () => {
      const baseItems = mockDishesData.slice(0, 3);
      const prices = SalesOptimizerSolver.calculateAdjustedPrices(
        baseItems,
        'gold',
        0,
        1, // +100% dishes rate
        50 // +50% talent bonus
      );

      // scallops legendary: 200 * (1 + 1) * (1 + 0.5) = 600
      expect(prices['simple_seared_scallops_legendary']).toBe(600);
      // scallops epic: 100 * (1 + 1) * (1 + 0.5) = 300
      expect(prices['simple_seared_scallops_epic']).toBe(300);
    });

    it('should skip items with zero or negative price', () => {
      const baseItems = [
        { name: 'test', tier: 'radiant', gold: 0, gems: 0, type: 'plants' },
        { name: 'test2', tier: 'flourishing', gold: 50, gems: 0, type: 'plants' },
      ];
      const prices = SalesOptimizerSolver.calculateAdjustedPrices(baseItems, 'gold', 0, 0, 0);
      
      expect(prices['test_radiant']).toBeUndefined();
      expect(prices['test2_flourishing']).toBe(50);
    });
  });

  describe('generateInventoryItems', () => {
    it('should generate inventory items from selected plants and dishes', () => {
      const inventory = {
        'rose_radiant': 2,
        'rose_flourishing': 3,
        'simple_seared_scallops_legendary': 1,
      };
      
      const adjustedPrices = {
        'rose_radiant': 200,
        'rose_flourishing': 100,
        'simple_seared_scallops_legendary': 600,
      };

      const items = SalesOptimizerSolver.generateInventoryItems(
        ['rose'],
        ['simple_seared_scallops'],
        inventory,
        new Set(),
        adjustedPrices,
        'gold'
      );

      expect(items).toHaveLength(3);
      expect(items.find(i => i.name === 'rose' && i.tier === 'radiant').count).toBe(2);
      expect(items.find(i => i.name === 'rose' && i.tier === 'flourishing').count).toBe(3);
      expect(items.find(i => i.name === 'simple_seared_scallops' && i.tier === 'legendary').count).toBe(1);
    });

    it('should skip items with zero count', () => {
      const inventory = {
        'rose_radiant': 0,
        'rose_flourishing': 5,
      };
      
      const adjustedPrices = {
        'rose_radiant': 200,
        'rose_flourishing': 100,
      };

      const items = SalesOptimizerSolver.generateInventoryItems(
        ['rose'],
        [],
        inventory,
        new Set(),
        adjustedPrices,
        'gold'
      );

      expect(items).toHaveLength(1);
      expect(items[0].tier).toBe('flourishing');
    });
  });

  describe('lpKnapsack - 2-Stage Strategy', () => {
    it('Stage 1: should find optimal value correctly', () => {
      // Budget: 100, Items: A=60(2), B=40(2), C=30(3)
      // Optimal: A + B = 100 (2 items, value 100)
      // Or: A + C + C = 120 > budget
      // Or: B + B = 80, C + C + C = 90
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 60, count: 2, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 40, count: 2, isHVA: false },
        { name: 'C', tier: 'rare', type: 'dishes', price: 30, count: 3, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'minimize_stock');
      
      // Stage 1 should find optimal value = 100
      expect(result.totalValue).toBe(100);
    });

    it('Stage 2 - minimize_stock: should maximize item count at optimal value', () => {
      // Budget: 100
      // Items: A=60(2), B=40(2), C=30(3), D=25(4)
      // Optimal value = 100
      // Solutions with value 100:
      //   - A + B = 100 (2 items) ❌
      //   - A + C + C = 120 > 100 ❌
      //   - B + C + C = 100 (3 items) ✓ BEST for minimize_stock
      //   - C + C + C + D = 115 > 100 ❌
      //   - B + B = 80 < 100 ❌
      // Actually: B(40) + C(30) + C(30) = 100 ✓ (3 items)
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 60, count: 2, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 40, count: 2, isHVA: false },
        { name: 'C', tier: 'rare', type: 'dishes', price: 30, count: 3, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'minimize_stock');
      
      expect(result.totalValue).toBe(100);
      // minimize_stock should prefer more items (lower prices)
      // B(40) + C(30) + C(30) = 100 with 3 items
      expect(result.items.length).toBe(3);
      const bCount = result.items.filter(i => i.name === 'B').length;
      const cCount = result.items.filter(i => i.name === 'C').length;
      expect(bCount).toBe(1);
      expect(cCount).toBe(2);
    });

    it('Stage 2 - maximize_stock: should minimize item count at optimal value', () => {
      // Budget: 100
      // Items: A=60(2), B=40(2), C=30(3)
      // Optimal value = 100
      // Solutions with value 100:
      //   - A + B = 100 (2 items) ✓ BEST for maximize_stock
      //   - B + C + C = 100 (3 items) ❌
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 60, count: 2, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 40, count: 2, isHVA: false },
        { name: 'C', tier: 'rare', type: 'dishes', price: 30, count: 3, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'maximize_stock');
      
      expect(result.totalValue).toBe(100);
      // maximize_stock should prefer fewer items (higher prices)
      // A(60) + B(40) = 100 with 2 items
      expect(result.items.length).toBe(2);
      const aCount = result.items.filter(i => i.name === 'A').length;
      const bCount = result.items.filter(i => i.name === 'B').length;
      expect(aCount).toBe(1);
      expect(bCount).toBe(1);
    });

    it('should handle empty inventory', () => {
      const result = SalesOptimizerSolver.lpKnapsack([], 100, 'minimize_stock');
      
      expect(result.items).toHaveLength(0);
      expect(result.totalValue).toBe(0);
      expect(result.remaining).toBe(100);
    });

    it('should handle budget too small for any item', () => {
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 100, count: 1, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 50, 'minimize_stock');
      
      expect(result.items).toHaveLength(0);
      expect(result.totalValue).toBe(0);
      expect(result.remaining).toBe(50);
    });

    it('should handle items with price > budget', () => {
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 200, count: 1, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 50, count: 2, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'minimize_stock');
      
      // A is too expensive, should only use B
      expect(result.items.length).toBe(2);
      expect(result.totalValue).toBe(100);
      expect(result.items.every(i => i.name === 'B')).toBe(true);
    });

    it('should handle exact budget match', () => {
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 50, count: 2, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'minimize_stock');
      
      expect(result.totalValue).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.items.length).toBe(2);
    });

    it('should handle fractional budget remainder', () => {
      const items = [
        { name: 'A', tier: 'legendary', type: 'dishes', price: 30, count: 3, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 25, count: 2, isHVA: false },
      ];

      const result = SalesOptimizerSolver.lpKnapsack(items, 100, 'minimize_stock');
      
      // Best: A + A + A = 90, remaining = 10
      // Or: A + A + B = 85, remaining = 15
      // Or: A + B + B = 80, remaining = 20
      expect(result.totalValue).toBe(90);
      expect(result.remaining).toBe(10);
    });
  });

  describe('groupResults', () => {
    it('should group items by name and tier', () => {
      const items = [
        { name: 'rose', tier: 'radiant', type: 'plants', price: 100, isHVA: false },
        { name: 'rose', tier: 'radiant', type: 'plants', price: 100, isHVA: false },
        { name: 'rose', tier: 'flourishing', type: 'plants', price: 50, isHVA: false },
        { name: 'gillyweed', tier: 'radiant', type: 'plants', price: 80, isHVA: false },
      ];

      const result = SalesOptimizerSolver.groupResults(items);

      expect(result.itemCount).toBe(4);
      expect(result.solution).toHaveLength(3);
      
      const roseRadiant = result.solution.find(i => i.name === 'rose' && i.tier === 'radiant');
      expect(roseRadiant.count).toBe(2);
      
      const roseFlourishing = result.solution.find(i => i.name === 'rose' && i.tier === 'flourishing');
      expect(roseFlourishing.count).toBe(1);
    });

    it('should sort by price descending', () => {
      const items = [
        { name: 'C', tier: 'rare', type: 'dishes', price: 30, isHVA: false },
        { name: 'A', tier: 'legendary', type: 'dishes', price: 100, isHVA: false },
        { name: 'B', tier: 'epic', type: 'dishes', price: 50, isHVA: false },
      ];

      const result = SalesOptimizerSolver.groupResults(items);

      expect(result.solution[0].price).toBe(100);
      expect(result.solution[1].price).toBe(50);
      expect(result.solution[2].price).toBe(30);
    });
  });

  describe('solve - Integration', () => {
    it('should solve with minimize_stock strategy (default)', async () => {
      // Mock the loader methods
      const originalLoadPlants = SalesOptimizerLoader.loadPlantsData;
      const originalLoadDishes = SalesOptimizerLoader.loadDishesData;
      
      SalesOptimizerLoader.loadPlantsData = async () => mockPlantsData;
      SalesOptimizerLoader.loadDishesData = async () => mockDishesData;

      const params = {
        budget: 100,
        strategy: 'minimize_stock',
        inventory: {
          'rose_radiant': 1,    // 100 gold
          'rose_flourishing': 2, // 50 gold each
          'rose_hardy': 4,      // 25 gold each
        },
        currency: 'gold',
        plantsRate: 0,
        dishesRate: 0,
        talentBonus: 0,
        selectedPlants: ['rose'],
        selectedDishes: [],
      };

      const result = await SalesOptimizerSolver.solve(params);

      // Restore original methods
      SalesOptimizerLoader.loadPlantsData = originalLoadPlants;
      SalesOptimizerLoader.loadDishesData = originalLoadDishes;

      expect(result.totalValue).toBe(100);
      // minimize_stock should prefer more items
      // 4 hardy (25*4=100) = 4 items is better than 2 flourishing (50*2=100) = 2 items
      expect(result.totalCount).toBe(4);
    });

    it('should solve with maximize_stock strategy', async () => {
      const originalLoadPlants = SalesOptimizerLoader.loadPlantsData;
      const originalLoadDishes = SalesOptimizerLoader.loadDishesData;
      
      SalesOptimizerLoader.loadPlantsData = async () => mockPlantsData;
      SalesOptimizerLoader.loadDishesData = async () => mockDishesData;

      const params = {
        budget: 100,
        strategy: 'maximize_stock',
        inventory: {
          'rose_radiant': 1,    // 100 gold
          'rose_flourishing': 2, // 50 gold each
          'rose_hardy': 4,      // 25 gold each
        },
        currency: 'gold',
        plantsRate: 0,
        dishesRate: 0,
        talentBonus: 0,
        selectedPlants: ['rose'],
        selectedDishes: [],
      };

      const result = await SalesOptimizerSolver.solve(params);

      // Restore original methods
      SalesOptimizerLoader.loadPlantsData = originalLoadPlants;
      SalesOptimizerLoader.loadDishesData = originalLoadDishes;

      expect(result.totalValue).toBe(100);
      // maximize_stock should prefer fewer items (higher prices)
      // 1 radiant (100) = 1 item is better than 2 flourishing (50*2=100) = 2 items
      expect(result.totalCount).toBe(1);
    });

    it('should handle empty inventory', async () => {
      const originalLoadPlants = SalesOptimizerLoader.loadPlantsData;
      const originalLoadDishes = SalesOptimizerLoader.loadDishesData;
      
      SalesOptimizerLoader.loadPlantsData = async () => mockPlantsData;
      SalesOptimizerLoader.loadDishesData = async () => mockDishesData;

      const params = {
        budget: 100,
        strategy: 'minimize_stock',
        inventory: {},
        currency: 'gold',
        plantsRate: 0,
        dishesRate: 0,
        talentBonus: 0,
        selectedPlants: ['rose'],
        selectedDishes: [],
      };

      const result = await SalesOptimizerSolver.solve(params);

      // Restore original methods
      SalesOptimizerLoader.loadPlantsData = originalLoadPlants;
      SalesOptimizerLoader.loadDishesData = originalLoadDishes;

      expect(result.totalValue).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.solution).toHaveLength(0);
      expect(result.remainingBudget).toBe(100);
    });
  });
});
