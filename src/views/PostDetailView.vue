<template>
  <div class="post-detail">
    <h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>
    <!-- 기타 게시물 상세 정보 -->
  </div>
</template>

<script>
export default {
  name: "PostDetailView",
  data() {
    return {
      post: {
        title: "", // 임시 데이터
        content: "", // 임시 데이터
      },
    };
  },
  created() {
    this.fetchPost();
  },
  methods: {
    fetchPost() {
      // URL에서 id 매개변수를 가져옵니다.
      const postId = this.$route.params.id;
      // 여기에 API 요청 로직을 추가하여 게시물 데이터를 가져옵니다.
      // 예시: axios.get(`/api/posts/${postId}`).then(response => { ... })
      console.log(`Fetching post with id: ${postId}`);
      // 임시 데이터 설정
      this.post = { title: "Post Title", content: "Post content..." };
    },
  },
};
</script>

<style>
.post-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.post-detail h1 {
  margin-bottom: 20px;
}

/* 기타 스타일 */
</style>
