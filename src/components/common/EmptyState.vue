<template>
  <div class="empty-state">
    <i :class="['empty-icon', 'fa-solid', icon]"></i>
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="description" class="empty-description">{{ description }}</p>
    <button v-if="actionText" class="empty-action" @click="$emit('action')">
      {{ actionText }}
    </button>
  </div>
</template>

<script>
export default {
  name: "EmptyState",
  props: {
    icon: {
      type: String,
      default: "fa-inbox",
    },
    title: {
      type: String,
      default: "데이터가 없습니다",
    },
    description: {
      type: String,
      default: "",
    },
    actionText: {
      type: String,
      default: "",
    },
  },
  emits: ["action"],
};
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  text-align: center;
  min-height: 200px;
}

.empty-icon {
  font-size: 48px;
  color: var(--light-gray);
  margin-bottom: var(--spacing-lg);
}

.empty-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--black);
}

.empty-description {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-md);
  color: var(--gray);
  max-width: 300px;
}

.empty-action {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-lg);
}
</style>
