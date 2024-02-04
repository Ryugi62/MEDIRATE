<template>
  <div class="board-view container my-4 py-4">
    <h1 class="board-title text-center text-primary mb-4">Q&A 게시판</h1>
    <router-link
      :to="{ name: 'create-post' }"
      class="btn btn-success mb-4 me-2"
    >
      게시물 생성하기
    </router-link>
    <div class="board-posts">
      <ul class="list-group">
        <li
          v-for="post in paginatedPosts"
          :key="post.id"
          class="list-group-item d-flex justify-content-between align-items-center"
          @click="goToPost(post.id)"
        >
          <div class="post-content">
            <h3 class="post-title h5">{{ post.title }}</h3>
            <div class="post-details small text-muted">
              <span class="post-author fw-bold">작성자: {{ post.author }}</span>
              <span class="post-category badge bg-primary rounded-pill">{{
                post.category
              }}</span>
            </div>
            <div class="post-stats mt-2">
              <span class="post-comments">댓글: {{ post.comments }}</span>
              <span class="post-views">조회: {{ post.views }}</span>
              <span class="post-updated">업데이트: {{ post.lastUpdated }}</span>
              <span class="post-attachments"
                >첨부 파일 수: {{ post.attachments }}</span
              >
            </div>
          </div>
        </li>
      </ul>
      <!-- 페이지네이션 -->
      <nav aria-label="페이지네이션" class="mt-4">
        <ul class="pagination justify-content-center">
          <li class="page-item">
            <a
              class="page-link"
              @click="changePage(currentPage - 1)"
              :disabled="currentPage === 1"
            >
              이전
            </a>
          </li>
          <li
            class="page-item"
            v-for="(page, pageIndex) in visiblePages"
            :key="pageIndex"
            :class="{ active: currentPage === page }"
          >
            <a class="page-link" @click="changePage(page)">{{ page }}</a>
          </li>
          <li class="page-item">
            <a
              class="page-link"
              @click="changePage(currentPage + 1)"
              :disabled="currentPage === pageCount"
            >
              다음
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<script>
import mockPosts from "@/data/mock-posts.js";

export default {
  name: "BoardView",

  data() {
    return {
      posts: mockPosts,
      currentPage: 1, // 현재 페이지
      postsPerPage: 10, // 페이지당 표시할 게시물 수
      maxVisiblePages: 6, // 최대 보여질 페이지 수
    };
  },

  computed: {
    // 현재 페이지의 게시물을 계산합니다.
    paginatedPosts() {
      const startIndex = (this.currentPage - 1) * this.postsPerPage;
      const endIndex = startIndex + this.postsPerPage;
      return this.posts.slice(startIndex, endIndex);
    },

    // 페이지 개수를 계산합니다.
    pageCount() {
      return Math.ceil(this.posts.length / this.postsPerPage);
    },

    // 현재 페이지 주변의 보여질 페이지 목록을 계산합니다.
    visiblePages() {
      const pageCount = this.pageCount;
      const currentPage = this.currentPage;
      const maxVisiblePages = this.maxVisiblePages;
      const half = Math.floor(maxVisiblePages / 2);

      let startPage = currentPage - half;
      let endPage = currentPage + half;

      if (startPage < 1) {
        startPage = 1;
        endPage = Math.min(maxVisiblePages, pageCount);
      }

      if (endPage > pageCount) {
        endPage = pageCount;
        startPage = Math.max(1, pageCount - maxVisiblePages + 1);
      }

      const visiblePages = [];
      for (let i = startPage; i <= endPage; i++) {
        visiblePages.push(i);
      }

      return visiblePages;
    },
  },

  methods: {
    goToPost(id) {
      // 게시물 ID를 이용하여 상세 페이지로 라우팅
      this.$router.push({ name: "post", params: { id } });
    },

    changePage(page) {
      // 페이지 변경 시 현재 페이지 업데이트
      if (page >= 1 && page <= this.pageCount) {
        this.currentPage = page;
      }
    },
  },
};
</script>

<style scoped>
.board-view {
  background-color: #f8f9fa; /* 변경: Bootstrap 5의 기본 배경색 */
  border-radius: 10px; /* 변경: 둥근 테두리 */
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2); /* 변경: 그림자 효과 */
}

.list-group-item {
  cursor: pointer;
  transition: background-color 0.3s;
  border: none;
  border-bottom: 1px solid #e1e1e1; /* 변경: Bootstrap 5의 기본 테두리 스타일 */
}

.list-group-item:last-child {
  border-bottom: none;
}

.list-group-item:hover {
  background-color: #f7f7f7; /* 변경: 호버 효과 배경색 */
}

.post-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-category {
  font-size: 12px;
  padding: 3px 10px;
}

.post-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
}

.post-stats span {
  margin-right: 10px;
}
</style>
