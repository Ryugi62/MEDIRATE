<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="[`toast--${toast.type}`]"
      >
        <i :class="['toast-icon', 'fa-solid', getIcon(toast.type)]"></i>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="removeToast(toast.id)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script>
export default {
  name: "ToastNotification",
  data() {
    return {
      toasts: [],
      nextId: 0,
    };
  },
  methods: {
    show(message, type = "info", duration = 3000) {
      // C1: 동일 메시지 중복 표시 방지
      const isDuplicate = this.toasts.some(
        (t) => t.message === message && t.type === type
      );
      if (isDuplicate) return;

      const id = this.nextId++;
      this.toasts.push({ id, message, type });

      if (duration > 0) {
        setTimeout(() => {
          this.removeToast(id);
        }, duration);
      }
    },
    success(message, duration = 3000) {
      this.show(message, "success", duration);
    },
    error(message, duration = 5000) {
      this.show(message, "error", duration);
    },
    warning(message, duration = 4000) {
      this.show(message, "warning", duration);
    },
    info(message, duration = 3000) {
      this.show(message, "info", duration);
    },
    removeToast(id) {
      const index = this.toasts.findIndex((t) => t.id === id);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    },
    getIcon(type) {
      const icons = {
        success: "fa-circle-check",
        error: "fa-circle-xmark",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info",
      };
      return icons[type] || icons.info;
    },
  },
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background-color: var(--white);
  box-shadow: var(--shadow-lg);
  min-width: 280px;
  max-width: 400px;
}

.toast--success {
  border-left: 4px solid var(--green);
}

.toast--success .toast-icon {
  color: var(--green);
}

.toast--error {
  border-left: 4px solid var(--pink);
}

.toast--error .toast-icon {
  color: var(--pink);
}

.toast--warning {
  border-left: 4px solid var(--yellow);
}

.toast--warning .toast-icon {
  color: var(--yellow);
}

.toast--info {
  border-left: 4px solid var(--blue);
}

.toast--info .toast-icon {
  color: var(--blue);
}

.toast-icon {
  font-size: var(--font-size-xl);
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: var(--font-size-md);
  color: var(--black);
}

.toast-close {
  background: none;
  border: none;
  padding: var(--spacing-xs);
  color: var(--gray);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  color: var(--black);
  background: none;
}

/* Transitions */
.toast-enter-active {
  transition: all var(--transition-normal);
}

.toast-leave-active {
  transition: all var(--transition-fast);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
