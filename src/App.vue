<template>
  <div id="app">
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
      <div class="container">
        <a class="navbar-brand" href="#">의료이미지평가시스템</a>
        <button
          v-if="isAuthenticated"
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item" v-if="isAuthenticated">
              <a class="nav-link">{{ getUser().username }}</a>
            </li>
            <li class="nav-item" v-if="isAuthenticated">
              <button class="btn btn-outline-light" @click="logout">
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="d-flex">
      <!-- Sidebar -->
      <div class="sidebar bg-light">
        <div class="list-group list-group-flush">
          <router-link
            to="/"
            class="list-group-item list-group-item-action"
            :class="{ active: $route.path === '/' }"
            >홈</router-link
          >
          <router-link
            to="/dashboard"
            v-if="isAdmin"
            class="list-group-item list-group-item-action"
            :class="{ active: $route.path === '/dashboard' }"
            >Dashboard</router-link
          >
          <router-link
            to="/board"
            class="list-group-item list-group-item-action"
            :class="{
              active: $route.path === '/board' || $route.path.includes('/post'),
            }"
            >Q&A 게시판</router-link
          >
          <router-link
            to="/tasks"
            class="list-group-item list-group-item-action"
            :class="{ active: $route.path === '/tasks' }"
            >과제 게시판</router-link
          >
          <router-link
            to="/evaluation"
            class="list-group-item list-group-item-action"
            :class="{ active: $route.path === '/evaluation' }"
            >Evaluation</router-link
          >
        </div>
      </div>
      <!-- Content -->
      <div class="content flex-grow-1 p-3">
        <router-view />
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer bg-dark text-light text-center p-3">
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
html,
body,
#app {
  height: 100%;
}

.sidebar {
  top: 0;
  width: 250px;
  position: sticky;
}

.content {
  min-height: calc(100vh - 100px);
}

.footer {
  height: 100px;
}
</style>
