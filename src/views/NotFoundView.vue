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
  height: calc(100vh - 71px);
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.not-found-view h1 {
  margin-bottom: 20px;
}
</style>
