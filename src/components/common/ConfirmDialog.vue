<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="confirm-overlay" @click.self="cancel" @keydown.esc="cancel">
        <div class="confirm-dialog"
             :class="[`confirm-dialog--${variant}`]"
             role="alertdialog"
             aria-modal="true"
             :aria-labelledby="'dialog-title-' + dialogId"
             :aria-describedby="'dialog-desc-' + dialogId">
          <div class="confirm-header">
            <i :class="['confirm-icon', 'fa-solid', iconClass]" aria-hidden="true"></i>
            <h3 :id="'dialog-title-' + dialogId" class="confirm-title">{{ title }}</h3>
          </div>
          <p :id="'dialog-desc-' + dialogId" class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button ref="cancelButton" class="cancel-button" @click="cancel">
              {{ cancelText }}
            </button>
            <button
              class="confirm-button"
              :class="[`confirm-button--${variant}`]"
              @click="confirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
let dialogCounter = 0;

export default {
  name: "ConfirmDialog",
  data() {
    return {
      isOpen: false,
      title: "",
      message: "",
      confirmText: "확인",
      cancelText: "취소",
      variant: "danger",
      resolvePromise: null,
      previousActiveElement: null,
      dialogId: ++dialogCounter,
    };
  },
  computed: {
    iconClass() {
      const icons = {
        danger: "fa-triangle-exclamation",
        warning: "fa-circle-exclamation",
        info: "fa-circle-info",
      };
      return icons[this.variant] || icons.danger;
    },
  },
  methods: {
    open(options = {}) {
      this.title = options.title || "확인";
      this.message = options.message || "계속하시겠습니까?";
      this.confirmText = options.confirmText || "확인";
      this.cancelText = options.cancelText || "취소";
      this.variant = options.variant || "danger";

      // 이전 포커스 저장
      this.previousActiveElement = document.activeElement;
      this.isOpen = true;

      // 포커스 트랩: 다음 틱에 취소 버튼으로 포커스
      this.$nextTick(() => {
        this.$refs.cancelButton?.focus();
      });

      return new Promise((resolve) => {
        this.resolvePromise = resolve;
      });
    },
    confirm() {
      this.isOpen = false;
      // 이전 포커스로 복원
      this.previousActiveElement?.focus();
      if (this.resolvePromise) {
        this.resolvePromise(true);
      }
    },
    cancel() {
      this.isOpen = false;
      // 이전 포커스로 복원
      this.previousActiveElement?.focus();
      if (this.resolvePromise) {
        this.resolvePromise(false);
      }
    },
  },
};
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background-color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-xl);
  max-width: 400px;
  width: 90%;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.confirm-icon {
  font-size: var(--font-size-2xl);
}

.confirm-dialog--danger .confirm-icon {
  color: var(--pink);
}

.confirm-dialog--warning .confirm-icon {
  color: var(--yellow);
}

.confirm-dialog--info .confirm-icon {
  color: var(--blue);
}

.confirm-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--black);
}

.confirm-message {
  margin: 0 0 var(--spacing-xl);
  font-size: var(--font-size-md);
  color: var(--gray);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.cancel-button {
  background-color: var(--white);
  color: var(--gray);
  border: 1px solid var(--light-gray);
}

.cancel-button:hover {
  background-color: var(--ultra-light-gray);
}

.confirm-button--danger {
  background-color: var(--pink);
}

.confirm-button--danger:hover {
  background-color: var(--pink-hover);
}

.confirm-button--warning {
  background-color: var(--yellow);
  color: var(--black);
}

.confirm-button--warning:hover {
  background-color: var(--yellow-hover);
}

.confirm-button--info {
  background-color: var(--blue);
}

.confirm-button--info:hover {
  background-color: var(--blue-hover);
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
