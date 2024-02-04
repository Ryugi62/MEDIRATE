<template>
  <div class="container my-5">
    <div class="card shadow">
      <div class="card-body">
        <!-- Post Editing -->
        <div v-if="isEditingPost">
          <input
            type="text"
            class="form-control mb-2"
            v-model="editedPostTitle"
            placeholder="제목을 입력하세요"
          />
          <textarea
            class="form-control"
            v-model="editedPostContent"
            placeholder="내용을 입력하세요"
          ></textarea>
          <button @click="savePost" class="btn btn-success me-2 mt-2">
            저장
          </button>
          <button @click="cancelEditPost" class="btn btn-secondary mt-2">
            취소
          </button>
        </div>
        <!-- Post Display -->
        <div v-else>
          <h1 class="card-title fs-2">{{ post.title }}</h1>
          <hr />
          <p class="card-text">{{ post.content }}</p>
          <div v-if="post.author === currentUser.username">
            <button @click="editPost" class="btn btn-primary me-2">수정</button>
            <button @click="deletePost" class="btn btn-danger">삭제</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Comments Section -->
    <div class="comments-section mt-4">
      <h2 class="fs-3">댓글 ({{ post.commentsData.length }})</h2>
      <!-- Comment Form -->
      <div class="comment-form mb-3">
        <input
          type="text"
          class="form-control"
          v-model="newComment"
          placeholder="댓글을 입력하세요"
        />
        <button @click="submitComment" class="btn btn-outline-primary mt-2">
          댓글 작성
        </button>
      </div>

      <!-- Comments List -->
      <ul class="list-group">
        <li
          v-for="(comment, index) in post.commentsData"
          :key="comment.id"
          class="list-group-item"
        >
          <!-- Comment Editing -->
          <div v-if="editingCommentIndex === index">
            <strong>{{ comment.author }}</strong>
            <input type="text" class="form-control" v-model="editedComment" />

            <div class="d-flex justify-content-end">
              <button
                @click="saveEditedComment(index)"
                class="btn btn-primary btn-sm me-2 mt-2"
              >
                저장
              </button>
              <button
                @click="cancelEditingComment"
                class="btn btn-secondary btn-sm mt-2"
              >
                취소
              </button>
            </div>
          </div>

          <!-- Comment Display -->
          <div v-else>
            <div class="comment-body">
              <strong>{{ comment.author }}</strong>
              <p>{{ comment.text }}</p>
              <div
                class="d-flex justify-content-end"
                v-if="comment.author === currentUser.username"
              >
                <button
                  @click="editComment(index, comment.text)"
                  class="btn btn-primary btn-sm me-2"
                >
                  수정
                </button>
                <button
                  @click="deleteComment(index)"
                  class="btn btn-danger btn-sm"
                >
                  삭제
                </button>
              </div>
            </div>

            <!-- Replies List -->
            <ul class="list-group mt-2">
              <li
                v-for="(reply, rIndex) in comment.replies"
                :key="reply.id"
                class="list-group-item list-group-item-light"
              >
                <!-- Reply Editing -->
                <div
                  v-if="
                    editingReplyCommentIndex === index &&
                    editingReplyIndex === rIndex
                  "
                >
                  <strong>{{ reply.author }}</strong>

                  <input
                    type="text"
                    class="form-control"
                    v-model="editedReply"
                  />

                  <div class="d-flex justify-content-end">
                    <button
                      @click="saveEditedReply(index, rIndex)"
                      class="btn btn-primary btn-sm me-2 mt-2"
                    >
                      저장
                    </button>
                    <button
                      @click="cancelEditingReply"
                      class="btn btn-secondary btn-sm mt-2"
                    >
                      취소
                    </button>
                  </div>
                </div>
                <!-- Reply Display -->
                <div v-else>
                  <div class="reply-body">
                    <strong>{{ reply.author }}</strong>
                    <p>{{ reply.text }}</p>
                    <div
                      class="d-flex justify-content-end"
                      v-if="reply.author === currentUser.username"
                    >
                      <button
                        @click="editReply(index, rIndex, reply.text)"
                        class="btn btn-primary btn-sm me-2"
                      >
                        수정
                      </button>
                      <button
                        @click="deleteReply(index, rIndex)"
                        class="btn btn-danger btn-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <!-- Reply Form -->
            <div class="reply-form mt-2 comment-form">
              <input
                type="text"
                class="form-control"
                v-model="newReply[index]"
                placeholder="대댓글을 입력하세요"
              />
              <button
                @click="submitReply(index)"
                class="btn btn-outline-secondary mt-2"
              >
                대댓글 작성
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import mockPosts from "@/data/mock-posts.js";

export default {
  name: "PostDetailView",
  data() {
    return {
      postId: null,
      post: null,
      newComment: "",
      newReply: [],
      isEditingPost: false,
      editedPostTitle: "",
      editedPostContent: "",
      editingCommentIndex: -1,
      editedComment: "",
      editingReplyCommentIndex: -1,
      editingReplyIndex: -1,
      editedReply: "",
    };
  },
  computed: {
    currentUser() {
      return this.$store.getters.getUser;
    },
  },
  created() {
    this.postId = this.$route.params.id;
    this.post = mockPosts.find((post) => post.id === Number(this.postId));
    this.newReply = Array(this.post.commentsData.length).fill("");
  },
  methods: {
    editPost() {
      this.isEditingPost = true;
      this.editedPostTitle = this.post.title;
      this.editedPostContent = this.post.content;
    },
    savePost() {
      if (this.editedPostTitle.trim() && this.editedPostContent.trim()) {
        this.post.title = this.editedPostTitle;
        this.post.content = this.editedPostContent;
        this.isEditingPost = false;
      }
    },
    cancelEditPost() {
      this.isEditingPost = false;
    },
    deletePost() {
      console.log("게시물 삭제");
    },
    submitComment() {
      if (this.newComment.trim() !== "") {
        this.post.commentsData.push({
          author: this.currentUser.username,
          text: this.newComment,
          replies: [],
        });
        this.newComment = "";
      }
    },
    editComment(index, text) {
      this.editingCommentIndex = index;
      this.editedComment = text;
    },
    saveEditedComment(index) {
      if (this.editedComment.trim() !== "") {
        this.post.commentsData[index].text = this.editedComment;
        this.cancelEditingComment();
      }
    },
    cancelEditingComment() {
      this.editingCommentIndex = -1;
      this.editedComment = "";
    },
    deleteComment(index) {
      this.post.commentsData.splice(index, 1);
    },
    submitReply(commentIndex) {
      const replyText = this.newReply[commentIndex];
      if (replyText.trim() !== "") {
        if (!this.post.commentsData[commentIndex].replies) {
          this.post.commentsData[commentIndex].replies = [];
        }
        this.post.commentsData[commentIndex].replies.push({
          author: this.currentUser.username,
          text: replyText,
        });
        this.newReply[commentIndex] = "";
      }
    },
    editReply(commentIndex, replyIndex, text) {
      this.editingReplyCommentIndex = commentIndex;
      this.editingReplyIndex = replyIndex;
      this.editedReply = text;
    },
    saveEditedReply(commentIndex, replyIndex) {
      if (this.editedReply.trim() !== "") {
        this.post.commentsData[commentIndex].replies[replyIndex].text =
          this.editedReply;
        this.cancelEditingReply();
      }
    },
    cancelEditingReply() {
      this.editingReplyCommentIndex = -1;
      this.editingReplyIndex = -1;
      this.editedReply = "";
    },
    deleteReply(commentIndex, replyIndex) {
      this.post.commentsData[commentIndex].replies.splice(replyIndex, 1);
    },
  },
};
</script>

<style scoped>
.card {
  border-radius: 0.5rem;
  border: none; /* 변경: 카드의 테두리 제거 */
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); /* 변경: 그림자 효과 추가 */
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
.comments-section {
  margin-top: 2rem;
}
.comments-section h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}
.comment-form input,
.comment-form button,
.reply-form input,
.reply-form button {
  border-radius: 0.25rem;
}
.btn-primary,
.btn-danger {
  margin-right: 0.5rem;
}
.btn-outline-primary {
  color: #0d6efd;
  border-color: #0d6efd;
}
.btn-outline-primary:hover {
  background-color: #0d6efd;
  color: white;
}
.btn-outline-secondary {
  color: #6c757d;
  border-color: #6c757d;
}
.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: white;
}
.list-group-item {
  border: 1px solid #e9ecef;
  border-radius: 0.25rem;
}
.list-group-item-light {
  background-color: #f8f9fa;
}
</style>
