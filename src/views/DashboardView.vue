<template>
  <!-- 대시보드 제목 -->
  <h1 class="title">대시 보드</h1>

  <!-- 테이블 박스 -->
  <div class="table-box">
    <!-- 테이블 -->
    <table>
      <!-- 테이블 헤더 -->
      <thead>
        <tr>
          <!-- 각 열의 제목 -->
          <!-- 아이콘이 있는것만 click 이벤트 활성화 -->
          <th
            v-for="column in columns"
            :key="column.key"
            @click="column.sortable && sortBy(column.key)"
          >
            <!-- 화살표 아이콘과 열 이름 -->
            <i
              v-if="column.sortable"
              :class="[
                'fa-solid',
                'fa-arrow-' +
                  (sortColumn === column.key ? sortDirection : 'down'),
              ]"
            ></i>
            {{ column.name }}
          </th>
        </tr>
      </thead>
      <!-- 테이블 바디 -->
      <tbody>
        <tr
          v-for="item in paginatedData"
          :key="item.id"
          :class="{
            completed: item.answerRate === '100%',
          }"
          @click="goToDetail(item.id)"
        >
          <!-- 각 열의 데이터 -->
          <td v-for="column in columns" :key="column.key" :class="column.class">
            {{ item[column.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 페이지네이션 -->
  <nav class="pagination-nav" aria-label="Pagination">
    <ul class="pagination">
      <li>
        <!-- fa-solid fa-angles-left pagination__button -->
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(current - 1)"
          :disabled="current === 1"
        ></i>
      </li>

      <!-- 이전 페이지 버튼 -->
      <li>
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(current - 1)"
          :disabled="current === 1"
        ></i>
      </li>
      <!-- 페이지 버튼 -->
      <li
        v-for="page in visiblePages"
        :key="page"
        :class="{ 'pagination__item--active': current === page }"
        class="pagination__item"
      >
        <a @click.prevent="changePage(page)" class="pagination__link">{{
          page
        }}</a>
      </li>
      <!-- 다음 페이지 버튼 -->
      <li>
        <i
          class="fa-solid fa-angle-right pagination__button"
          @click="changePage(current + 1)"
          :disabled="current === total"
        ></i>
      </li>

      <li>
        <i
          class="fa-solid fa-angle-right pagination__button"
          @click="changePage(current + 1)"
          :disabled="current === total"
        ></i>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: "DashboardView",

  data() {
    return {
      // 정렬 열 및 방향
      sortColumn: "id",
      sortDirection: "up",
      // 테이블 데이터
      data: null,
      // 페이지 관련 데이터
      current: 1,
      total: null,
      itemsPerPage: 14,
    };
  },

  computed: {
    // 현재 페이지의 데이터
    paginatedData() {
      return this.data;
    },
    // 보여줄 페이지 수
    visiblePages() {
      const totalPages = Math.ceil(this.total / this.itemsPerPage);
      const startPage = Math.max(1, Math.min(this.current - 2, totalPages - 4));
      const endPage = Math.min(totalPages, startPage + 4);
      const pages = [];
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      return pages;
    },
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, class: "id" },
        {
          name: "제목",
          key: "title",
          sortable: false,
          class: "assignment-title",
        },
        {
          name: "생성",
          key: "createdAt",
          sortable: true,
          class: "created-at",
        },
        { name: "종료", key: "endAt", sortable: true, class: "end-at" },
        {
          name: "평가자 수",
          key: "evaluatorCount",
          sortable: true,
          class: "evaluator",
        },
        {
          name: "답변완료율",
          key: "answerRate",
          sortable: true,
          class: "answer-rate",
        },
        {
          name: "미답변율",
          key: "unansweredRate",
          sortable: true,
          class: "unanswered-rate",
        },
      ];
    },
  },

  mounted() {
    // 데이터 가져오기
    this.getData();
  },

  methods: {
    async getData() {
      this.$axios
        .get("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        })
        .then((res) => {
          this.data = res.data; // 서버 응답 데이터를 직접 할당
          this.total = res.data.length; // 데이터 총 개수 설정
        })
        .catch((err) => {
          console.error(err);
        });
    },

    // 페이지 변경
    changePage(page) {
      const totalPages = Math.ceil(this.total / this.itemsPerPage);
      if (page >= 1 && page <= totalPages) {
        this.current = page;
      }
    },
    // 열 정렬
    sortBy(columnKey) {
      if (this.sortColumn === columnKey) {
        this.sortDirection = this.sortDirection === "up" ? "down" : "up";
      } else {
        this.sortColumn = columnKey;
        this.sortDirection = "up";
      }

      // 원본 데이터를 정렬하는 로직 추가
      this.data.sort((a, b) => {
        let aValue = a[columnKey];
        let bValue = b[columnKey];

        // '%' 제거
        if (typeof aValue === "string" && aValue.includes("%")) {
          aValue = parseFloat(aValue.replace("%", ""));
        }

        if (typeof bValue === "string" && bValue.includes("%")) {
          bValue = parseFloat(bValue.replace("%", ""));
        }

        let comparison = 0;
        if (aValue > bValue) {
          comparison = 1;
        } else if (aValue < bValue) {
          comparison = -1;
        }

        this.current = 1;

        return this.sortDirection === "up" ? comparison : -comparison;
      });
    },

    // 상세 페이지로 이동
    goToDetail(id) {
      this.$router.push({ name: "dashboardDetail", params: { id } });
    },
  },
};
</script>

<style scoped>
* {
  /* border: 1px solid red; */
}

.title {
  display: flex;
  align-items: center;
  height: 60px;
  border-bottom: 1px solid var(--light-gray);
  margin: 0;
  padding-left: 24px;
  font-size: 24px;
  font-weight: 500;
}

.table-box {
  min-height: 676px;
}

table {
  min-width: 1200px;
  width: 100%;
  text-align: center;
  border-collapse: collapse;
}

th {
  padding: 12px 24px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid var(--light-gray);
  cursor: pointer;
  text-wrap: nowrap;
}

tr.completed {
  color: gray; /* 완료된 과제의 셀 텍스트 색상을 회색으로 지정 */
}

tbody > tr:hover {
  cursor: pointer;
  background-color: #f5f5f5;
}

td {
  padding: 12px 24px;
  text-align: center;
}

td.id {
  width: 54px;
}

td.assignment-id,
td.evaluator {
  width: 80px;
}

td.assignment-title {
  text-align: left;
}

td.created-at,
td.end-at,
td.answer-rate,
td.unanswered-rate {
  width: 130px;
}

.pagination-nav {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  position: relative;
}

.pagination {
  display: flex;
  list-style: none;
  padding: 0;
  align-items: center;
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
</style>
