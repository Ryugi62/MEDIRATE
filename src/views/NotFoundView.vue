<template>
  <div class="not-found-view">
    <h1>404 Not Found</h1>
    <p>Sorry, the page you are looking for does not exist.</p>
  </div>
</template>

<script>
export default {
  name: "NotFoundView",
};
</script>

<style scoped>
.not-found-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.not-found-view h1 {
  margin-bottom: 20px;
}
</style>
