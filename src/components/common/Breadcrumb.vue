<template>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="breadcrumb-item"
        :class="{ 'breadcrumb-item--active': index === items.length - 1 }"
      >
        <router-link
          v-if="index < items.length - 1"
          :to="item.path"
          class="breadcrumb-link"
        >
          {{ item.name }}
        </router-link>
        <span v-else class="breadcrumb-current">{{ item.name }}</span>
        <i
          v-if="index < items.length - 1"
          class="fa-solid fa-chevron-right breadcrumb-separator"
        ></i>
      </li>
    </ol>
  </nav>
</template>

<script>
export default {
  name: "BreadcrumbComponent",
  props: {
    items: {
      type: Array,
      default: () => [],
      validator: (value) =>
        value.every((item) => item.name && (item.path || true)),
    },
  },
};
</script>

<style scoped>
.breadcrumb {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--ultra-light-gray);
  border-bottom: 1px solid var(--light-gray);
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--spacing-sm);
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.breadcrumb-link {
  color: var(--blue);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: color var(--transition-fast);
}

.breadcrumb-link:hover {
  color: var(--blue-hover);
  text-decoration: underline;
}

.breadcrumb-current {
  color: var(--gray);
  font-size: var(--font-size-sm);
}

.breadcrumb-separator {
  color: var(--light-gray);
  font-size: var(--font-size-xs);
}
</style>
