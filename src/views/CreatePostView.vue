<template>
  <h1 class="board__title">게시판</h1>
  <div class="board">
    <form class="create-post__form" @submit.prevent="createPost">
      <!-- select box 공지사항 or 게시물 -->
      <div class="form__group" v-if="isAdministrator">
        <select class="form__input select-box" v-model="postType">
          <option value="notice">공지사항</option>
          <option value="post">게시물</option>
        </select>
      </div>

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
          v-model:content="postContent"
          contentType="html"
          theme="snow"
          :options="editorOptions"
          placeholder="내용을 입력하세요."
        ></quill-editor>
      </div>

      <div class="form__group file-upload">
        <input
          type="file"
          @change="handleFileUpload"
          multiple
          id="file-upload"
          style="display: none"
        />
        <label for="file-upload" class="file-upload__label">파일 선택</label>
        <div class="file-upload__preview">
          <ul v-if="fileNames.length > 0">
            <li v-for="(fileName, index) in fileNames" :key="index">
              {{ fileName }}
            </li>
          </ul>
        </div>
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
      fileNames: [], // 파일 이름을 저장할 배열
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
      postType: "post", // 기본값으로 '게시물'을 선택합니다.
    };
  },

  computed: {
    isAdministrator() {
      return this.$store.getters.getUser.isAdministrator;
    },
  },

  methods: {
    createPost() {
      let formData = new FormData();
      formData.append("title", this.postTitle);
      formData.append("content", this.postContent); // Ensure this contains the expected data
      formData.append("userId", this.$store.getters.getUser.username);
      formData.append("postType", this.postType); // 공지사항인지 일반 게시물인지를 서버로 전송합니다.

      const files = document.querySelector("#file-upload").files;
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      this.$axios
        .post("/api/posts", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((response) => {
          console.log("Post created successfully:", response.data);
          this.resetForm();
          this.$router.push("/"); // Redirect to the home or post listing page
        })
        .catch((error) => {
          console.error("Error creating post:", error);
        });
    },

    resetForm() {
      this.postTitle = "";
      this.postContent = "";
      this.fileNames = [];
      // Reset any other state related to post creation
    },

    cancelPostCreation() {
      this.postTitle = "";
      this.postContent = "";
      this.fileNames = []; // 취소 시 파일 이름 배열 초기화

      // 게시물 작성 취소 시 홈 화면으로 이동
      this.$router.push("/");
    },

    handleFileUpload(event) {
      this.fileNames = []; // 기존 선택된 파일 이름들을 초기화
      const files = event.target.files;
      if (files.length > 0) {
        Array.from(files).forEach((file) => {
          this.fileNames.push(file.name); // 파일 이름을 배열에 추가
          // 여기서 파일 업로드 로직을 추가할 수 있습니다.
        });
      }
    },
  },
};
</script>

<style scoped>
.board {
  max-width: 960px;
  margin: 0 auto;
}

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

/* select */
.select-box {
  width: 320px;
  font-size: 16px;
  padding: 16px 8px;
  border: 2px solid var(--black);
  border-radius: 4px;
  font-weight: bold;
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

.file-upload__label {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.file-upload__label:hover {
  background-color: #0056b3;
}

.file-upload__preview {
  margin-top: 10px;
}

.file-upload__preview ul {
  list-style-type: none;
  padding: 0;
}

.file-upload__preview ul li {
  margin-bottom: 5px;
  font-size: 14px;
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
