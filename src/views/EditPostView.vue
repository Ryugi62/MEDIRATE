<template>
  <div class="board">
    <h1 class="board__title">게시물 수정</h1>
    <form class="create-post__form" @submit.prevent="updatePost">
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

      <div class="form__group">
        <!-- <quill-editor
          :value="postContent"
          @input="updateContent"
          class="quill-editor"
          :options="editorOptions"
          placeholder="내용을 입력하세요."
        ></quill-editor> -->
        <quill-editor
          :value="postContent"
          @input="updateContent"
          class="quill-editor"
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
        <button type="submit" class="form__submit-button">저장</button>
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
      postId: null,
      postTitle: "",
      postContent: "",
      postType: "post",
      fileNames: [],
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
  mounted() {
    this.postId = this.$route.params.id;
    this.loadPostData();
  },
  methods: {
    isAdministrator() {
      return this.$store.getters.getUser.isAdministrator;
    },
    loadPostData() {
      this.$axios
        .get(`/api/posts/${this.postId}`)
        .then((response) => {
          const postData = response.data;
          this.postTitle = postData.title;
          this.postContent = postData.content;
          // this.postType = postData.type;
          // 파일 목록 등 추가 데이터 처리는 여기서 수행합니다.

          console.log("post data:", postData);

          document.querySelector(".ql-editor").innerHTML = this.postContent;
        })
        .catch((error) => {
          console.error("Error loading post data:", error);
        });
    },
    updatePost() {
      let formData = new FormData();
      formData.append("title", this.postTitle);
      formData.append("content", this.postContent);
      formData.append("type", this.postType); // Make sure the backend expects "type" not "postType"

      // Append files if any
      this.fileNames.forEach((file) => {
        formData.append("files", file); // Make sure files are correctly handled in the backend
      });

      this.$axios
        .put(`/api/posts/${this.postId}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then(() => {
          this.$router.push("/"); // Navigate on success
        })
        .catch((error) => {
          console.error("Error updating post:", error);
        });
    },

    cancelPostCreation() {
      this.$router.push("/"); // 취소 시 게시판 목록으로 이동
    },
    handleFileUpload(event) {
      this.fileNames = Array.from(event.target.files).map((file) => file.name);
    },
    updateContent() {
      this.postContent = document.querySelector(".ql-editor").innerHTML;
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
