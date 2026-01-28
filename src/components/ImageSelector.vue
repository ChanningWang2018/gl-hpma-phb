<template>
  <div class="image-selector">
    <div class="selector-actions">
      <button @click="selectAll" class="action-btn">
        {{ labels?.ui?.select_all || 'Select All' }}
      </button>
      <button @click="clearAll" class="action-btn action-btn-secondary">
        {{ labels?.ui?.clear_all || 'Clear All' }}
      </button>
    </div>
    
    <div class="image-grid">
      <label 
        v-for="item in items" 
        :key="item.name"
        class="image-item"
        :class="{ 'selected': isSelected(item.name) }"
        :title="getLabel(item.name)"
      >
        <input 
          type="checkbox" 
          :value="item.name"
          v-model="selectedItems"
          class="hidden-checkbox"
        />
        <div class="item-thumbnail">
          <img 
            :src="getImagePath(item.name)" 
            :alt="getLabel(item.name)"
            @error="handleImageError(item.name)"
            @load="handleImageLoad(item.name)"
          />
          <div v-if="!imageLoaded[item.name]" class="thumbnail-placeholder">
            {{ getPlaceholder(item.name) }}
          </div>
        </div>
        <!-- <div class="item-tooltip">{{ getShortLabel(item.name) }}</div> -->
      </label>
    </div>
    
    <div class="selection-info">
      {{ labels?.ui?.selected || 'Selected' }}: {{ selectedItems.length }} / {{ items.length }}
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'ImageSelector',
  props: {
    items: {
      type: Array,
      required: true
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['plants', 'dishes'].includes(value)
    },
    modelValue: {
      type: Array,
      default: () => []
    },
    labels: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const selectedItems = ref([...props.modelValue]);
    const imageLoaded = ref({});

    const isSelected = (itemName) => {
      return selectedItems.value.includes(itemName);
    };

    const selectAll = () => {
      selectedItems.value = props.items.map(item => item.name);
    };

    const clearAll = () => {
      selectedItems.value = [];
    };

    const getImagePath = (name) => {
      return `/images/${props.type}/${name}.webp`;
    };

    const getLabel = (name) => {
      return props.labels[props.type]?.[name] || name.replace(/_/g, ' ');
    };

    const getShortLabel = (name) => {
      const label = getLabel(name);
      return label.length > 12 ? label.substring(0, 10) + '...' : label;
    };

    const getPlaceholder = (name) => {
      return name.substring(0, 3).toUpperCase();
    };

    const handleImageError = (name) => {
      imageLoaded.value[name] = false;
    };

    const handleImageLoad = (name) => {
      imageLoaded.value[name] = true;
    };

    watch(selectedItems, (newVal, oldVal) => {
      // 只有当数组内容真正发生变化时才emit，避免无限循环
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        emit('update:modelValue', newVal);
      }
    }, { deep: true });

    watch(() => props.modelValue, (newVal) => {
      // 只有当props确实变化时才更新selectedItems
      if (JSON.stringify(newVal) !== JSON.stringify(selectedItems.value)) {
        selectedItems.value = [...newVal];
      }
    }, { deep: true });

    return {
      selectedItems,
      imageLoaded,
      isSelected,
      selectAll,
      clearAll,
      getImagePath,
      getLabel,
      getShortLabel,
      getPlaceholder,
      handleImageError,
      handleImageLoad
    };
  }
};
</script>

<style scoped>
.image-selector {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 10px;
}

.selector-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
  font-weight: 500;
}

.action-btn:hover {
  background: #5a6fd6;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.action-btn-secondary {
  background: #9ca3af;
}

.action-btn-secondary:hover {
  background: #6b7280;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s;
  position: relative;
  background: white;
}

.image-item:hover {
  background: #eef2ff;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-item.selected {
  border-color: #667eea;
  background: #eef2ff;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.hidden-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.item-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
}

.item-tooltip {
  font-size: 0.7em;
  color: #666;
  text-align: center;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  font-weight: 500;
}

.selection-info {
  text-align: center;
  color: #666;
  font-size: 0.9em;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

@media (max-width: 768px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 8px;
  }
  
  .item-thumbnail {
    width: 50px;
    height: 50px;
  }
  
  .item-tooltip {
    font-size: 0.65em;
  }
  
  .selector-actions {
    gap: 8px;
  }
  
  .action-btn {
    padding: 6px 12px;
    font-size: 0.85em;
  }
}

@media (max-width: 480px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 6px;
  }
  
  .item-thumbnail {
    width: 45px;
    height: 45px;
  }
  
  .item-tooltip {
    font-size: 0.6em;
  }
  
  .action-btn {
    padding: 5px 10px;
    font-size: 0.8em;
  }
}
</style>