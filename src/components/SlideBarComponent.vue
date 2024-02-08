<template>
  <div class="slide-bar">
    <ul>
      <router-link
        v-for="link in links"
        :key="link.name"
        :to="getDefaultPath(link.paths)"
      >
        <li :class="{ active: isLinkActive(link.paths) }">{{ link.name }}</li>
      </router-link>
    </ul>
  </div>
</template>

<script>
export default {
  name: "SlideBarComponent",

  data() {
    return {
      links: [
        { name: "게시판", paths: ["/", "/board", "/post/:id"] },
        { name: "과제 평가", paths: ["/tasks"] },
        { name: "과제 관리", paths: ["/evaluation"] },
        { name: "대시보드", paths: ["/dashboard"] },
        // 추가 링크는 여기에 정의
      ],
    };
  },

  methods: {
    getDefaultPath(paths) {
      // 첫 번째 경로를 기본 경로로 사용
      return paths[0];
    },
    isLinkActive(paths) {
      // 현재 경로가 링크의 경로 중 하나와 일치하는지 확인
      return paths.some((path) => this.matchPath(path, this.$route.path));
    },
    matchPath(pattern, currentPath) {
      if (pattern === currentPath) {
        // 정확한 문자열 일치
        return true;
      } else if (pattern.includes(":")) {
        // 동적 경로 패턴 처리 (예: /post/:id)
        const regexPattern = pattern
          .replace(/:[^\s/]+/g, "([^/]+)")
          .replace(/\//g, "\\/");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(currentPath);
      }
      return false;
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
