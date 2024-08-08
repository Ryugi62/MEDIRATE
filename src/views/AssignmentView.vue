<template>
  <!-- 검수 작업 제목 -->

  <div class="assignment-header">
    <h1 class="header-title">검수 작업</h1>

    <!-- 과제 리스트에서 제목으로 검색 -->
    <div class="assignment-search-input">
      <!-- 초기화 버튼 -->
      <i class="fa-solid fa-rotate-left reset-icon" @click="resetSearch"></i>
      <input
        class="assignment-search"
        type="text"
        placeholder="검색어를 입력하세요"
      />
      <i
        class="fa-solid fa-magnifying-glass search-icon"
        @click="searchAssignment"
      ></i>
    </div>
  </div>

  <!-- 과제 목록 테이블 -->
  <div class="assignments-table-container">
    <table>
      <thead>
        <!-- 테이블 헤더 -->
        <tr>
          <!-- 각 열 정렬 기능 -->
          <th
            v-for="column in columns"
            :key="column.key"
            @click="column.sortable && sortBy(column.key)"
            :class="{ sortable: column.sortable }"
          >
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
      <tbody>
        <!-- 각 과제 항목 -->
        <tr
          v-for="assignment in visibleAssignments"
          :key="assignment.id"
          @click="redirect(assignment.id)"
        >
          <td v-for="column in columns" :key="column.key" :class="column.class">
            {{ getValue(assignment, column.key) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 페이지네이션 -->
  <nav class="pagination-nav" aria-label="Pagination">
    <ul class="pagination">
      <li>
        <i
          class="fa-solid fa-angles-left pagination__button"
          @click="changePage(1)"
          :disabled="current === 1"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(current - 1)"
          :disabled="current === 1"
        ></i>
      </li>
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
      <li>
        <i
          class="fa-solid fa-chevron-right pagination__button"
          @click="changePage(current + 1)"
          :disabled="current === total"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(total)"
          :disabled="current === total"
        ></i>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: "AssignmentEvaluationView",
  data() {
    return {
      originalAssignments: [],
      assignments: [],
      current: 1,
      perPage: 50,
      sortColumn: "id",
      sortDirection: "down",
    };
  },
  computed: {
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, class: "assignment-id" },
        {
          name: "제목",
          key: "title",
          sortable: true,
          class: "assignment-title",
        },
        {
          name: "생성",
          key: "CreationDate",
          sortable: true,
          class: "assignment-creation-date",
        },
        {
          name: "종료",
          key: "dueDate",
          sortable: true,
          class: "assignment-due-date",
        },
        {
          name: "상태",
          key: "status",
          sortable: true,
          class: "assignment-status",
        },
        {
          name: "현황",
          key: "progress",
          sortable: true,
          class: "assignment-progress",
        },
      ];
    },
    // 정렬된 과제 목록 반환
    sortedAssignments() {
      return [...this.assignments].sort((a, b) => {
        let aValue = this.getValue(a, this.sortColumn);
        let bValue = this.getValue(b, this.sortColumn);

        if (typeof aValue === "string" && aValue.includes("%")) {
          aValue = parseFloat(aValue.replace("%", ""));
        }
        if (typeof bValue === "string" && bValue.includes("%")) {
          bValue = parseFloat(bValue.replace("%", ""));
        }

        if (aValue < bValue) return this.sortDirection === "up" ? -1 : 1;
        if (aValue > bValue) return this.sortDirection === "up" ? 1 : -1;
        return 0;
      });
    },
    // 현재 페이지에 표시되는 과제 목록 반환
    visibleAssignments() {
      const start = (this.current - 1) * this.perPage;
      const end = this.current * this.perPage;
      return this.sortedAssignments.slice(start, end);
    },
    // 총 페이지 수 계산
    total() {
      return Math.ceil(this.assignments.length / this.perPage);
    },
    // 표시되는 페이지 수 계산
    visiblePages() {
      const start = Math.max(1, this.current - 2);
      const end = Math.min(this.total, start + 4);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    },
  },

  mounted() {
    // 헤더에 jwt 토큰을 담아서 요청
    this.$axios
      .get("/api/assignments", {
        headers: {
          Authorization: `Bearer ${this.$store.getters.getUser.token}`,
        },
      })
      .then((response) => {
        this.originalAssignments = response.data;
        this.assignments = response.data;
      })
      .catch((error) => {
        console.error(error);
      });
  },

  methods: {
    // 다른 페이지로 리다이렉트
    redirect(id) {
      this.$router.push({ name: "assignmentDetail", params: { id } });
    },
    // 페이지 변경
    changePage(pageNumber) {
      this.current = Math.max(1, Math.min(pageNumber, this.total));
    },
    // 특정 키로 과제 목록 정렬
    sortBy(columnKey) {
      if (this.sortColumn === columnKey) {
        this.sortDirection = this.sortDirection === "up" ? "down" : "up";
      } else {
        this.sortColumn = columnKey;
        this.sortDirection = columnKey === "id" ? "down" : "up"; // ID 열은 항상 내림차순으로 시작
      }
    },
    getValue(obj, key) {
      if (key === "progress") {
        return `${obj.completed || 0} / ${obj.total || 0}`;
      }
      if (key === "CreationDate" || key === "dueDate") {
        console.log(
          `obj[key]: ${obj[key]}, Date.parse(obj[key]): ${Date.parse(obj[key])}`
        );
        if (obj[key] && !isNaN(Date.parse(obj[key]))) {
          const date = new Date(obj[key]);
          return date.toISOString().split("T")[0]; // YYYY-MM-DD 형식으로 반환
        }
        return "N/A";
      }
      return obj[key] || "N/A";
    },
    searchAssignment() {
      const search = document.querySelector(".assignment-search").value;
      if (search === "") this.resetSearch();
      this.assignments = this.assignments.filter((assignment) =>
        assignment.title.includes(search)
      );
    },

    resetSearch() {
      document.querySelector(".assignment-search").value = "";
      this.assignments = this.originalAssignments;
    },
  },
};
</script>

<style scoped>
.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--light-gray);
  padding: 9px 24px;
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}
/* 유저 검색 입력 */
.assignment-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--light-gray);
  margin-right: 22px;
}

/* 유저 검색 입력 상자 */
.assignment-search-input input {
  border: none;
  padding: 8px;
  box-sizing: border-box;
}

/* 검색 아이콘 */
.search-icon,
.reset-icon {
  padding: 12px;
  cursor: pointer;
}

.search-icon {
  color: var(--white);
  background-color: var(--blue);
}

/* 검색 아이콘 호버 및 액티브 */
.search-icon:hover {
  background-color: var(--blue-hover);
}

.search-icon:active {
  background-color: var(--blue-active);
}

.reset-icon {
  color: var(--gray);
}

.reset-icon:hover {
  color: var(--gray-hover);
}

.reset-icon:active {
  color: var(--gray-active);
}

.assignments-table-container {
  min-width: 950px;
  min-height: 676px;
}

.assignments-table-container table {
  padding-right: 46px;
  width: 100%;
  border-collapse: collapse;
}

table thead tr {
  border-bottom: 1px solid var(--light-gray);
}

th {
  padding: 12px 24px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid var(--light-gray);
}

th:last-child,
td:last-child {
  padding-right: 46px;
}

.sortable {
  cursor: pointer;
}

.sortable:hover {
  color: var(--blue-hover);
}

.sortable:active {
  color: var(--blue-active);
}

td {
  padding: 12px 24px;
  text-align: center;
}

tbody > tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}

.assignment-id {
  width: 54px;
}

.assignment-title {
  text-align: left;
}

.assignment-creation-date,
.assignment-due-date,
.assignment-status,
.assignment-progress {
  width: 95px;
}

.assignment-progress strong {
  font-size: 16px;
  color: var(--blue);
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
