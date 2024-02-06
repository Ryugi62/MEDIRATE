<template>
  <div class="slide-bar">
    <ul>
      <router-link v-for="link in links" :key="link.path" :to="link.path">
        <li :class="{ active: nowRoute === link.path }">{{ link.name }}</li>
      </router-link>
    </ul>
  </div>
</template>

<script>
export default {
  name: "SlideBarComponent",

  data() {
    return {
      nowRoute: this.$route.path,
      links: [
        { name: "게시판", path: "/board" },
        { name: "과제 평가", path: "/post" },
        { name: "과제 관리", path: "/assignment" },
        { name: "대시보드", path: "/dashboard" },
      ],
    };
  },

  watch: {
    $route(to) {
      this.nowRoute = to.path;
    },
  },
};
</script>

<style scoped>
.slide-bar {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid var(--light-gray);
}

.slide-bar ul {
  margin: 0;
  padding: 0;
  list-style: none;
  position: sticky;
  top: 70px;
}

.slide-bar li {
  border-bottom: 1px solid var(--light-gray);
  padding-left: 32px;
  line-height: 60px;
}

.slide-bar li.active,
.slide-bar li:hover {
  color: var(--white);
  background-color: var(--blue);
}
</style>
