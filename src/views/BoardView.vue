<template>
  <div class="board">
    <h1 class="board__title">게시판</h1>
    <div class="board__table-container">
      <table class="board__table">
        <thead>
          <tr class="table__head-row">
            <th class="head-row__cell head-row__cell--number">번호</th>
            <th class="head-row__cell head-row__cell--title">제목</th>
            <th class="head-row__cell head-row__cell--author">작성자</th>
            <th class="head-row__cell head-row__cell--date">날짜</th>
          </tr>
        </thead>
        <tbody>
          <!-- 만약 공지사항이면 class -->
          <tr
            :class="
              post.type === 'notice'
                ? 'table__body-row table__body-row--notice'
                : 'table__body-row'
            "
            v-for="post in paginatedPosts"
            :key="post.id"
            @click="navigateToPost(post.id)"
            class="table__body-row"
          >
            <td class="body-row__cell body-row__cell--number">{{ post.id }}</td>
            <td class="body-row__cell body-row__cell--title">
              {{ post.title }}
            </td>
            <td class="body-row__cell body-row__cell--author">
              {{ post.author }}
            </td>
            <td class="body-row__cell body-row__cell--date">
              {{ post.lastUpdated.split("T")[0] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav class="board__pagination-nav" aria-label="페이지네이션">
      <ul class="pagination">
        <i
          class="fa-solid fa-angles-left pagination__button"
          @click="changePage(1)"
        ></i>
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(currentPage - 1)"
        ></i>
        <li
          v-for="page in visiblePages"
          :key="page"
          :class="{ 'pagination__item--active': currentPage === page }"
          class="pagination__item"
        >
          <a @click="changePage(page)" class="pagination__link">{{ page }}</a>
        </li>

        <i
          class="fa-solid fa-chevron-right pagination__button"
          @click="changePage(currentPage + 1)"
        ></i>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(pageCount)"
        ></i>
      </ul>

      <router-link
        to="/create-post"
        class="pagination__link--write"
        style="margin-left: 10px"
        >글쓰기</router-link
      >
    </nav>
  </div>
</template>

<script>
export default {
  name: "BoardView",
  data() {
    return {
      posts: [],
      currentPage: 1,
      postsPerPage: 14,
      maxVisiblePages: 6,
    };
  },
  computed: {
    paginatedPosts() {
      const start = (this.currentPage - 1) * this.postsPerPage;
      return this.posts.slice(start, start + this.postsPerPage);
    },
    pageCount() {
      return Math.ceil(this.posts.length / this.postsPerPage);
    },
    visiblePages() {
      let start = Math.max(
        this.currentPage - Math.floor(this.maxVisiblePages / 2),
        1
      );
      const end = Math.min(start + this.maxVisiblePages - 1, this.pageCount);
      start = Math.max(end - this.maxVisiblePages + 1, 1); // Adjust if near the end
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    },
  },

  mounted() {
    // jwt
    this.$axios
      .get("/api/posts", {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwt")}` },
      })
      .then((res) => {
        this.posts = res.data.map((post) => ({
          id: post.id,
          title: post.title,
          author: post.author,
          lastUpdated: post.lastUpdated,
          type: post.type,
        }));
      })
      .catch((err) => {
        console.error(err);
      });
  },

  methods: {
    navigateToPost(id) {
      this.$router.push({ name: "post", params: { id } });
    },
    changePage(page) {
      if (page >= 1 && page <= this.pageCount) this.currentPage = page;
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

.board__table-container {
  min-height: 676px;
}

.board__table {
  width: 100%;
  border-collapse: collapse;
}

.table__head-row {
  border-bottom: 1px solid var(--light-gray);
}

.head-row__cell {
  padding: 12px 24px;
  text-align: center;
}

.table__body-row {
  cursor: pointer;
}

.table__body-row:hover {
  background-color: #f5f5f5;
}

.body-row__cell {
  padding: 12px 24px;
  text-align: center;
}
.body-row__cell:last-child {
  padding-right: 46px;
}

.body-row__cell--number {
  width: 40px;
}

.body-row__cell--title {
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.body-row__cell--author {
  width: 75px;
}

.body-row__cell--date {
  width: 100px;
}

.board__pagination-nav {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  position: relative;
}

.pagination {
  list-style: none;
  padding: 0;
}

.pagination__item {
  display: inline;
}

.pagination__button,
.pagination__link {
  display: inline-block;
  margin: 0 5px;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 50%;
  border: 1px solid var(--white);
}
.pagination__link:hover {
  color: var(--gray);
  border: 1px solid var(--gray);
}
.pagination__item--active .pagination__link {
  color: var(--blue);
  border: 1px solid var(--blue);
}

.pagination__link--write {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--blue);
  color: var(--blue);
  text-decoration: none;
  transition: background-color 0.3s;
  position: absolute;
  right: 46px;
  top: 50%;
  transform: translateY(-50%);
}

.table__body-row--notice {
  background-color: #f5f5f5;
  font-weight: bold;
  color: var(--blue);
  border-bottom: 1px solid var(--light-gray);
}
.table__body-row--notice:hover {
  background-color: #e8e8e8;
}
</style>
