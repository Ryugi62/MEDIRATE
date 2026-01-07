<template>
  <div class="shortcut-help-panel" :class="{ collapsed: isCollapsed }">
    <!-- 접기/펼치기 버튼 -->
    <button class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '펼치기' : '접기'">
      <i :class="['fas', isCollapsed ? 'fa-chevron-left' : 'fa-chevron-right']"></i>
    </button>

    <div class="help-content" v-show="!isCollapsed">
      <!-- 조작법 섹션 -->
      <div class="help-section" v-if="operations.length > 0">
        <div class="help-title">조작법</div>
        <div class="help-item" v-for="op in operations" :key="op.action">
          <span class="help-action">{{ op.action }}</span>
          <span class="help-desc">{{ op.description }}</span>
        </div>
      </div>

      <!-- 단축키 섹션 -->
      <div class="help-section" v-if="shortcuts.length > 0">
        <div class="help-title">단축키</div>
        <div class="help-item" v-for="sc in shortcuts" :key="sc.key">
          <kbd class="help-kbd">{{ sc.key }}</kbd>
          <span class="help-desc">{{ sc.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ShortcutHelp",
  props: {
    operations: {
      type: Array,
      default: () => [],
      // 예: [{ action: "좌클릭", description: "박스 추가" }]
    },
    shortcuts: {
      type: Array,
      default: () => [],
      // 예: [{ key: "Ctrl+A", description: "AI 탐지 표시" }]
    },
  },
  data() {
    return {
      isCollapsed: false,
    };
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      this.$emit("collapse-change", this.isCollapsed);
    },
  },
};
</script>

<style scoped>
.shortcut-help-panel {
  width: 180px;
  flex-shrink: 0;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  font-size: 11px;
  position: relative;
  transition: width 0.2s ease, padding 0.2s ease;
  align-self: flex-start;
}

.shortcut-help-panel.collapsed {
  width: 28px;
  padding: 8px 4px;
}

.collapse-btn {
  position: absolute;
  left: 4px;
  top: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.collapse-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.collapse-btn i {
  font-size: 10px;
}

.help-content {
  margin-left: 20px;
}

.help-section {
  margin-bottom: 10px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e0e0e0;
  font-size: 11px;
}

.help-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.help-item:last-child {
  margin-bottom: 0;
}

.help-action {
  color: #007bff;
  font-weight: 500;
  white-space: nowrap;
  min-width: 48px;
}

.help-kbd {
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 10px;
  color: #495057;
  white-space: nowrap;
  min-width: 48px;
  text-align: center;
  display: inline-block;
}

.help-desc {
  color: #666;
  flex: 1;
}
</style>
