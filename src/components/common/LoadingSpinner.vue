<template>
  <div class="loading-spinner" :class="[`loading-spinner--${size}`]">
    <div class="spinner"></div>
    <span v-if="message" class="loading-message">{{ message }}</span>
  </div>
</template>

<script>
export default {
  name: "LoadingSpinner",
  props: {
    size: {
      type: String,
      default: "md",
      validator: (value) => ["sm", "md", "lg"].includes(value),
    },
    message: {
      type: String,
      default: "",
    },
  },
};
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.spinner {
  border: 3px solid var(--light-gray);
  border-top: 3px solid var(--blue);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
}

.loading-spinner--sm .spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.loading-spinner--md .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.loading-spinner--lg .spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

.loading-message {
  color: var(--gray);
  font-size: var(--font-size-md);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
