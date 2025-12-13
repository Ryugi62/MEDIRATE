<!-- DashboardView.vue -->

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
      <!-- 모드 필터 -->
      <select v-model="selectedMode" class="mode-filter" @change="current = 1">
        <option value="all">전체 모드</option>
        <option value="TextBox">TextBox</option>
        <option value="BBox">BBox</option>
        <option value="Consensus">Consensus (합의)</option>
      </select>

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

      <button class="metrics-button" @click="showMetrics">Metrics 보기</button>

      <button
        class="download-image-button"
        @click="downloadSearchedItemsAssets"
      >
        검색된 과제 이미지 다운로드
      </button>

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
            'consensus-row': item.isConsensus,
          }"
          @click="goToDetail(item)"
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
          :class="{ 'pagination__button--disabled': current === 1 }"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angle-left pagination__button"
          @click="changePage(current - 1)"
          :class="{ 'pagination__button--disabled': current === 1 }"
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
          :class="{ 'pagination__button--disabled': current === filteredLastPage }"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(filteredLastPage)"
          :class="{ 'pagination__button--disabled': current === filteredLastPage }"
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
      current: this.$store.getters.getDashboardCurrentPage || 1, // Vuex에서 현재 페이지 가져오기
      total: 0,
      lastPage: 0,
      itemsPerPage: 50,
      searchQuery: this.$store.getters.getDashboardSearchHistory || "",
      isFocused: false, // 추가
      isExporting: false,
      exportingMessage: "잠시만 기다려주세요. 데이터를 다운로드 중입니다.",
      sliderValue: 1,
      score_value: 50,
      selectedMode: "all", // all, TextBox, BBox, Consensus
    };
  },

  computed: {
    // 모드 필터가 적용된 데이터
    filteredData() {
      if (this.selectedMode === "all") {
        return this.data;
      }
      return this.data.filter((item) => item.mode === this.selectedMode);
    },
    paginatedData() {
      const start = (this.current - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredData.slice(start, end);
    },
    filteredTotal() {
      return this.filteredData.length;
    },
    filteredLastPage() {
      return Math.ceil(this.filteredTotal / this.itemsPerPage) || 1;
    },
    visiblePages() {
      const totalPages = Math.ceil(this.filteredTotal / this.itemsPerPage);
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
          name: "모드",
          key: "mode",
          sortable: true,
          class: "assignment-mode",
        },
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
  },

  watch: {
    // Watch for changes in searchQuery and update the Vuex store
    searchQuery(newQuery) {
      this.updateDashboardSearchHistory(newQuery);
    },

    // Watch for changes in current page and update the Vuex store
    current(newPage) {
      this.updateDashboardCurrentPage(newPage);
    },
  },

  async mounted() {
    const headers = {
      Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
    };

    try {
      // 일반 대시보드와 합의 과제를 병렬로 가져오기
      const [dashboardRes, consensusRes] = await Promise.all([
        this.$axios.get("/api/dashboard", { headers }),
        this.$axios.get("/api/consensus", { headers }),
      ]);

      // 일반 대시보드 데이터에 mode 필드 추가
      const regularData = dashboardRes.data.map((item) => ({
        ...item,
        mode: item.assignmentMode || "BBox",
        isConsensus: false,
      }));

      // 합의 과제 대시보드 형식으로 변환
      const consensusData = consensusRes.data.map((c) => ({
        id: `C${c.id}`,
        consensusId: c.id,
        title: c.title,
        mode: "Consensus",
        createdAt: c.creation_date ? new Date(c.creation_date).toISOString().split("T")[0] : "N/A",
        endAt: c.deadline ? new Date(c.deadline).toISOString().split("T")[0] : "N/A",
        evaluatorCount: c.evaluator_count || 0,
        answerRate: c.total_fp > 0 ? ((c.responded_fp || 0) / c.total_fp * 100).toFixed(1) + "%" : "0%",
        unansweredRate: c.total_fp > 0 ? (100 - (c.responded_fp || 0) / c.total_fp * 100).toFixed(1) + "%" : "100%",
        isConsensus: true,
      }));

      // 두 목록 합치기
      this.originalData = [...regularData, ...consensusData];
      this.data = [...this.originalData];
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.sortBy(this.sortColumn); // 초기 정렬 적용

      // 만약 store에 검색 기록이 있다면 해당 검색을 수행
      if (this.searchQuery) {
        this.assignDashboardSearchFromStore();
      }

      // 만약 store에 현재 페이지가 있다면 해당 페이지로 이동
      if (this.$store.getters.getDashboardCurrentPage) {
        // 페이지 번호가 총 페이지 수를 초과하지 않도록 조정
        this.current = Math.min(
          this.$store.getters.getDashboardCurrentPage,
          this.lastPage
        );
      }
    } catch (error) {
      console.error("대시보드 데이터 로딩 오류:", error);
    }
  },

  methods: {
    // 다른 페이지로 리다이렉트
    goToDetail(item) {
      if (item.isConsensus) {
        this.$router.push({ name: "consensusDetail", params: { id: item.consensusId } });
      } else {
        this.$router.push({ name: "dashboardDetail", params: { id: item.id } });
      }
    },

    // 페이지 변경
    changePage(pageNumber) {
      const totalPages = this.filteredLastPage;
      if (pageNumber >= 1 && pageNumber <= totalPages) {
        this.current = pageNumber;
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

    changeSliderValue(event) {
      this.sliderValue = event.target.value;
    },

    searchDashboard() {
      if (this.searchQuery === "") {
        this.resetSearch();
        return;
      }
      this.data = this.originalData.filter((item) =>
        item.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
      );
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1; // 검색 후 첫 페이지로 이동
      this.$store.commit("setDashboardSearchHistory", this.searchQuery);
    },

    resetSearch() {
      this.searchQuery = "";
      this.data = this.originalData;
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1; // 리셋 후 첫 페이지로 이동
      this.$store.commit("setDashboardSearchHistory", "");
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
          link.setAttribute(
            "download",
            `${this.searchQuery ? this.searchQuery : "전체과제"}-#${
              this.sliderValue
            }인 일치-${this.score_value / 100}점.xlsx`
          );
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

    downloadSearchedItemsAssets() {
      this.isExporting = true;
      this.$axios
        .post(
          "/api/download/download-searched-assignments-assets",
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
          link.setAttribute(
            "download",
            `${this.searchQuery ? this.searchQuery : "전체과제"}-#${
              this.sliderValue
            }인 일치-${this.score_value / 100}점.zip`
          ); // 확장자를 .zip으로 변경
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

    setSearchQuery() {
      this.searchQuery = this.$store.getters.getDashboardSearchHistory
        ? this.$store.getters.getDashboardSearchHistory
        : "";
    },

    assignDashboardSearchFromStore() {
      this.data = this.originalData.filter((item) =>
        item.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1;
    },

    // Update search history in Vuex store
    updateDashboardSearchHistory(history) {
      this.$store.commit("setDashboardSearchHistory", history);
    },

    // Update current page in Vuex store
    updateDashboardCurrentPage(page) {
      this.$store.commit("setDashboardCurrentPage", page);
    },

    async showMetrics() {
      if (this.data.length === 0) {
        alert("검색된 과제가 없습니다.");
        return;
      }

      try {
        this.isExporting = true;
        this.exportingMessage = "Metrics 분석중입니다.";

        // 현재 검색된 과제들의 ID를 수집
        const assignmentIds = this.data.map((assignment) => assignment.id);

        // POST 요청으로 현재 과제들의 ID, sliderValue, score_value를 전송하여 Metrics를 가져옴
        const response = await this.$axios.post(
          "/api/download/metrics",
          {
            assignmentIds, // 검색된 과제들의 ID
            sliderValue: this.sliderValue, // 슬라이더 값
            score_value: this.score_value / 100, // 점수 값 (백분율로 보내기 위해 100으로 나누기)
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        const metrics = response.data.metrics; // [{ Recall, Precision, F1 }]

        if (metrics.length === 0) {
          alert("해당 과제들에 대한 Metrics 데이터가 없습니다.");
          return;
        }

        let alertMessage = "[ 검색된 과제들의 Metrics ]\n\n";
        metrics.forEach((metric) => {
          alertMessage += `Recall: ${metric.Recall.toFixed(2)}\n`;
          alertMessage += `Precision: ${metric.Precision.toFixed(2)}\n`;
          alertMessage += `F1-score: ${metric.F1.toFixed(2)}\n\n`;
          alertMessage += `평가자 일치: ${metric.sliderValue}\n`;
          alertMessage += `신뢰도(score) 값: ${metric.score_value * 100}%\n`;
        });

        alert(alertMessage);

        console.log(alertMessage);
      } catch (error) {
        console.error("Metrics를 가져오는 중 오류 발생:", error);
        alert("Metrics를 가져오는 중 오류가 발생했습니다.");
      } finally {
        this.isExporting = false;
        this.exportingMessage =
          "잠시만 기다려주세요. 데이터를 다운로드 중입니다.";
      }
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
  white-space: nowrap;
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  margin-right: 100px;
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

.download-image-button {
  color: white;
  border: 1px solid black;
  background-color: black;
}

.download-image-button:hover {
  background-color: #333333; /* 어두운 회색 */
}

.download-image-button:active {
  background-color: #1a1a1a; /* 더 어두운 회색 */
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

.pagination__button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pagination__link:hover {
  color: var(--gray);
  border: 1px solid var(--gray);
}

.pagination__item--active .pagination__link {
  color: var(--blue);
  border: 1px solid var(--blue);
}

.exporting-message {
  top: 50%;
  left: 50%;
  color: black;
  border: 1px solid var(--light-gray);
  z-index: 1000;
  padding: 20px 40px;
  position: fixed;
  font-size: 18px;
  transform: translate(-50%, -50%);
  font-weight: bold;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.9);
}

/* 모드 필터 스타일 */
.mode-filter {
  padding: 8px 12px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  background-color: white;
}

.mode-filter:focus {
  outline: none;
  border-color: var(--blue);
}

td.assignment-mode {
  width: 90px;
  font-weight: 500;
}

/* 합의 과제 행 스타일 */
.consensus-row {
  background-color: #fff8e1;
}

.consensus-row:hover {
  background-color: #ffecb3 !important;
}
</style>
