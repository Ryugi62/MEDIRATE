<template>
  <div class="skeleton-loader">
    <!-- 테이블 스켈레톤 -->
    <template v-if="type === 'table'">
      <div class="skeleton-table">
        <div class="skeleton-row skeleton-header">
          <div
            v-for="col in columns"
            :key="col"
            class="skeleton-cell"
            :style="{ width: col + '%' }"
          ></div>
        </div>
        <div v-for="row in rows" :key="row" class="skeleton-row">
          <div
            v-for="col in columns"
            :key="col"
            class="skeleton-cell"
            :style="{ width: col + '%' }"
          ></div>
        </div>
      </div>
    </template>

    <!-- 카드 스켈레톤 -->
    <template v-else-if="type === 'card'">
      <div class="skeleton-card">
        <div class="skeleton-card-image"></div>
        <div class="skeleton-card-content">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--text"></div>
          <div class="skeleton-line skeleton-line--text short"></div>
        </div>
      </div>
    </template>

    <!-- 텍스트 스켈레톤 -->
    <template v-else>
      <div v-for="line in lines" :key="line" class="skeleton-line"></div>
    </template>
  </div>
</template>

<script>
export default {
  name: "SkeletonLoader",
  props: {
    type: {
      type: String,
      default: "text",
      validator: (value) => ["text", "table", "card"].includes(value),
    },
    rows: {
      type: Number,
      default: 5,
    },
    columns: {
      type: Array,
      default: () => [10, 20, 40, 15, 15],
    },
    lines: {
      type: Number,
      default: 3,
    },
  },
};
</script>

<style scoped>
.skeleton-loader {
  width: 100%;
}

/* 공통 애니메이션 */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-cell,
.skeleton-line,
.skeleton-card-image {
  background: linear-gradient(
    90deg,
    var(--ultra-light-gray) 25%,
    var(--light-gray) 50%,
    var(--ultra-light-gray) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

/* 테이블 스켈레톤 */
.skeleton-table {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.skeleton-row {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
}

.skeleton-header {
  background-color: var(--ultra-light-gray);
}

.skeleton-cell {
  height: 20px;
}

/* 카드 스켈레톤 */
.skeleton-card {
  border: 1px solid var(--light-gray);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.skeleton-card-image {
  height: 150px;
  border-radius: 0;
}

.skeleton-card-content {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* 텍스트 스켈레톤 */
.skeleton-line {
  height: 16px;
  margin-bottom: var(--spacing-sm);
}

.skeleton-line--title {
  height: 24px;
  width: 60%;
}

.skeleton-line--text {
  width: 100%;
}

.skeleton-line--text.short {
  width: 40%;
}
</style>
