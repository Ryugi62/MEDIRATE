<template>
  <div id="app">
    <header class="app-header">
      <h1>My Application</h1>

      <!-- 유저 이름 -->
      <div class="user-info">
        <p class="user-name">Logged in as</p>

        <!-- 로그아웃 -->
        <button class="logout-button" @click="logout">Logout</button>
      </div>
    </header>

    <div class="main-content">
      <div class="sidebar">
        <nav class="navbar">
          <ul class="nav-links">
            <li><router-link to="/">Home</router-link></li>
            <!-- <li><router-link to="/login">Login</router-link></li> -->
            <li><router-link to="/dashboard">Dashboard</router-link></li>
            <li><router-link to="/board">Board</router-link></li>
            <li><router-link to="/tasks">Tasks</router-link></li>
            <li><router-link to="/evaluation">Evaluation</router-link></li>
            <!-- More links can be added here -->
          </ul>
        </nav>
      </div>
      <div class="content">
        <router-view />
      </div>
    </div>

    <footer class="app-footer">
      <p>© 2024 My Application. All rights reserved.</p>
    </footer>
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #333;
}

/* Header styles */
.app-header {
  background-color: #f3f4f6; /* Light grey for a clean look */
  color: #333; /* Dark grey for contrast */
  border-bottom: 1px solid #e1e1e1;
  height: 62px; /* Height of the header */
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  padding: 15px 20px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-name {
  margin: 0;
  padding: 15px 20px;
}

.logout-button {
  background-color: #ffffff;
  border: 1px solid #e1e1e1;
  border-radius: 3px;
  padding: 10px 15px;
  margin: 0 20px;
  cursor: pointer;
  color: #333;
}

.logout-button:hover {
  background-color: #f3f4f6;
}

.logout-button:active {
  background-color: #e1e1e1;
}

/* Main content styles */
.main-content {
  display: flex;
  height: calc(100vh - 62px); /* Adjusting height for header and footer */
}

/* Sidebar styles */
.sidebar {
  width: 200px;
  background-color: #ffffff; /* Pure white for sidebar */
  color: #333; /* Dark grey for text */
  border-right: 1px solid #e1e1e1;
}

.nav-links {
  list-style-type: none;
  padding: 0;
}

.nav-links li {
  margin: 10px 0;
}

.nav-links a {
  color: #333;
  text-decoration: none;
  padding: 10px 15px;
  display: block;
}

.nav-links a:hover {
  background-color: #f3f4f6; /* Light grey for hover */
}

/* Content area styles */
.content {
  flex-grow: 1;
  padding: 20px;
  background-color: #fafafa; /* Slightly off-white for the main content */
  color: #333;
  overflow-y: auto;
}

/* Footer styles */
.app-footer {
  background-color: #f3f4f6;
  color: #333;
  padding: 15px 20px;
  border-top: 1px solid #e1e1e1;
  text-align: center;
}
</style>
