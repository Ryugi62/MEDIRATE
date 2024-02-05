<template>
  <div>
    <h1 class="board__title">게시판</h1>
    <form class="create-post__form" @submit.prevent="createPost">
      <div class="form__group">
        <input
          type="text"
          id="post-title"
          v-model="postTitle"
          class="form__input"
          placeholder="제목을 입력하세요."
          required
        />
      </div>

      <div class="form__group post-info">
        <div class="user-name">{{ $store.getters.getUser.username }}</div>
        <div class="date">{{ new Date().toISOString().split("T")[0] }}</div>
      </div>

      <hr />

      <div class="form__group">
        <quill-editor
          v-model="postContent"
          :options="editorOptions"
          placeholder="내용을 입력하세요."
        ></quill-editor>
      </div>

      <div class="form__group button-group">
        <button type="submit" class="form__submit-button">작성</button>
        <button
          type="button"
          class="form__submit-button form__submit-button--cancel"
          @click="cancelPostCreation"
        >
          취소
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";

export default {
  components: {
    QuillEditor,
  },
  data() {
    return {
      postTitle: "",
      postContent: "",
      editorOptions: {
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "image"],
            ["clean"],
          ],
        },
      },
    };
  },
  methods: {
    createPost() {
      const content = document.querySelector(".ql-editor").innerHTML;

      // 게시물 생성 로직
      console.log("게시물 생성:", this.postTitle, content);
      // 여기서 게시물 데이터를 API에 전송하거나 상태 관리 라이브러리에 저장할 수 있습니다.

      // 폼 초기화
      this.postTitle = "";
      this.postContent = "";
    },
  },
};
</script>

<style scoped>
.board__title {
  margin: 0;
  padding: 14px 24px;
  font-size: 24px;
  font-weight: 500;
  border-bottom: 1px solid var(--light-gray);
}

.form__group {
  margin-bottom: 16px;
}

.create-post__form {
  margin-top: 41px;
  margin-left: 24px;
  margin-right: 46px;
}

#post-title {
  padding: 8px;
  font-size: 30px;
  width: calc(100% - 16px);
}

.post-info {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

hr {
  margin: 0;
  margin-bottom: 16px;
}

.button-group {
  gap: 8px;
  display: flex;
  justify-content: center;
}

.form__submit-button--cancel {
  background-color: var(--pink);
}
</style>

<style>
.ql-editor {
  min-height: 550px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 16px;
  word-break: break-all;
}
</style>
