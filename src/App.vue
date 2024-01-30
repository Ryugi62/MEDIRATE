<template>
  <div id="app">
    <header class="app-header">
      <div class="logo">
        <p class="logo-text">의료이미지평가시스템</p>
      </div>
      <div class="user-info" v-if="isAuthenticated">
        <p class="user-name">{{ getUser().username }}</p>
        <button class="logout-button" @click="logout">Logout</button>
      </div>
    </header>

    <div class="main-content">
      <div class="sidebar">
        <nav class="navbar">
          <ul class="nav-links">
            <li :class="{ active: $route.path === '/' }">
              <router-link to="/">홈</router-link>
            </li>
            <li v-if="isAdmin" :class="{ active: $route.path === '/users' }">
              <router-link to="/dashboard">Dashboard</router-link>
            </li>
            <!-- /board or /post/1 or /post/2 ... -->
            <li
              :class="{
                active:
                  $route.path === '/board' || $route.path.includes('/post'),
              }"
            >
              <router-link to="/board">Q&A 게시판</router-link>
            </li>
            <li :class="{ active: $route.path === '/tasks' }">
              <router-link to="/tasks">과제 게시판</router-link>
            </li>
            <li :class="{ active: $route.path === '/evaluation' }">
              <router-link to="/evaluation">Evaluation</router-link>
            </li>
          </ul>
        </nav>
      </div>
      <div class="content">
        <router-view />
      </div>
    </div>

    <footer class="app-footer">
      <p>© 2024 Medical Image Evaluation System. All rights reserved.</p>
    </footer>
  </div>
</template>

<script>
export default {
  computed: {
    isAuthenticated() {
      return this.$store.getters.isAuthenticated;
    },
    isAdmin() {
      return this.isAuthenticated && this.getUser().isAdministrator;
    },
  },
  methods: {
    getUser() {
      return this.$store.getters.getUser;
    },
    logout() {
      this.$store.dispatch("logoutUser");
      this.$router.push("/login");
    },
  },
};
</script>

<style>
/* General styles */
body {
  margin: 0;
  font-family: "Helvetica Neue", sans-serif;
  font-size: 16px;
  color: #333;
}

/* Header styles */
.app-header {
  background-color: #333;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  height: 40px;
}

/* Logo styles */
.logo {
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin: 0;
  padding: 0;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-name {
  margin-right: 20px;
  font-weight: bold;
}

.logout-button {
  background-color: #fff;
  color: #333;
  border: none;
  border-radius: 5px;
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.logout-button:hover {
  background-color: #444;
  color: #fff;
}

.main-content {
  display: flex;
  flex-direction: row;
  min-height: calc(100vh - 50px);
}

/* Sidebar styles */
.sidebar {
  width: 220px;
  background-color: #fff;
  color: #333;
  border-right: 1px solid #ddd;
  padding-top: 20px;
}

.nav-links {
  margin: 0;
  padding: 0;
}

.nav-links li {
  list-style: none;
}

.nav-links a {
  color: #333;
  text-decoration: none;
  display: block;
  padding: 20px;
  transition: background-color 0.3s;
}

.nav-links a:hover {
  background-color: #eee;
}

.nav-links .active a {
  background-color: #ddd;
}

/* Content area styles */
.content {
  flex-grow: 1;
  padding: 20px;
  background-color: #f9f9f9;
  color: #333;
  /* 넘어가면 자동으로 늘어나게 */
}

/* Footer styles */
.app-footer {
  background-color: #333;
  color: #fff;
  text-align: center;
  padding: 15px 0;
}
</style>
