class SalesOptimizerLoader {
  static async loadPlantsData() {
    try {
      const response = await fetch('/data/plants.csv');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const csvText = await response.text();
      return this.parseCSV(csvText, 'plants');
    } catch (error) {
      console.error('Failed to load plants data:', error);
      throw error;
    }
  }

  static async loadDishesData() {
    try {
      const response = await fetch('/data/dishes.csv');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const csvText = await response.text();
      return this.parseCSV(csvText, 'dishes');
    } catch (error) {
      console.error('Failed to load dishes data:', error);
      throw error;
    }
  }

  static async loadLabels() {
    try {
      const response = await fetch('/data/labels.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load labels:', error);
      throw error;
    }
  }

  static parseCSV(csvText, type) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length !== headers.length) continue;

      const item = {};
      headers.forEach((header, index) => {
        const value = values[index].trim();
        if (header === 'gold' || header === 'gems') {
          item[header] = parseInt(value, 10) || 0;
        } else {
          item[header] = value;
        }
      });

      item.type = type;
      items.push(item);
    }

    return items;
  }

  static filterByCurrency(items, currency) {
    return items.filter(item => item[currency] > 0 && item.tier !== 'feeble');
  }

  static filterByType(items, type) {
    return items.filter(item => item.type === type);
  }

  static filterByTiers(items, tiers) {
    return items.filter(item => tiers.includes(item.tier));
  }

  static groupBy(items, key) {
    return items.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {});
  }

  static getPlantTiers() {
    return ['radiant', 'flourishing', 'hardy', 'radiant_rarecolor', 'flourishing_rarecolor', 'hardy_rarecolor'];
  }

  static getDishTiers() {
    return ['legendary', 'epic', 'rare'];
  }

  static getTiersForType(type) {
    const tiers = type === 'plants' ? this.getPlantTiers() : this.getDishTiers();
    return tiers.filter(tier => tier !== 'feeble');
  }

  static getItemsByTypeAndCurrency(items, type, currency) {
    return items.filter(item => 
      item.type === type && item[currency] > 0
    );
  }

  static getAvailableTiers(items, name) {
    const nameItems = items.filter(item => item.name === name);
    return nameItems.map(item => item.tier);
  }

  static getUniqueNames(items) {
    const names = [...new Set(items.map(item => item.name))];
    return names.sort();
  }
}

export default SalesOptimizerLoader;