<template>
  <div v-if="isExporting" class="exporting-message">
    {{ exportingMessage }}
  </div>
  <!-- 대시보드 헤더 -->
  <div class="dashboard-header">
    <h1 class="header-title">대시 보드</h1>

    <!-- 검색 입력 -->
    <div
      class="dashboard-search-input"
      :class="{ 'search-input-focused': isFocused }"
    >
      <span class="slider-value"> {{ score_value }}% </span>
      <input
        type="range"
        name="score_value"
        id="score_value"
        v-model="score_value"
        min="0"
        max="100"
      />

      <span class="slider-value">{{ sliderValue }}인 일치</span>
      <input
        type="range"
        min="1"
        max="5"
        class="slider"
        :value="sliderValue"
        @input="changeSliderValue"
      />

      <div class="search-input-container">
        <i
          class="fa-solid fa-rotate-left reset-button"
          @click="resetSearch"
        ></i>
        <input
          class="search-input"
          type="text"
          v-model="searchQuery"
          placeholder="검색어를 입력하세요"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keypress.enter="searchDashboard"
        />
        <i
          class="fa-solid fa-magnifying-glass search-button"
          @click="searchDashboard"
        ></i>
      </div>

      <button class="download-button" @click="downloadSearchedItems">
        검색된 과제 다운로드
      </button>
    </div>
  </div>

  <!-- 테이블 박스 -->
  <div class="table-box">
    <!-- 테이블 -->
    <table>
      <!-- 테이블 헤더 -->
      <thead>
        <tr>
          <!-- 각 열의 제목 -->
          <th
            v-for="column in columns"
            :key="column.key"
            @click="column.sortable && sortBy(column.key)"
            :class="{ sortable: column.sortable }"
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
            {{
              column.key === "answerRate" || column.key === "unansweredRate"
                ? formatPercentage(item[column.key])
                : item[column.key]
            }}
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
          class="fa-solid fa-angle-right pagination__button"
          @click="changePage(current + 1)"
          :disabled="current === total"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(lastPage)"
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
      sortColumn: "id",
      sortDirection: "up",
      originalData: [],
      data: [],
      current: 1,
      total: 0,
      lastPage: 0,
      itemsPerPage: 50,
      searchQuery: "",
      isFocused: false, // 추가
      isExporting: false,
      sliderValue: 1,
      score_value: 50,
    };
  },

  computed: {
    paginatedData() {
      const start = (this.current - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.data.slice(start, end);
    },
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
        { name: "생성", key: "createdAt", sortable: true, class: "created-at" },
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
    exportingMessage() {
      return "잠시만 기다려주세요. 데이터를 다운로드 중입니다.";
    },
  },

  mounted() {
    this.getData();
  },

  methods: {
    async getData() {
      this.isExporting = true;

      try {
        const response = await this.$axios.get("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        });
        this.originalData = response.data;
        this.data = response.data;
        this.total = this.data.length;
        this.lastPage = Math.ceil(this.total / this.itemsPerPage);
        this.sortBy(this.sortColumn); // 초기 정렬 적용
      } catch (error) {
        console.error(error);
      } finally {
        this.isExporting = false;
      }
    },

    changePage(page) {
      const totalPages = Math.ceil(this.total / this.itemsPerPage);
      if (page >= 1 && page <= totalPages) {
        this.current = page;
      }
    },

    formatPercentage(value) {
      if (typeof value === "string") {
        value = parseFloat(value.replace("%", ""));
      }
      return Math.round(value) + "%";
    },

    sortBy(columnKey) {
      if (this.sortColumn === columnKey) {
        this.sortDirection = this.sortDirection === "up" ? "down" : "up";
      } else {
        this.sortColumn = columnKey;
        this.sortDirection = "up";
      }

      this.data.sort((a, b) => {
        let aValue = a[columnKey];
        let bValue = b[columnKey];

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

        return this.sortDirection === "up" ? comparison : -comparison;
      });

      this.current = 1; // 정렬 후 첫 페이지로 이동
    },

    goToDetail(id) {
      this.$router.push({ name: "dashboardDetail", params: { id } });
    },

    changeSliderValue(event) {
      this.sliderValue = event.target.value;
    },

    searchDashboard() {
      if (this.searchQuery === "") {
        this.resetSearch();
        return;
      }
      this.data = this.originalData.filter((item) =>
        item.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1; // 검색 후 첫 페이지로 이동
    },

    resetSearch() {
      this.searchQuery = "";
      this.data = this.originalData;
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1; // 리셋 후 첫 페이지로 이동
    },

    downloadSearchedItems() {
      this.isExporting = true;
      this.$axios
        .post(
          "/api/download/download-searched-assignments",
          {
            data: this.data,
            sliderValue: this.sliderValue,
            score_value: this.score_value / 100,
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
            responseType: "blob",
          }
        )
        .then((response) => {
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `Total_${this.data.length}.xlsx`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          this.isExporting = false;
        });
    },
  },
};
</script>

<style scoped>
.dashboard-header {
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

.dashboard-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  margin-right: 22px;
  gap: 8px;
}

.slider-value {
  margin: auto;
  display: flex;
}

.search-input-container {
  border-radius: 4px;
  border: 1px solid var(--light-gray);
  transition: all 0.3s ease;
}

.search-input-focused .search-input-container {
  border-color: var(--blue);
  box-shadow: 0 0 5px var(--blue);
}

.dashboard-search-input input {
  border: none;
  padding: 8px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
}

.search-button,
.reset-button {
  padding: 12px;
  cursor: pointer;
}

.search-button {
  color: var(--white);
  background-color: var(--blue);
}

.search-button:hover {
  background-color: var(--blue-hover);
}

.search-button:active {
  background-color: var(--blue-active);
}

.reset-button {
  color: var(--gray);
}

.reset-button:hover {
  color: var(--gray-hover);
}

.reset-button:active {
  color: var(--gray-active);
}

.download-button {
  background-color: var(--green);
}

.download-button:hover {
  background-color: var(--green-hover);
}

.download-button:active {
  background-color: var(--green-active);
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

.sortable:hover {
  color: var(--blue-hover);
}

.sortable:active {
  color: var(--blue-active);
}

tr.completed {
  color: gray;
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
