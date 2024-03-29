<template>
  <div class="board-container">
    <h1 class="board-title">게시판</h1>
    <div class="post-container" v-if="postData">
      <div class="post-header">
        <h1 class="post-title">{{ postData.title }}</h1>
        <div class="post-meta">
          <span class="author-name">{{ postData.author }}</span>
          <span class="post-date">{{ postData.creation_date }}</span>
        </div>

        <div
          class="post-files"
          v-if="postData.files && postData.files.length > 0"
        >
          <ul>
            <li v-for="(file, index) in postData.files" :key="index">
              <i
                :class="getFileIconClass(file.filename.split('.').pop())"
                class="file-icon"
              ></i>
              <span class="file-size">{{ file.size }}</span>
              <a
                :href="`/uploads/${file.filename}`"
                class="file-name"
                target="_blank"
                download
                >{{ file.filename }}</a
              >
            </li>
          </ul>
        </div>
      </div>

      <div class="post-content" v-html="postData.content"></div>

      <!-- Add this section for attached files -->

      <div
        class="post-actions"
        v-if="loggedInUser.username === postData.author"
      >
        <button class="edit-post-button" @click="startEditingPost">수정</button>
        <button class="delete-post-button" @click="removePost">삭제</button>
      </div>

      <div class="comments-section">
        <div class="comment-input">
          <i class="fa-solid fa-circle-user user-icon"></i>
          <textarea
            class="reply-input"
            v-model="commentInput"
            placeholder="댓글을 입력하세요"
          ></textarea>
          <button class="submit-comment-button" @click="addComment">
            등록
          </button>
        </div>

        <div
          v-for="(comment, commentIndex) in postData?.commentsData"
          :key="comment.id"
          class="comment-container"
        >
          <div :class="{ comment: true, reply: commentIndex > 0 }">
            <i class="fa-solid fa-circle-user user-icon"></i>
            <div class="comment-body">
              <div class="comment-text">
                <textarea
                  v-if="editingCommentIndex === commentIndex"
                  v-model="editedCommentText"
                  class="edit-comment-textarea"
                ></textarea>
                <div v-else>
                  {{ comment.text }}
                </div>
              </div>
              <div class="comment-meta">
                <span class="comment-author">{{ comment.author }}</span>
                <span class="comment-date">{{
                  comment.date.split("T")[0]
                }}</span>
                <i
                  class="fa-solid fa-reply reply-icon"
                  @click="
                    editingReply.commentIndex === commentIndex
                      ? resetEditingReply()
                      : startEditingReply(commentIndex, -1, '')
                  "
                ></i>
              </div>
            </div>
            <div class="comment-actions">
              <span v-if="editingCommentIndex === commentIndex">
                <button
                  class="save-comment-button"
                  @click="saveEditedComment(commentIndex)"
                >
                  저장
                </button>
                <button
                  class="cancel-comment-button"
                  @click="resetEditingComment"
                >
                  취소
                </button>
              </span>
              <span v-else-if="comment.author === loggedInUser.username">
                <div
                  class="edit-comment-button"
                  @click="startEditingComment(commentIndex, comment.text)"
                >
                  수정
                </div>
                <div
                  class="delete-comment-button"
                  @click="removeComment(commentIndex)"
                >
                  삭제
                </div>
              </span>
            </div>
          </div>

          <!-- 대댓글 루프 -->
          <!-- Reply loop -->
          <div
            v-for="(reply, replyIndex) in comment.replies"
            :key="reply.id"
            class="comment-reply"
          >
            <i class="fa-solid fa-circle-user user-icon"></i>
            <div class="comment-body">
              <div class="comment-text">
                <!-- Check if this reply is being edited -->
                <textarea
                  v-if="
                    editingReply.commentIndex === commentIndex &&
                    editingReply.replyIndex === replyIndex
                  "
                  v-model="editedReplyText"
                  class="edit-comment-textarea"
                ></textarea>
                <div v-else>
                  {{ reply.text }}
                </div>
              </div>
              <div class="comment-meta">
                <span class="comment-author">{{ reply.author }}</span>
                <span class="comment-date">{{ reply.date.split("T")[0] }}</span>
              </div>
            </div>
            <div class="comment-actions">
              <!-- Check if editing mode is on for this reply -->
              <span
                v-if="
                  editingReply.commentIndex === commentIndex &&
                  editingReply.replyIndex === replyIndex
                "
              >
                <button class="save-reply-button" @click="saveEditedReply">
                  저장
                </button>
                <button class="cancel-reply-button" @click="resetEditingReply">
                  취소
                </button>
              </span>
              <span v-else-if="reply.author === loggedInUser.username">
                <div
                  class="edit-reply-button"
                  @click="
                    startEditingReply(commentIndex, replyIndex, reply.text)
                  "
                >
                  수정
                </div>
                <div
                  class="delete-reply-button"
                  @click="removeReply(commentIndex, replyIndex)"
                >
                  삭제
                </div>
              </span>
            </div>
          </div>

          <div
            class="reply-input-container"
            v-if="
              editingReply.commentIndex === commentIndex &&
              editingReply.replyIndex === -1
            "
          >
            <i class="fa-solid fa-circle-user user-icon"></i>
            <textarea
              class="reply-input"
              v-model="replyInputs[commentIndex]"
              placeholder="답글을 입력하세요"
            ></textarea>
            <button
              class="submit-comment-button"
              @click="addReplyToComment(commentIndex)"
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "PostDetailView",

  data() {
    return {
      currentPostId: null,
      postData: null,
      commentInput: "",
      replyInputs: [],
      isEditingPost: false,
      editedPostTitle: "",
      editedPostContent: "",
      editingCommentIndex: -1,
      editedCommentText: "",
      editingReply: {
        commentIndex: -1,
        replyIndex: -1,
      },
      editedReplyText: "",
    };
  },

  computed: {
    loggedInUser() {
      return this.$store.getters.getUser;
    },
  },

  created() {
    this.currentPostId = this.$route.params.id;
  },

  // Modify this part in the mounted() method
  mounted() {
    this.$axios
      .get("/api/posts/" + this.currentPostId)
      .then((res) => {
        this.postData = res.data;
        // Safely initialize replyInputs only if commentsData is available
        if (this.postData && this.postData.commentsData) {
          this.replyInputs = Array(this.postData.commentsData.length).fill("");
        }
        // Parse file paths to handle empty paths
        if (this.postData && this.postData.files) {
          this.postData.files.forEach((file) => {
            if (file.path === "") {
              file.path = "uploads"; // Assuming uploads is the default path when empty
            }
          });
        }
      })
      .catch((error) => {
        console.error("Failed to fetch post data:", error);
        // Handle error appropriately
      });
  },

  methods: {
    startEditingPost() {
      this.$router.push(`/edit-post/${this.currentPostId}`);
    },

    saveEditedPost() {
      if (this.editedPostTitle.trim() && this.editedPostContent.trim()) {
        this.postData.title = this.editedPostTitle;
        this.postData.content = this.editedPostContent;
        this.isEditingPost = false;
      }
    },

    cancelPostEditing() {
      this.isEditingPost = false;
    },

    removePost() {
      if (confirm("게시물을 삭제하시겠습니까?")) {
        this.$axios
          .delete("/api/posts/" + this.currentPostId)
          .then(() => {
            // Redirect to the board page after successful deletion
            this.$router.push("/board");
          })
          .catch((error) => {
            console.error("Error deleting post", error);
          });
      }
    },

    addComment() {
      if (this.commentInput.trim() !== "") {
        // Construct the payload for the API request
        const payload = {
          postId: this.currentPostId,
          username: this.loggedInUser.username, // Ensure you have this info
          content: this.commentInput,
        };

        // jwt 토큰을 헤더에 추가
        // Make an HTTP POST request to add a comment
        this.$axios
          .post("/api/comments", payload, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            // clear
            this.commentInput = "";

            // Optionally, refresh comments or the whole post data from the server
            this.fetchPostData();
          })
          .catch((error) => {
            // Handle error
            console.error("Error adding comment", error);
          });
      }
    },

    startEditingComment(index, text) {
      this.editingCommentIndex = index;
      this.editedCommentText = text;
    },

    // The editComment method remains the same as shown previously.
    editComment(commentId, newContent) {
      const payload = {
        content: newContent,
      };

      this.$axios
        .put(`/api/comments/${commentId}`, payload)
        .then(() => {
          this.fetchPostData(); // Refresh the comments to reflect the changes
        })
        .catch((error) => {
          console.error("Error editing comment", error);
        });
    },

    saveEditedComment(index) {
      if (this.editedCommentText.trim() !== "") {
        // Assuming `id` is stored in your comment data
        const commentId = this.postData.commentsData[index].id;
        this.editComment(commentId, this.editedCommentText);
        this.resetEditingComment();
      }
    },

    resetEditingComment() {
      this.editingCommentIndex = -1;
      this.editedCommentText = "";
    },

    removeComment(commentIndex) {
      if (confirm("댓글을 삭제하시겠습니까?")) {
        this.$axios
          .delete(
            `/api/posts/comments/${this.postData.commentsData[commentIndex].id}`
          )
          .then(() => {
            // 댓글 삭제 후 화면 갱신 등 필요한 작업 수행
            this.fetchPostData();
          })
          .catch((error) => {
            console.error("댓글 삭제 실패:", error);
          });
      }
    },

    addReplyToComment(commentIndex) {
      const replyText = this.replyInputs[commentIndex];
      if (replyText.trim() !== "") {
        const parentCommentId = this.postData.commentsData[commentIndex].id;

        const payload = {
          parentId: parentCommentId,
          content: replyText,
        };

        this.$axios
          .post(`/api/comments/${this.currentPostId}`, payload, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            this.fetchPostData(); // Refresh post data to include the new reply.
          })
          .catch((error) => {
            console.error("Error adding reply", error);
          });
      }

      this.replyInputs[commentIndex] = "";

      this.editingReply.commentIndex = -1;
    },

    startEditingReply(commentIndex, replyIndex, text) {
      this.editingReply.commentIndex = commentIndex;
      this.editingReply.replyIndex = replyIndex;
      this.editedReplyText = text;
    },

    saveEditedReply() {
      const { commentIndex, replyIndex } = this.editingReply;
      if (this.editedReplyText.trim() !== "") {
        const replyId =
          this.postData.commentsData[commentIndex].replies[replyIndex].id;
        this.editComment(replyId, this.editedReplyText);
        this.resetEditingReply();
      }
    },

    resetEditingReply() {
      this.editingReply.commentIndex = -1;
      this.editingReply.replyIndex = -1;
      this.editedReplyText = "";
    },

    removeReply(commentIndex, replyIndex) {
      if (confirm("대댓글을 삭제하시겠습니까?")) {
        this.$axios
          .delete(
            `/api/posts/replies/${this.postData.commentsData[commentIndex].replies[replyIndex].id}`
          )
          .then(() => {
            this.fetchPostData();
          })
          .catch((error) => {
            console.error("대댓글 삭제 실패:", error);
          });
      }
    },

    fetchPostData() {
      this.$axios
        .get(`/api/posts/${this.currentPostId}`)
        .then((response) => {
          // Update postData with the latest data from the server
          this.postData = response.data;
        })
        .catch((error) => {
          console.error("Failed to fetch post data", error);
        });
    },

    getFileIconClass(filename) {
      const extension = filename.split(".").pop();
      if (extension === "pdf") {
        return "fa-solid fa-file-pdf";
      } else if (extension === "docx" || extension === "doc") {
        return "fa-solid fa-file-word";
      } else if (extension === "xlsx" || extension === "xls") {
        return "fa-solid fa-file-excel";
      } else if (extension === "pptx" || extension === "ppt") {
        return "fa-solid fa-file-powerpoint";
      } else if (
        extension === "jpg" ||
        extension === "jpeg" ||
        extension === "png"
      ) {
        return "fa-solid fa-file-image";
      } else if (extension === "mp3" || extension === "wav") {
        return "fa-solid fa-file-audio";
      } else if (
        extension === "mp4" ||
        extension === "avi" ||
        extension === "mov"
      ) {
        return "fa-solid fa-file-video";
      } else {
        return "fa-solid fa-file";
      }
    },
  },
};
</script>

<style scoped>
h1 {
  margin: 0;
}

.board-title {
  margin: 0;
  padding: 14px 24px;
  font-size: 24px;
  font-weight: 500;
  border-bottom: 1px solid var(--light-gray);
}

.post-container {
  padding: 48px 24px;
  margin-right: 12px;
}

.post-title {
  font-weight: 500;
  margin-bottom: 16px;
}

.post-meta {
  gap: 8px;
  display: flex;
}

.post-content {
  margin-top: 16px;
  margin-bottom: 46px;
  padding-top: 16px;
  line-height: 1.6;
  border-top: 1px solid var(--light-gray);
  min-height: 200px;
}

.post-actions {
  gap: 8px;
  display: flex;
  justify-content: center;
  border-bottom: 1px solid var(--light-gray);
  padding-bottom: 28px;
}

.edit-post-button {
  color: var(--blue);
  border: 1px solid var(--blue);
  background-color: var(--white);
}

.edit-post-button:hover {
  color: var(--white);
  background-color: var(--blue-hover);
}
.edit-post-button:active {
  color: var(--white);
  background-color: var(--blue-active);
}

.delete-post-button {
  background-color: var(--pink);
}
.delete-post-button:hover {
  background-color: var(--pink-hover);
}
.delete-post-button:active {
  background-color: var(--pink-active);
}

.comments-section {
  margin-top: 47px;
}

.comment,
.comment-reply {
  gap: 26px;
  display: flex;
  margin-bottom: 40px;
}

.comment-reply {
  margin-left: 70px;
}

.user-icon {
  font-size: 50px;
  color: var(--gray);
}

.comment-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-text {
  line-height: 1.6;
}

.comment-meta {
  gap: 8px;
  display: flex;
}

.comment-actions {
  gap: 8px;
  display: flex;
  cursor: pointer;
  align-items: center;
}

.comment-actions span {
  gap: 8px;
  display: flex;
  cursor: pointer;
  align-items: center;
}

.cancel-reply-button {
  background-color: var(--pink);
}

.reply-icon {
  color: var(--gray);
}

.edit-comment-button,
.edit-reply-button {
  color: var(--blue);
  text-decoration: underline;
}

.edit-comment-button,
.edit-reply-button:hover {
  color: var(--blue-hover);
}

.edit-comment-button,
.edit-reply-button:active {
  color: var(--blue-active);
}

.delete-comment-button,
.delete-reply-button {
  color: var(--pink);
  text-decoration: underline;
}

.delete-comment-button,
.delete-reply-button:hover {
  color: var(--pink-hover);
}

.delete-comment-button,
.delete-reply-button:active {
  color: var(--pink-active);
}

.comment-input {
  padding-bottom: 32px;
  display: flex;
  gap: 16px;
  height: 60px;
  align-items: center;
}

.reply-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
}

.submit-comment-button {
  height: 100%;
}

.reply-input-container {
  margin-left: 70px;
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 32px;

  textarea {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--light-gray);
    border-radius: 4px;
  }

  .submit-comment-button {
    height: 100%;
  }

  .user-icon {
    font-size: 30px;
    margin-top: 10px;
  }

  .reply-input {
    padding: 12px 16px;
    border: 1px solid var(--light-gray);
    border-radius: 4px;
  }
}

.reply-input-container textarea {
  width: 100%;
}

.reply-input-container .submit-comment-button {
  height: 100%;
}

.reply-input-container .user-icon {
  font-size: 30px;
  margin-top: 10px;
}

.reply-input-container .reply-input {
  padding: 12px 16px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
}

.edit-comment-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
  min-height: 50px; /* 원하는 높이로 조절하세요 */
  font-size: 14px; /* 원하는 폰트 크기로 조절하세요 */
}

/* 취소 버튼 스타일 */
.cancel-comment-button {
  background-color: var(--pink); /* 원하는 배경색으로 변경하세요 */
}

.cancel-comment-button:hover {
  background-color: var(--pink-hover); /* 원하는 hover 배경색으로 변경하세요 */
}

.comment-reply .user-icon {
  font-size: 30px;
  margin-top: 10px;
}

.post-files {
  ul {
    padding: 0;
  }

  li {
    list-style: none;
    margin-bottom: 8px;
  }

  a {
    color: var(--blue);
    text-decoration: underline;
  }

  a:hover {
    color: var(--blue-hover);
  }

  a:active {
    color: var(--blue-active);
  }
}

.file-icon {
  margin-right: 8px;
}

/* Add file name styles */
.file-name {
  margin-right: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--black);
  text-decoration: none;
}

/* Add file size styles */
.file-size {
  font-size: 14px;
  color: var(--gray);
}
</style>
