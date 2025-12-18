<template>
  <div class="error-message" :class="[`error-message--${variant}`]">
    <i class="fa-solid fa-circle-exclamation error-icon"></i>
    <div class="error-content">
      <span class="error-text">{{ message }}</span>
      <button v-if="retryable" class="retry-button" @click="$emit('retry')">
        <i class="fa-solid fa-rotate-right"></i>
        다시 시도
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "ErrorMessage",
  props: {
    message: {
      type: String,
      default: "오류가 발생했습니다.",
    },
    retryable: {
      type: Boolean,
      default: false,
    },
    variant: {
      type: String,
      default: "error",
      validator: (value) => ["error", "warning", "info"].includes(value),
    },
  },
  emits: ["retry"],
};
</script>

<style scoped>
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background-color: var(--pink-light);
  border: 1px solid var(--pink);
}

.error-message--warning {
  background-color: var(--yellow-light);
  border-color: var(--yellow);
}

.error-message--warning .error-icon {
  color: var(--yellow);
}

.error-message--info {
  background-color: var(--blue-light);
  border-color: var(--blue);
}

.error-message--info .error-icon {
  color: var(--blue);
}

.error-icon {
  font-size: var(--font-size-xl);
  color: var(--pink);
  flex-shrink: 0;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.error-text {
  color: var(--black);
  font-size: var(--font-size-md);
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: transparent;
  color: var(--pink);
  border: 1px solid var(--pink);
  font-size: var(--font-size-sm);
  cursor: pointer;
  width: fit-content;
}

.retry-button:hover {
  background-color: var(--pink);
  color: var(--white);
}
</style>
