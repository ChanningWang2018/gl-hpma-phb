<template>
  <div class="collapsible-section">
    <button 
      class="collapsible-header"
      @click="toggle"
      :aria-expanded="isOpen"
    >
      <span class="header-icon" :class="{ 'rotated': !isOpen }">▶</span>
      <span class="header-title">{{ title }}</span>
      <span v-if="badgeText" class="header-badge">{{ badgeText }}</span>
    </button>
    
    <div 
      class="collapsible-content"
      :class="{ 'collapsed': !isOpen }"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'CollapsibleSection',
  props: {
    title: {
      type: String,
      required: true
    },
    badgeText: {
      type: String,
      default: ''
    },
    defaultOpen: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    const isOpen = ref(props.defaultOpen);

    const toggle = () => {
      isOpen.value = !isOpen.value;
    };

    return {
      isOpen,
      toggle
    };
  }
};
</script>

<style scoped>
.collapsible-section {
  margin-bottom: 20px;
}

.collapsible-header {
  width: 100%;
  padding: 14px 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1em;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.collapsible-header:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.collapsible-header:active {
  transform: translateY(0);
}

.header-icon {
  transition: transform 0.3s ease;
  font-size: 0.8em;
  display: flex;
  align-items: center;
}

.header-icon.rotated {
  transform: rotate(-90deg);
}

.header-title {
  flex: 1;
  text-align: left;
}

.header-badge {
  background: rgba(255, 255, 255, 0.3);
  padding: 4px 14px;
  border-radius: 16px;
  font-size: 0.85em;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

.collapsible-content {
  overflow: hidden;
  transition: max-height 0.4s ease-out, opacity 0.3s ease-out, padding 0.3s ease-out;
  max-height: 5000px;
  opacity: 1;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 0 0 10px 10px;
  border: 2px solid #667eea;
  border-top: none;
  margin-top: -2px;
}

.collapsible-content.collapsed {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

@media (max-width: 768px) {
  .collapsible-header {
    padding: 12px 14px;
    font-size: 1em;
  }
  
  .collapsible-content {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .collapsible-header {
    padding: 10px 12px;
    font-size: 0.95em;
    gap: 8px;
  }
  
  .header-badge {
    padding: 3px 10px;
    font-size: 0.8em;
  }
  
  .collapsible-content {
    padding: 10px;
  }
}
</style>