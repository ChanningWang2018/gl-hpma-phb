<template>
  <div class="sales-optimizer-container">
    <div class="sales-optimizer-content">
      
      
      <div class="controls-panel">
        <div class="control-row">
          <div class="control-group">
            <label>{{ labels.ui?.currency?.label || 'Currency' }}</label>
            <select v-model="currency" @change="handleCurrencyChange">
              <option value="gold">{{ labels.ui?.currency?.gold || 'Gold' }}</option>
              <option value="gems">{{ labels.ui?.currency?.gems || 'Gems' }}</option>
            </select>
          </div>
        </div>
        
        <div class="control-row">
          <div class="control-group">
            <label>{{ labels.ui?.budget?.label || 'Budget💸' }}</label>
            <input 
              type="number" 
              v-model.number="budget"
              :min="0" 
              :max="20000"
              :step="1000"
              @input="debouncedSave"
              placeholder="0"
            />
          </div>
        </div>
        
        <div class="control-row">
          <div class="control-group">
            <label>{{ labels.ui?.strategy?.label || 'Selling Strategy📈📉' }}</label>
            <select v-model="strategy" @change="debouncedSave">
              <option value="minimize_stock">
                {{ labels.ui?.strategy?.minimize_stock || 'Prioritize low-priced items' }}
              </option>
              <option value="maximize_stock">
                {{ labels.ui?.strategy?.maximize_stock || 'Prioritize high-priced items' }}
              </option>
            </select>
            <small v-if="labels.ui?.strategy?.info" class="help-text">
              {{ labels.ui.strategy.info }}
            </small>
          </div>
        </div>
        
        <div class="inventory-section">
          <h3>{{ labels.ui?.inventory?.title || 'Inventory' }}</h3>
          <p class="inventory-subtitle">{{ labels.ui?.inventory?.hva_info || 'Enter quantities for items sold to HVA shop' }}</p>
          
          <!-- Plants Section -->
          <CollapsibleSection 
            v-if="currencyPlants.length > 0"
            :title="'🌱 ' + (labels.ui?.plants_title || 'Plants')"
            :badgeText="selectionBadgeText('plants')"
            :defaultOpen="true"
          >
            <ImageSelector
              :items="currencyPlants"
              type="plants"
              v-model="selectedPlants"
              :labels="labels"
            />
            
            <!-- Tier Inputs (only for selected plants) -->
            <div v-if="selectedPlants.length > 0" class="selected-items-tiers">
              <div 
                v-for="item in selectedPlantItems" 
                :key="`plant-${item.name}`"
                class="selected-item-row"
              >
                <img 
                  :src="getPlantImage(item.name)" 
                  :alt="getPlantLabel(item.name)"
                  class="item-image"
                  @error="handleImageError"
                  :title="getPlantLabel(item.name)"
                />
                <div class="tier-inputs-inline">
                  <div 
                    v-for="tier in item.availableTiers" 
                    :key="`${item.name}-${tier}`"
                    class="tier-input-inline"
                    :class="getTierClass(tier)"
                  >
<input 
                      type="number"
                      v-model.number="inventory[`${item.name}_${tier}`]"
                      :min="0"
                      :max="2000"
                      :title="`${getTierLabel(tier)}: ${item.tierPrices[tier]} ${currency}`"
                      @input="debouncedSave"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="no-selection-message">
              {{ labels.ui?.no_selection || 'Select plants above to enter quantities' }}
            </div>
          </CollapsibleSection>
          
          <!-- Dishes Section -->
          <CollapsibleSection 
            v-if="currencyDishes.length > 0"
            :title="'🍽️ ' + (labels.ui?.dishes_title || 'Dishes')"
            :badgeText="selectionBadgeText('dishes')"
            :defaultOpen="true"
          >
            <ImageSelector
              :items="currencyDishes"
              type="dishes"
              v-model="selectedDishes"
              :labels="labels"
            />
            
            <!-- Tier Inputs (only for selected dishes) -->
            <div v-if="selectedDishes.length > 0" class="selected-items-tiers">
              <div 
                v-for="item in selectedDishItems" 
                :key="`dish-${item.name}`"
                class="selected-item-row"
              >
                <img 
                  :src="getDishImage(item.name)" 
                  :alt="getDishLabel(item.name)"
                  class="item-image"
                  @error="handleImageError"
                  :title="getDishLabel(item.name)"
                />
                <div class="tier-inputs-inline">
                  <div 
                    v-for="tier in item.availableTiers" 
                    :key="`${item.name}-${tier}`"
                    class="tier-input-inline"
                    :class="getTierClass(tier)"
                  >
<input 
                      type="number"
                      v-model.number="inventory[`${item.name}_${tier}`]"
                      :min="0"
                      :max="2000"
                      :title="`${getTierLabel(tier)}: ${item.tierPrices[tier]} ${currency}`"
                      @input="debouncedSave"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else class="no-selection-message">
              {{ labels.ui?.no_selection || 'Select dishes above to enter quantities' }}
            </div>
          </CollapsibleSection>
          
          <div v-if="currencyPlants.length === 0 && currencyDishes.length === 0" class="no-items">
            No items available for selected currency.
          </div>
        </div>
        
        <div class="control-row">
          <div class="control-group">
            <label>{{ labels.ui?.blooms_rate?.label || 'Blooms Rate' }}</label>
            <select v-model="plantsRate" @change="debouncedSave">
              <option 
                v-for="(option, index) in bloomsRateOptions"
                :key="index"
                :value="index"
              >
                {{ option }}
              </option>
            </select>
          </div>
          
          <div class="control-group">
            <label>{{ labels.ui?.confiserie_rate?.label || 'Confiserie Rate' }}</label>
            <select v-model="dishesRate" @change="debouncedSave">
              <option 
                v-for="(option, index) in confiserieRateOptions"
                :key="index"
                :value="index"
              >
                {{ option }}
              </option>
            </select>
          </div>
          
          <div class="control-group">
            <label>{{ labels.ui?.talent_price_bonus?.label || 'Talent Bonus (%)' }}</label>
            <select v-model="talentBonus" @change="debouncedSave">
              <option 
                v-for="(option, index) in talentBonusOptions"
                :key="index"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
        
        <button 
          class="solve-button"
          @click="handleSolve"
          :disabled="isSolving || !canSolve"
        >
          {{ isSolving ? (labels.ui?.solving || 'Solving...') : (labels.ui?.solve_button || 'Solve') }}
        </button>
      </div>
      
      <div class="results-panel" v-if="results">
        <div class="results-header">
          <h3>{{ labels.ui?.results?.label || 'Results' }}</h3>
          <button 
            class="copy-button"
            @click="copyResults"
            :disabled="copySuccess"
          >
            {{ copySuccess ? (labels.ui?.results?.copied || 'Copied!') : (labels.ui?.results?.copy_results || 'Copy Results') }}
          </button>
        </div>
        
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">{{ labels.ui?.results?.total_value || 'Total Value' }}</span>
            <span class="stat-value">{{ formatNumber(results.totalValue) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ labels.ui?.results?.total_count || 'Total Count' }}</span>
            <span class="stat-value">{{ results.totalCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ labels.ui?.results?.remaining_budget || 'Remaining Budget' }}</span>
            <span class="stat-value">{{ formatNumber(results.remainingBudget) }}</span>
            <span class="emoji">{{ results.remainingBudget ? '😞' : '😁' }}</span>
          </div>
        </div>
        
        <div class="solution-list" v-if="results.solution && results.solution.length > 0">
          <h4>{{ labels.ui?.results?.solution || 'Solution' }}</h4>
          <ul>
            <li v-for="(item, index) in results.solution" :key="index">
              <div class="solution-item-content">
                <img 
                  :src="getSolutionItemImage(item)" 
                  :alt="getItemLabel(item)"
                  class="solution-item-image"
                  @error="handleImageError"
                />
                <div class="solution-item-info">
                  <span class="item-name">{{ getItemLabel(item) }}</span>
                  <div class="solution-item-details">
                    <span class="item-count">{{ item.count }}×</span>
                    <span class="item-price">{{ formatNumber(item.price) }} {{ currency }}</span>
                    <span class="item-tier" :class="'tier-' + item.tier.replace('_rarecolor', '')">
                      {{ getTierLabel(item.tier) }}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CollapsibleSection from '@/components/CollapsibleSection.vue';
import ImageSelector from '@/components/ImageSelector.vue';
import SalesOptimizerLoader from '@/services/salesOptimizerLoader.js';
import SalesOptimizerSolver from '@/services/salesOptimizerSolver.js';
import { computed, onMounted, ref, watch } from 'vue';
import { useHead } from '@vueuse/head';

export default {
  name: 'SalesOptimizer',
  components: {
    ImageSelector,
    CollapsibleSection
  },
  setup() {
    useHead({
      title: 'HPMA Sales Optimizer - HVA Shop Calculator',
      meta: [
        { name: 'description', content: 'Optimize your HVA shop sales in Harry Potter: Magic Awakened. Calculate the best items to sell for maximum gold or gems.' },
        { property: 'og:title', content: 'HPMA Sales Optimizer' },
        { property: 'og:description', content: 'Maximize your earnings with our HVA shop sales calculator for Harry Potter: Magic Awakened.' },
        { property: 'og:url', content: 'https://hpma-phb.netlify.app/sales-optimizer' }
      ]
    });
    
    const currency = ref('gold');
    const budget = ref(null);
    const inventory = ref({});
    const plantsRate = ref(0);
    const dishesRate = ref(0);
    const talentBonus = ref(0);
    const strategy = ref('minimize_stock'); // Default: prioritize low-priced items
    const results = ref(null);
    const isSolving = ref(false);
    const copySuccess = ref(false);
    const labels = ref({});
    const imageLoaded = ref({});
    const selectedPlants = ref([]);
    const selectedDishes = ref([]);

    const allPlants = ref([]);
    const allDishes = ref([]);

    // Get unique plant names preserving CSV order
    const currencyPlants = computed(() => {
      const filtered = SalesOptimizerLoader.filterByCurrency(allPlants.value, currency.value);
      const uniqueNames = [];
      const seen = new Set();
      
      for (const plant of filtered) {
        if (!seen.has(plant.name)) {
          seen.add(plant.name);
          uniqueNames.push(plant.name);
        }
      }
      
      return uniqueNames.map(name => {
        const plantItems = filtered.filter(p => p.name === name);
        const availableTiers = plantItems.map(p => p.tier);
        const tierPrices = {};
        plantItems.forEach(p => {
          tierPrices[p.tier] = p[currency.value];
        });
        
        return {
          name,
          availableTiers,
          tierPrices
        };
      });
    });

    // Get unique dish names preserving CSV order
    const currencyDishes = computed(() => {
      const filtered = SalesOptimizerLoader.filterByCurrency(allDishes.value, currency.value);
      const uniqueNames = [];
      const seen = new Set();
      
      for (const dish of filtered) {
        if (!seen.has(dish.name)) {
          seen.add(dish.name);
          uniqueNames.push(dish.name);
        }
      }
      
      return uniqueNames.map(name => {
        const dishItems = filtered.filter(d => d.name === name);
        const availableTiers = dishItems.map(d => d.tier);
        const tierPrices = {};
        dishItems.forEach(d => {
          tierPrices[d.tier] = d[currency.value];
        });
        
        return {
          name,
          availableTiers,
          tierPrices
        };
      });
    });

    const canSolve = computed(() => {
      if (budget.value <= 0) return false;
      const totalInventory = Object.keys(inventory.value).reduce((sum, key) => {
        return sum + (parseInt(inventory.value[key]) || 0);
      }, 0);
      return totalInventory > 0;
    });

    const selectedPlantItems = computed(() => {
      return currencyPlants.value.filter(plant => 
        selectedPlants.value.includes(plant.name)
      );
    });

    const selectedDishItems = computed(() => {
      return currencyDishes.value.filter(dish => 
        selectedDishes.value.includes(dish.name)
      );
    });

    const selectionBadgeText = (type) => {
      const count = type === 'plants' ? selectedPlants.value.length : selectedDishes.value.length;
      return `${count} selected`;
    };

    const bloomsRateOptions = computed(() => {
      return labels.value.ui?.blooms_rate?.options || [
        '0',
        '+100%',
        '+200%',
        '+300%'
      ];
    });

    const confiserieRateOptions = computed(() => {
      return labels.value.ui?.confiserie_rate?.options || [
        '0',
        '+100%',
        '+200%',
        '+300%'
      ];
    });

    const talentBonusOptions = computed(() => {
      return Array.from({ length: 11 }, (_, i) => ({
        value: i * 10,
        label: `${i * 10}%`
      }));
    });

    const loadData = async () => {
      try {
        allPlants.value = await SalesOptimizerLoader.loadPlantsData();
        allDishes.value = await SalesOptimizerLoader.loadDishesData();
        labels.value = await SalesOptimizerLoader.loadLabels();
        updateLabels();
      } catch (error) {
        console.error('Failed to load data:', error);
        labels.value = getFallbackLabels();
      }
    };

    const getFallbackLabels = () => ({
      title: 'Sales Optimizer',
      subtitle: 'Optimize your HPMA plant & dish sales',
      ui: {
        currency: { label: 'Currency', gold: 'Gold', gems: 'Gems' },
        budget: { label: 'Budget💸' },
        inventory: { title: 'Inventory', hva_info: 'Enter quantities for items sold to HVA shop' },
        blooms_rate: { label: 'Blooms Rate', options: ['0', '+100%', '+200%', '+300%'] },
        confiserie_rate: { label: 'Confiserie Rate', options: ['0', '+100%', '+200%', '+300%'] },
        talent_price_bonus: { label: 'Talent Bonus (%)' },
        strategy: { 
          label: 'Strategy',
          minimize_stock: 'Prioritize low-priced items',
          maximize_stock: 'Prioritize high-priced items'
        },
        solve_button: 'Solve',
        solving: 'Solving...',
        results: {
          label: 'Results',
          total_value: 'Total Value',
          total_count: 'Total Count',
          remaining_budget: 'Remaining Budget',
          solution: 'Solution',
          copy_results: 'Copy Results',
          copied: 'Copied!'
        },
        select_all: 'Select All',
        clear_all: 'Clear All',
        selected: 'Selected',
        no_selection: 'Select items above to enter quantities'
      },
      tiers: {
        radiant: 'RADIANT',
        flourishing: 'FLOURISHING',
        hardy: 'HARDY',
        radiant_rarecolor: 'RADIANT+RARE',
        flourishing_rarecolor: 'FLOURISHING+RARE',
        hardy_rarecolor: 'HARDY+RARE',
        legendary: 'LEGENDARY',
        epic: 'EPIC',
        rare: 'RARE'
      }
    });

    const updateLabels = () => {
      const langLabels = labels.value.en || {};
      labels.value = {
        ...labels.value,
        title: langLabels.title || 'Sales Optimizer',
        subtitle: langLabels.subtitle || 'Optimize your HPMA plant & dish sales'
      };
    };

    const handleCurrencyChange = () => {
      inventory.value = {};
      results.value = null;
      // 移除saveToStorage()调用，不保存状态
    };

const resetItemInventory = (itemName, tiers) => {
      tiers.forEach(tier => {
        const key = `${itemName}_${tier}`;
        delete inventory.value[key];
      });
    };

    watch(selectedPlants, (newVal, oldVal) => {
      const removedItems = oldVal ? oldVal.filter(item => !newVal.includes(item)) : [];
      
      // 只清除被移除物品的库存，新选择的物品不初始化任何值
      removedItems.forEach(itemName => {
        const tiers = SalesOptimizerLoader.getPlantTiers();
        resetItemInventory(itemName, tiers);
      });
      
      // 移除debouncedSave()调用
    });

    watch(selectedDishes, (newVal, oldVal) => {
      const removedItems = oldVal ? oldVal.filter(item => !newVal.includes(item)) : [];
      
      // 只清除被移除物品的库存，新选择的物品不初始化任何值
      removedItems.forEach(itemName => {
        const tiers = SalesOptimizerLoader.getDishTiers();
        resetItemInventory(itemName, tiers);
      });
      
      // 移除debouncedSave()调用
    });

    watch(selectedDishes, (newVal, oldVal) => {
      const removedItems = oldVal ? oldVal.filter(item => !newVal.includes(item)) : [];
      
      // 只清除被移除物品的库存，新选择的物品不初始化任何值
      removedItems.forEach(itemName => {
        const tiers = SalesOptimizerLoader.getDishTiers();
        resetItemInventory(itemName, tiers);
      });
      
      // 移除debouncedSave()调用
    });

    const handleSolve = async () => {
      isSolving.value = true;
      try {
        const plantNames = currencyPlants.value.map(p => p.name);
        const dishNames = currencyDishes.value.map(d => d.name);
        
        results.value = await SalesOptimizerSolver.solve({
          budget: budget.value,
          strategy: strategy.value,
          inventory: inventory.value,
          currency: currency.value,
          plantsRate: plantsRate.value,
          dishesRate: dishesRate.value,
          talentBonus: talentBonus.value,
          selectedPlants: plantNames,
          selectedDishes: dishNames
        });
      } catch (error) {
        console.error('Solve failed:', error);
      } finally {
        isSolving.value = false;
      }
    };

    const formatResultsAsText = () => {
      if (!results.value) return '';
      
      const lines = [];
      lines.push(`Total Value: ${formatNumber(results.value.totalValue)}`);
      lines.push(`Total Count: ${results.value.totalCount}`);
      lines.push(`Remaining Budget: ${formatNumber(results.value.remainingBudget)}`);
      lines.push('');
      lines.push('Solution:');
      
      if (results.value.solution && results.value.solution.length > 0) {
        results.value.solution.forEach(item => {
          const name = getItemLabel(item);
          const tier = getTierLabel(item.tier);
          lines.push(`- ${name} (${tier}) x${item.count} ($${formatNumber(item.price)})`);
        });
      }
      
      return lines.join('\n');
    };

    const copyResults = async () => {
      try {
        const text = formatResultsAsText();
        await navigator.clipboard.writeText(text);
        copySuccess.value = true;
        setTimeout(() => {
          copySuccess.value = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    };

    const formatNumber = (num) => num.toLocaleString();

    const getPlantLabel = (name) => {
      return labels.value.en?.plants?.[name] || name.replace(/_/g, ' ');
    };

    const getDishLabel = (name) => {
      return labels.value.en?.dishes?.[name] || name.replace(/_/g, ' ');
    };

    const getItemLabel = (item) => {
      if (item.type === 'plants') {
        return getPlantLabel(item.name);
      } else {
        return getDishLabel(item.name);
      }
    };

    const getTierLabel = (tier) => {
      return labels.value.en?.tiers?.[tier] || tier.toUpperCase();
    };

    const getTierClass = (tier) => {
      if (tier.includes('_rarecolor')) {
        return `tier-${tier}`;
      }
      return `tier-${tier.replace('_rarecolor', '')}`;
    };

    const getImagePlaceholder = (name) => {
      return name.substring(0, 3).toUpperCase();
    };

    const getPlantImage = (name) => {
      return `/images/plants/${name}.webp`;
    };

    const getDishImage = (name) => {
      return `/images/dishes/${name}.webp`;
    };

    const handleImageError = (event) => {
      const key = event.target.src.includes('/plants/') ? 
        `plant-${event.target.alt.replace(/_/g, ' ')}` : 
        `dish-${event.target.alt.replace(/_/g, ' ')}`;
      imageLoaded.value[key] = false;
    };

    const getSolutionItemImage = (item) => {
      if (item.type === 'plants') {
        return `/images/plants/${item.name}.webp`;
      } else {
        return `/images/dishes/${item.name}.webp`;
      }
    };

    const debouncedSave = () => {
      // 移除状态保存功能，页面刷新时会清除所有用户输入
    };

    onMounted(() => {
      loadData();
      // 移除loadFromStorage()，确保每次页面加载都是空白状态
    });

    return {
      currency,
      budget,
      inventory,
      plantsRate,
      dishesRate,
      talentBonus,
      strategy,
      results,
      isSolving,
      copySuccess,
      labels,
      imageLoaded,
      selectedPlants,
      selectedDishes,
      currencyPlants,
      currencyDishes,
      selectedPlantItems,
      selectedDishItems,
      selectionBadgeText,
      canSolve,
      bloomsRateOptions,
      confiserieRateOptions,
      talentBonusOptions,
      handleCurrencyChange,
      handleSolve,
      copyResults,
      formatNumber,
      getPlantLabel,
      getDishLabel,
      getItemLabel,
      getTierLabel,
      getTierClass,
      getImagePlaceholder,
      getPlantImage,
      getDishImage,
      getSolutionItemImage,
      handleImageError,
      debouncedSave
    };
  }
};
</script>

<style scoped>
.sales-optimizer-container {
  padding: 30px;
}

.sales-optimizer-content {
  max-width: 1400px;
  margin: 0 auto;
}

h2 {
  text-align: center;
  color: var(--ink);
  margin-bottom: 10px;
  font-size: 2em;
}

.subtitle {
  text-align: center;
  color: var(--ink-faded);
  margin-bottom: 30px;
  font-size: 1.1em;
}

.controls-panel {
  background: rgba(var(--accent-rgb), 0.04);
  border: 1px solid var(--rule);
  padding: 25px;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-family: var(--font-type);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faded);
  font-weight: 400;
  font-size: 0.8em;
}

.control-group input,
.control-group select {
  padding: 10px 12px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-size: 1em;
  color: var(--ink);
  background: var(--paper-light);
  transition: border-color 0.25s;
}

.control-group input:hover,
.control-group select:hover {
  border-color: var(--ink-faded);
}

.control-group .help-text {
  color: var(--ink-faded);
  font-size: 0.85em;
  margin-top: 4px;
  font-weight: 400;
}

.inventory-section {
  background: transparent;
  padding: 20px;
  border-radius: 2px;
  margin-top: 10px;
}

.inventory-section h3 {
  color: var(--ink);
  margin-bottom: 10px;
  font-size: 1.5em;
}

.inventory-subtitle {
  color: var(--ink-faded);
  font-size: 0.95em;
  margin-bottom: 25px;
}

.no-items {
  text-align: center;
  padding: 40px;
  color: var(--ink-faded);
  font-size: 1.1em;
  background: var(--paper-light);
  border-radius: 2px;
  border: 1px dashed var(--rule);
}

.selected-items-tiers {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--rule);
}

.selected-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--paper-light);
  border-radius: 2px;
  margin-bottom: 8px;
  border: 1px solid var(--rule);
  transition: border-color 0.2s;
}

.selected-item-row:hover {
  border-color: var(--ink-faded);
}

.item-image {
  width: 50px;
  height: 50px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
  background: transparent;
  cursor: pointer;
}

.tier-inputs-inline {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.tier-input-inline {
  flex-shrink: 0;
  width: 65px;
  padding: 0;
  border-radius: 2px;
  border: 1px solid var(--rule);
  transition: border-color 0.25s, background 0.25s;
  background: var(--paper-light);
}

.tier-input-inline:hover {
  border-color: var(--ink-faded);
}

.tier-input-inline input {
  width: 100%;
  padding: 8px 4px;
  border: none;
  border-radius: 4px;
  font-size: 0.95em;
  font-weight: 600;
  text-align: center;
  background: transparent;
  transition: background 0.2s;
}

.tier-input-inline input:focus {
  outline: none;
  background: rgba(var(--ink-rgb), 0.06);
}



/* Rarity washes: the game's tier hues re-inked in the paper palette */
.tier-input-inline.tier-legendary,
.tier-input-inline.tier-radiant {
  border-color: rgba(var(--gold-rgb), 0.55);
  background: rgba(var(--gold-rgb), 0.14);
}

.tier-input-inline.tier-legendary input,
.tier-input-inline.tier-radiant input {
  color: var(--gold-ink);
}

.tier-input-inline.tier-epic,
.tier-input-inline.tier-flourishing {
  border-color: rgba(var(--violet-rgb), 0.55);
  background: rgba(var(--violet-rgb), 0.14);
}

.tier-input-inline.tier-epic input,
.tier-input-inline.tier-flourishing input {
  color: var(--violet-ink);
}

.tier-input-inline.tier-rare,
.tier-input-inline.tier-hardy {
  border-color: rgba(var(--teal-rgb), 0.55);
  background: rgba(var(--teal-rgb), 0.14);
}

.tier-input-inline.tier-rare input,
.tier-input-inline.tier-hardy input {
  color: var(--teal-ink);
}

/* Rare-color variants: the same family pressed twice — deeper wash, no glow */
.tier-input-inline.tier-radiant_rarecolor {
  border-color: var(--gold-leaf);
  background: rgba(var(--gold-rgb), 0.26);
}

.tier-input-inline.tier-radiant_rarecolor input {
  color: var(--gold-ink);
  font-weight: 700;
}

.tier-input-inline.tier-flourishing_rarecolor {
  border-color: var(--violet-ink);
  background: rgba(var(--violet-rgb), 0.26);
}

.tier-input-inline.tier-flourishing_rarecolor input {
  color: var(--violet-ink);
  font-weight: 700;
}

.tier-input-inline.tier-hardy_rarecolor {
  border-color: var(--teal-ink);
  background: rgba(var(--teal-rgb), 0.26);
}

.tier-input-inline.tier-hardy_rarecolor input {
  color: var(--teal-ink);
  font-weight: 700;
}

.no-selection-message {
  text-align: center;
  padding: 20px;
  color: var(--ink-faded);
  font-style: italic;
  background: var(--paper-light);
  border-radius: 2px;
  border: 1px dashed var(--rule);
}

.solve-button {
  width: 100%;
  padding: 15px;
  font-family: var(--font-type);
  font-size: 1.05em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--oxblood);
  border: 1px solid rgba(var(--accent-rgb), 0.55);
  border-radius: 2px;
  cursor: pointer;
  margin-top: 20px;
  transition: background 0.25s;
}

.solve-button:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), 0.26);
}

.solve-button:disabled {
  background: var(--paper-deep);
  cursor: not-allowed;
  transform: none;
}

.results-panel {
  background: transparent;
  padding: 22px 0 0;
  border-top: 3px double var(--ink);
  border-radius: 0;
  margin-top: 30px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.results-header h3 {
  color: var(--ink);
  margin: 0;
  font-size: 1.5em;
}

.copy-button {
  padding: 8px 18px;
  font-family: var(--font-type);
  font-size: 0.9em;
  letter-spacing: 0.06em;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--oxblood);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.25s;
}

.copy-button:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), 0.2);
}

.copy-button:disabled {
  background: var(--paper-deep);
  cursor: default;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
  padding: 20px;
  background: rgba(var(--accent-rgb), 0.05);
  border: 1px solid var(--rule);
  border-radius: 2px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.stat-label {
  font-size: 0.9em;
  color: var(--ink-faded);
}

.stat-value {
  font-size: 1.6em;
  font-weight: 700;
  color: var(--ink);
}

.emoji {
  font-size: 1.3em;
  margin-left: 5px;
}

.solution-list {
  margin-top: 25px;
}

.solution-list h4 {
  color: var(--ink);
  margin-bottom: 15px;
  font-size: 1.3em;
}

.solution-list ul {
  list-style: none;
  padding: 0;
}

.solution-list li {
  padding: 15px;
  background: transparent;
  border-radius: 2px;
  margin-bottom: 8px;
  border-left: 4px solid var(--oxblood);
  transition: background 0.2s;
}

.solution-list li:hover {
  background: rgba(var(--accent-rgb), 0.05);
}

.solution-item-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.solution-item-image {
  width: 50px;
  height: 50px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
  background: transparent;
}

.solution-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-name {
  font-weight: 600;
  color: var(--ink);
}

.solution-item-details {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-count {
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  color: var(--oxblood);
  padding: 4px 12px;
  border-radius: 2px;
  font-weight: 600;
  font-size: 0.95em;
}

.item-price {
  font-weight: 700;
  color: var(--ink);
  font-size: 1.05em;
}

.item-tier {
  font-size: 0.85em;
  padding: 4px 12px;
  border-radius: 2px;
  font-weight: 600;
}

/* Same washes as the inventory inputs, so both reads of rarity agree */
.tier-legendary,
.tier-radiant {
  background: rgba(var(--gold-rgb), 0.14);
  border: 1px solid rgba(var(--gold-rgb), 0.4);
  color: var(--gold-ink);
}

.tier-epic,
.tier-flourishing {
  background: rgba(var(--violet-rgb), 0.14);
  border: 1px solid rgba(var(--violet-rgb), 0.4);
  color: var(--violet-ink);
}

.tier-rare,
.tier-hardy {
  background: rgba(var(--teal-rgb), 0.14);
  border: 1px solid rgba(var(--teal-rgb), 0.4);
  color: var(--teal-ink);
}

@media (max-width: 768px) {
.sales-optimizer-container {
    padding: 10px;
  }

  h2 {
    font-size: 1.5em;
  }

  .subtitle {
    font-size: 1em;
  }

  .control-row {
    grid-template-columns: 1fr;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }

.tier-input-inline {
    width: 55px;
  }
  
  .tier-input-inline input {
    padding: 7px 3px;
    font-size: 0.9em;
  }
  
  .item-image {
    width: 40px;
    height: 40px;
  }
  
.selected-item-row {
    gap: 6px;
    padding: 4px 8px;
  }
  
  .tier-inputs-inline {
    gap: 6px;
  }
  
  .summary-stats {
    grid-template-columns: 1fr;
  }
  
  .solution-list li {
    flex-wrap: wrap;
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .sales-optimizer-container {
    padding: 10px;
  }

  h2 {
    font-size: 1.3em;
  }

  .subtitle {
    font-size: 0.9em;
  }
  
  .tier-inputs-inline {
    gap: 5px;
  }
  
  .tier-input-inline {
    width: 42px;
  }
  
  .tier-input-inline input {
    padding: 6px 2px;
    font-size: 0.85em;
  }
  
  .item-image {
    width: 35px;
    height: 35px;
  }
  
  .selected-item-row {
    gap: 6px;
    padding: 5px 8px;
  }
  
  .selected-item-row {
    flex-wrap: wrap;
  }
  
  .item-image {
    margin-right: 0;
    margin-bottom: 5px;
  }
}

  .tier-inputs-compact {
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 5px;
  }

  .selected-item-card {
    padding: 10px;
    margin-bottom: 10px;
  }

  .item-header {
    padding-bottom: 6px;
  }

  .solve-button {
    padding: 14px;
    font-size: 1.1em;
  }

</style>