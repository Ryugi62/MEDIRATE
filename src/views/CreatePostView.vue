<template>
  <div class="container my-5">
    <div class="card shadow">
      <div class="card-body">
        <h1 class="card-title fs-2">게시물 작성</h1>
        <hr />

        <!-- 게시물 입력 폼 -->
        <form @submit.prevent="createPost">
          <div class="mb-3">
            <label for="postTitle" class="form-label">제목</label>
            <input
              type="text"
              class="form-control"
              id="postTitle"
              v-model="postTitle"
              required
            />
          </div>
          <div class="mb-3">
            <label for="postContent" class="form-label">내용</label>
            <textarea
              class="form-control"
              id="postContent"
              v-model="postContent"
              rows="4"
              required
            ></textarea>
          </div>
          <button type="submit" class="btn btn-primary">게시물 작성</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "CreatePostView",

  data() {
    return {
      postTitle: "",
      postContent: "",
    };
  },
  methods: {
    createPost() {
      // 여기에서 게시물을 생성하고 저장하는 로직을 추가하세요.
      //   const newPost = {
      //     title: this.postTitle,
      //     content: this.postContent,
      //     // 필요한 다른 속성들을 추가하세요.
      //   };

      // 예시: 게시물을 저장하는 API 호출 또는 저장 로직
      // axios.post('/api/posts', newPost)
      //   .then(response => {
      //     // 게시물 작성이 성공하면 처리
      //     console.log('게시물이 성공적으로 작성되었습니다.');
      //     // 게시물 작성 후 리다이렉트 또는 다른 작업을 수행할 수 있습니다.
      //   })
      //   .catch(error => {
      //     // 오류 처리
      //     console.error('게시물 작성 중 오류가 발생했습니다.', error);
      //   });

      // 게시물 작성 후 폼 초기화
      this.postTitle = "";
      this.postContent = "";
    },
  },
};
</script>

<style scoped>
.card {
  border-radius: 0.5rem;
  border: none;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}
.card-title {
  color: #007bff;
  margin-bottom: 1rem;
}
.card-text {
  font-size: 1.1rem;
  color: #495057;
  min-height: 150px;
}
</style>
