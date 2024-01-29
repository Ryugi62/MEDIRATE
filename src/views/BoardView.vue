<template>
  <div class="board-container">
    <h1>Board</h1>
    <ul class="board-list">
      <li v-for="post in posts" :key="post.id">
        <router-link :to="{ name: 'post', params: { id: post.id } }">
          {{ post.title }}
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script>
// 임시 데이터를 사용합니다. 실제 애플리케이션에서는 API 호출 등을 통해 데이터를 가져옵니다.
const mockPosts = [
  { id: 1, title: "Post 1" },
  { id: 2, title: "Post 2" },
  { id: 3, title: "Post 3" },
];

export default {
  name: "BoardView",
  data() {
    return {
      posts: mockPosts,
    };
  },
};
</script>

<style>
.board-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.board-list {
  list-style: none;
  padding: 0;
}

.board-list li {
  margin-bottom: 10px;
}

.board-list li a {
  text-decoration: none;
  color: #007bff;
}

.board-list li a:hover {
  text-decoration: underline;
}
</style>
