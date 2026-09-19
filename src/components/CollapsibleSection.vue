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
  padding: 12px 16px;
  background: var(--paper-deep);
  color: var(--ink);
  border: 1px solid var(--rule);
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-serif);
  font-size: 1.15em;
  font-weight: 400;
  transition: background 0.25s, border-color 0.25s;
}

.collapsible-header:hover {
  background: rgba(var(--accent-rgb), 0.08);
  border-color: var(--ink-faded);
}

.collapsible-header:active {
  transform: translateY(0);
}

.header-icon {
  transition: transform 0.3s ease;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  color: var(--ink-faded);
}

.header-icon.rotated {
  transform: rotate(-90deg);
}

.header-title {
  flex: 1;
  text-align: left;
}

.header-badge {
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  color: var(--oxblood);
  padding: 3px 12px;
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 0.8em;
  font-weight: 400;
}

.collapsible-content {
  overflow: hidden;
  transition: max-height 0.4s ease-out, opacity 0.3s ease-out, padding 0.3s ease-out;
  max-height: 5000px;
  opacity: 1;
  padding: 15px;
  background: transparent;
  border-radius: 0 0 2px 2px;
  border: 1px solid var(--rule);
  border-top: none;
  margin-top: -1px;
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
    padding: 8px;
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
    padding: 6px;
  }
}
</style>