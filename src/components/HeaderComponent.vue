<template>
  <header>
    <!-- hambuger menu icon -->
    <i
      v-if="this.$store.getters.isAuthenticated"
      class="fa-solid fa-bars menu-icon"
      @click="this.$store.commit('toggleSlideBar')"
      :class="{ active: this.$store.getters.isSlideBarOpen }"
    ></i>

    <!-- title -->
    <router-link to="/" class="title">의료이미지평가시스템</router-link>

    <!-- user_name and logout button -->
    <div class="user-info" v-if="this.$store.getters.isAuthenticated">
      <i class="fa-solid fa-user user-icon"></i>
      <span>{{ $store.getters.getUser.username }}</span>
      <button @click="logout">로그아웃</button>
    </div>
  </header>
</template>

<script>
export default {
  name: "HeaderComponent",

  methods: {
    logout() {
      this.$router.push({ name: "login" });
    },
  },
};
</script>

<style scoped>
header {
  background-color: var(--white);
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 70px;
  border-bottom: 1px solid var(--light-gray);
  position: sticky;
  top: 0;
  z-index: 99;
}

.menu-icon {
  padding: 2px;
  margin-left: 32px;
  font-size: 24px;
  transition: 0.105s;
}
.menu-icon:hover {
  color: var(--blue-hover);
  cursor: pointer;
}
.menu-icon:active {
  color: var(--blue-active);
  transform: scale(0.9);
}

.menu-icon.active {
  color: var(--blue-hover);
}

.title {
  margin: 0;
  color: var(--blue);
  font-size: 24px;
  margin: auto;
  font-weight: bold;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.title:hover {
  color: var(--blue-hover);
}
.title:active {
  color: var(--blue-active);
}

.user-info {
  display: flex;
  align-items: center;
  margin-right: 46px;
}

.user-icon {
  margin-right: 8px;
  font-size: 16px;
}

.user-info span {
  margin-right: 24px;
}

@media (max-width: 768px) {
  .menu-icon {
    margin-left: 16px;
  }

  .user-info {
    margin-right: 16px;

    i {
      display: none;
    }

    span {
      display: none;
    }

    button {
      font-size: 12px;
    }
  }
}
</style>
