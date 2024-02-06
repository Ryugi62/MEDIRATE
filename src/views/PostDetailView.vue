<template>
  <div class="board-container">
    <h1 class="board-title">게시판</h1>
    <div class="post-container">
      <div class="post-header">
        <h1 class="post-title">{{ postData.title }}</h1>
        <div class="post-meta">
          <span class="author-name">{{ postData.author }}</span>
          <span class="post-date">{{ postData.lastUpdated }}(수정됨)</span>
        </div>
      </div>

      <div class="post-content">
        {{ postData.content }}
      </div>

      <div class="post-actions">
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
          v-for="(comment, commentIndex) in postData.commentsData"
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
                <span class="comment-date">{{ comment.date }}</span>
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
          <div
            v-for="(reply, replyIndex) in comment.replies"
            :key="reply.id"
            class="comment-reply"
          >
            <i class="fa-solid fa-circle-user user-icon"></i>
            <div class="comment-body">
              <div class="comment-text">
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
                <span class="comment-date">{{ reply.date }}</span>
                <!-- i 클릭시 대댓글 
                작성창이 나타나도록 합니다
                 -->
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
            v-if="editingReply.commentIndex === commentIndex"
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
import mockPosts from "@/data/mock-posts.js";

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
    this.postData = mockPosts.find(
      (post) => post.id === Number(this.currentPostId)
    );
    this.replyInputs = Array(this.postData.commentsData.length).fill("");
  },

  methods: {
    startEditingPost() {
      this.isEditingPost = true;
      this.editedPostTitle = this.postData.title;
      this.editedPostContent = this.postData.content;
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
      console.log("게시물 삭제됨");
    },

    addComment() {
      if (this.commentInput.trim() !== "") {
        this.postData.commentsData.push({
          author: this.loggedInUser.username,
          text: this.commentInput,
          replies: [],
        });
        this.commentInput = "";
      }
    },

    startEditingComment(index, text) {
      this.editingCommentIndex = index;
      this.editedCommentText = text;
    },

    saveEditedComment(index) {
      if (this.editedCommentText.trim() !== "") {
        this.postData.commentsData[index].text = this.editedCommentText;
        this.resetEditingComment();
      }
    },

    resetEditingComment() {
      this.editingCommentIndex = -1;
      this.editedCommentText = "";
    },

    removeComment(index) {
      this.postData.commentsData.splice(index, 1);
    },

    addReplyToComment(commentIndex) {
      const replyText = this.replyInputs[commentIndex];
      if (replyText.trim() !== "") {
        const repliesArray = this.postData.commentsData[commentIndex].replies;
        repliesArray.push({
          author: this.loggedInUser.username,
          text: replyText,
        });
        this.replyInputs[commentIndex] = "";
      }
    },

    startEditingReply(commentIndex, replyIndex, text) {
      this.editingReply.commentIndex = commentIndex;
      this.editingReply.replyIndex = replyIndex;
      this.editedReplyText = text;
    },

    saveEditedReply() {
      const { commentIndex, replyIndex } = this.editingReply;
      if (this.editedReplyText.trim() !== "") {
        this.postData.commentsData[commentIndex].replies[replyIndex].text =
          this.editedReplyText;
        this.resetEditingReply();
      }
    },

    resetEditingReply() {
      this.editingReply.commentIndex = -1;
      this.editingReply.replyIndex = -1;
      this.editedReplyText = "";
    },

    removeReply(commentIndex, replyIndex) {
      this.postData.commentsData[commentIndex].replies.splice(replyIndex, 1);
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
</style>
