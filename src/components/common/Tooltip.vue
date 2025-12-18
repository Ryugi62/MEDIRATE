<template>
  <div class="tooltip-wrapper" @mouseenter="show" @mouseleave="hide">
    <slot></slot>
    <Transition name="tooltip">
      <div
        v-if="isVisible"
        class="tooltip"
        :class="[`tooltip--${position}`]"
        role="tooltip"
      >
        {{ content }}
        <div class="tooltip-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<script>
export default {
  name: "TooltipComponent",
  props: {
    content: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      default: "top",
      validator: (value) => ["top", "bottom", "left", "right"].includes(value),
    },
    delay: {
      type: Number,
      default: 200,
    },
  },
  data() {
    return {
      isVisible: false,
      timeout: null,
    };
  },
  methods: {
    show() {
      this.timeout = setTimeout(() => {
        this.isVisible = true;
      }, this.delay);
    },
    hide() {
      clearTimeout(this.timeout);
      this.isVisible = false;
    },
  },
};
</script>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--black);
  color: var(--white);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
}

.tooltip--top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: var(--spacing-sm);
}

.tooltip--bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: var(--spacing-sm);
}

.tooltip--left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: var(--spacing-sm);
}

.tooltip--right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: var(--spacing-sm);
}

.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 6px solid transparent;
}

.tooltip--top .tooltip-arrow {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--black);
}

.tooltip--bottom .tooltip-arrow {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--black);
}

.tooltip--left .tooltip-arrow {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: var(--black);
}

.tooltip--right .tooltip-arrow {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: var(--black);
}

/* Transition */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity var(--transition-fast);
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
