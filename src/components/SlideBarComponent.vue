<template>
  <!-- slide bar component -->
  <div class="slide-bar">
    <ul>
      <!-- / -> home -->
      <router-link to="/">
        <li>Home</li>
      </router-link>

      <!-- /board -> board -->
      <router-link to="/board">
        <li>Board</li>
      </router-link>

      <!-- /post -> post -->
      <router-link to="/post">
        <li>Post</li>
      </router-link>
    </ul>
  </div>
</template>

<script>
export default {
  name: "SlideBarComponent",
};
</script>

<style scoped>
.slide-bar {
  width: 200px;
  background-color: #fafbfb;
  height: 100%;
}

.slide-bar h1 {
  margin: 0;
  margin: 20px;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 1px solid #eaecef;
}

.slide-bar ul {
  margin: 0;
  padding: 0;
  list-style: none;
  position: sticky;
  top: 71px;
}

.slide-bar li {
  padding: 10px 20px;
  border-bottom: 1px solid #eaecef;
}

.slide-bar li:hover {
  background-color: #eaecef;
}
</style>
