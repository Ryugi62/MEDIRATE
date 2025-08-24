<!-- TSRDashboardView.vue - Polygon 전용 대시보드 -->

<template>
  <div v-if="isExporting" class="exporting-message">
    {{ exportingMessage }}
  </div>
  <!-- 대시보드 헤더 -->
  <div class="dashboard-header">
    <h1 class="header-title">TSR 대시보드 (Polygon)</h1>

    <div class="filter-group">
      <!-- 필터링 드롭다운들 -->
      <div class="filter-controls">
        <select
          v-model="selectedCancerType"
          @change="applyFilters"
          class="filter-select"
        >
          <option value="">모든 암종</option>
          <option
            v-for="cancer in availableCancerTypes"
            :key="cancer"
            :value="cancer"
          >
            {{ cancer }}
          </option>
        </select>
        <select
          v-model="selectedFolderName"
          @change="applyFilters"
          class="filter-select"
        >
          <option value="">모든 폴더</option>
          <option
            v-for="folder in availableFolderNames"
            :key="folder"
            :value="folder"
          >
            {{ folder }}
          </option>
        </select>
      </div>

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
          @input="changeScoreValue"
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

        <button class="metrics-button" @click="showMetrics">
          Metrics 보기
        </button>

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
  </div>

  <!-- 테이블 박스 -->
  <div class="table-box">
    <!-- 테이블 -->
    <table>
      <!-- 테이블 헤더 -->
      <thead>
        <tr>
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
      <!-- 테이블 바디 -->
      <tbody>
        <tr
          v-for="item in paginatedData"
          :key="item.id"
          :class="{ completed: item.answerRate === '100.00%' }"
          @click="goToDetail(item.id)"
        >
          <td v-for="column in columns" :key="column.key" :class="column.class">
            {{ getValue(item, column.key) }}
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
          :class="{ 'pagination__button--disabled': current === lastPage }"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(lastPage)"
          :class="{ 'pagination__button--disabled': current === lastPage }"
        ></i>
      </li>
    </ul>
  </nav>
</template>

<script>
export default {
  name: "TSRDashboardView",

  data() {
    return {
      sortColumn: "id",
      sortDirection: "up",
      originalData: [],
      data: [],
      current: this.$store.getters.getTSRDashboardCurrentPage || 1,
      total: 0,
      lastPage: 0,
      itemsPerPage: 50,
      searchQuery: this.$store.getters.getTSRDashboardSearchHistory || "",
      isFocused: false,
      isExporting: false,
      exportingMessage: "잠시만 기다려주세요. 데이터를 다운로드 중입니다.",
      sliderValue: 1,
      score_value: 50,
      availableCancerTypes: [],
      availableFolderNames: [],
      selectedCancerType: "",
      selectedFolderName: "",
      filterTimeout: null, // 디바운싱용 타이머
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
          name: "암종명",
          key: "cancer_type",
          sortable: true,
          class: "cancer-type",
        },
        {
          name: "폴더명",
          key: "folder_name",
          sortable: true,
          class: "folder-name",
        },
        {
          name: "제목",
          key: "title",
          sortable: false,
          class: "assignment-title",
        },
        {
          name: "생성시간",
          key: "createdAt",
          sortable: true,
          class: "created-at",
        },
        { name: "종료시간", key: "endAt", sortable: true, class: "end-at" },
        {
          name: "소요시간",
          key: "duration",
          sortable: true,
          class: "duration",
        },
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
    searchQuery(newQuery) {
      this.updateTSRDashboardSearchHistory(newQuery);
    },
    current(newPage) {
      this.updateTSRDashboardCurrentPage(newPage);
    },
  },

  mounted() {
    this.loadFilterOptions();
    this.loadDashboardData();
  },

  methods: {
    getValue(obj, key) {
      if (key === "duration") {
        if (obj[key] === null || obj[key] === undefined) return "N/A";
        const seconds = parseInt(obj[key], 10);
        const h = Math.floor(seconds / 3600)
          .toString()
          .padStart(2, "0");
        const m = Math.floor((seconds % 3600) / 60)
          .toString()
          .padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${h}:${m}:${s}`;
      }
      if (key === "endAt" || key === "createdAt") {
        return obj[key] ? obj[key] : "-";
      }
      return obj[key] ?? "-";
    },
    async loadFilterOptions() {
      try {
        const response = await this.$axios.get("/api/assignments/filters", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getUser.token}`,
          },
        });
        this.availableCancerTypes = response.data.cancerTypes;
        this.availableFolderNames = response.data.folderNames;
      } catch (error) {
        console.error("필터 옵션 로드 실패:", error);
      }
    },
    async loadDashboardData() {
      try {
        const params = {
          assignment_mode: "Polygon",
        };
        if (this.selectedCancerType)
          params.cancer_type = this.selectedCancerType;
        if (this.selectedFolderName)
          params.folder_name = this.selectedFolderName;

        const response = await this.$axios.get("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
          params,
        });

        this.originalData = response.data;
        // 최초 로드 시에도 슬라이더 조건 반영
        await this.applyMatchSummaryFilter();
        this.total = this.data.length;
        this.lastPage = Math.ceil(this.total / this.itemsPerPage);
        this.sortBy(this.sortColumn);

        if (this.searchQuery) {
          this.assignTSRDashboardSearchFromStore();
        }

        if (this.$store.getters.getTSRDashboardCurrentPage) {
          this.current = Math.min(
            this.$store.getters.getTSRDashboardCurrentPage,
            this.lastPage
          );
        }
      } catch (error) {
        console.error(error);
      }
    },
    applyFilters() {
      this.loadDashboardData();
      this.current = 1;
    },
    goToDetail(id) {
      this.$router.push({ name: "dashboardDetail", params: { id } });
    },
    changePage(pageNumber) {
      if (pageNumber >= 1 && pageNumber <= this.lastPage) {
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

      this.current = 1;
    },
    changeSliderValue(event) {
      this.sliderValue = Number(event.target.value);
      this.debouncedApplyFilter();
    },
    changeScoreValue() {
      this.score_value = Number(this.score_value);
      this.debouncedApplyFilter();
    },

    // 디바운싱된 필터 적용 함수
    debouncedApplyFilter() {
      if (this.filterTimeout) {
        clearTimeout(this.filterTimeout);
      }
      this.filterTimeout = setTimeout(() => {
        this.applyMatchSummaryFilter();
      }, 300); // 300ms 디바운싱
    },
    searchDashboard() {
      if (this.searchQuery === "") {
        this.resetSearch();
        return;
      }
      this.applyMatchSummaryFilter();
      this.current = 1;
      this.$store.commit("setTSRDashboardSearchHistory", this.searchQuery);
    },
    resetSearch() {
      this.searchQuery = "";
      this.selectedCancerType = "";
      this.selectedFolderName = "";
      this.loadDashboardData();
      this.current = 1;
      this.$store.commit("setTSRDashboardSearchHistory", "");
    },
    // 공통: 현재 검색어 기반 리스트 취득
    getBaseList() {
      if (!this.searchQuery) return [...this.originalData];
      return this.originalData.filter((item) =>
        item.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
      );
    },
    sortCurrentData() {
      const columnKey = this.sortColumn;
      const direction = this.sortDirection;
      this.data.sort((a, b) => {
        let aValue = a[columnKey];
        let bValue = b[columnKey];
        if (typeof aValue === "string" && aValue.includes("%"))
          aValue = parseFloat(aValue.replace("%", ""));
        if (typeof bValue === "string" && bValue.includes("%"))
          bValue = parseFloat(bValue.replace("%", ""));
        let comparison = 0;
        if (aValue > bValue) comparison = 1;
        else if (aValue < bValue) comparison = -1;
        return direction === "up" ? comparison : -comparison;
      });
    },
    async applyMatchSummaryFilter() {
      const baseList = this.getBaseList();
      if (baseList.length === 0) {
        this.data = [];
        this.total = 0;
        this.lastPage = 0;
        this.current = 1;
        return;
      }
      try {
        const assignmentIds = baseList.map((a) => a.id);
        const { data } = await this.$axios.post(
          "/api/download/match-summary",
          {
            assignmentIds,
            sliderValue: Number(this.sliderValue),
            score_value: this.score_value / 100,
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        const allowed = new Set(
          (data.summary || [])
            .filter((s) => s.hasMatch)
            .map((s) => s.assignmentId)
        );
        this.data = baseList.filter((a) => allowed.has(a.id));
        this.total = this.data.length;
        this.lastPage = Math.ceil(this.total / this.itemsPerPage);
        this.current = Math.min(1, this.lastPage) || 1;
        this.sortCurrentData();
      } catch (e) {
        console.error("match-summary 호출 실패:", e);
      }
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
            `TSR-${this.searchQuery ? this.searchQuery : "전체과제"}-#${
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
            `TSR-${this.searchQuery ? this.searchQuery : "전체과제"}-#${
              this.sliderValue
            }인 일치-${this.score_value / 100}점.zip`
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
    assignTSRDashboardSearchFromStore() {
      this.data = this.originalData.filter((item) =>
        item.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
      this.total = this.data.length;
      this.lastPage = Math.ceil(this.total / this.itemsPerPage);
      this.current = 1;
    },
    updateTSRDashboardSearchHistory(history) {
      this.$store.commit("setTSRDashboardSearchHistory", history);
    },
    updateTSRDashboardCurrentPage(page) {
      this.$store.commit("setTSRDashboardCurrentPage", page);
    },
    async showMetrics() {
      if (this.data.length === 0) {
        alert("검색된 과제가 없습니다.");
        return;
      }

      try {
        this.isExporting = true;
        this.exportingMessage = "TSR Metrics 분석중입니다.";

        const assignmentIds = this.data.map((assignment) => assignment.id);

        const response = await this.$axios.post(
          "/api/download/metrics",
          {
            assignmentIds,
            sliderValue: this.sliderValue,
            score_value: this.score_value / 100,
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        const metrics = response.data.metrics;

        if (metrics.length === 0) {
          alert("해당 과제들에 대한 Metrics 데이터가 없습니다.");
          return;
        }

        let alertMessage = "[ TSR (Polygon) 과제들의 Metrics ]\n\n";
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
  color: var(--pink);
}

.filter-group {
  display: flex;
  gap: 16px;
  align-items: center;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  background-color: var(--white);
  font-size: 14px;
  min-width: 120px;
  cursor: pointer;
  transition: border-color 0.3s ease;
}

.dashboard-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  margin-right: 22px;
  gap: 8px;
  align-items: center;
}

.slider-value {
  margin: auto;
  display: flex;
}

.search-input-container {
  border-radius: 4px;
  border: 1px solid var(--light-gray);
  transition: all 0.3s ease;
  display: flex;
}

.search-input-focused .search-input-container {
  border-color: var(--pink);
  box-shadow: 0 0 5px var(--pink);
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
  background-color: var(--pink);
}

.search-button:hover {
  background-color: var(--pink-hover);
}

.search-button:active {
  background-color: var(--pink-active);
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
  background-color: #333333;
}

.download-image-button:active {
  background-color: #1a1a1a;
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
  color: var(--pink-hover);
}

.sortable:active {
  color: var(--pink-active);
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
  color: var(--pink);
  border: 1px solid var(--pink);
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
</style>
