<template>
  <!-- 검수 작업 제목 -->
  <div class="assignment-header">
    <h1 class="header-title">검수 작업</h1>

    <!-- 필터링 및 검색 컨트롤 -->
    <div class="controls-container">
      <div class="filter-group">
        <!-- 필터링 드롭다운들 -->
        <div class="filter-controls">
          <!-- 평가방식 선택 -->
          <select
            v-model="selectedAssignmentMode"
            @change="applyFilters"
            class="filter-select"
          >
            <option value="">모든 평가방식</option>
            <option
              v-for="mode in availableAssignmentModes"
              :key="mode"
              :value="mode"
            >
              {{ mode }}
            </option>
          </select>

          <!-- 암종 선택 -->
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

          <!-- 폴더 선택 -->
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

        <!-- 과제 리스트에서 제목으로 검색 -->
        <div
          class="assignment-search-input"
          :class="{ 'search-input-focused': isFocused }"
        >
          <!-- 초기화 버튼 -->
          <i class="fa-solid fa-rotate-left reset-icon" @click="resetSearch"></i>
          <input
            class="assignment-search"
            type="text"
            v-model="searchQuery"
            placeholder="검색어를 입력하세요"
            @focus="isFocused = true"
            @blur="isFocused = false"
            @keypress.enter="searchAssignment"
          />
          <i
            class="fa-solid fa-magnifying-glass search-icon"
            @click="searchAssignment"
          ></i>
        </div>
      </div>
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
          class="fa-solid fa-chevron-right pagination__button"
          @click="changePage(current + 1)"
          :class="{ 'pagination__button--disabled': current === total }"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(total)"
          :class="{ 'pagination__button--disabled': current === total }"
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
      current: this.$store.getters.getAssignmentCurrentPage || 1, // Vuex에서 현재 페이지 가져오기
      perPage: 50,
      sortColumn: "id",
      sortDirection: "down",
      searchQuery: this.$store.getters.getAssignmentSearchHistory || "",
      isFocused: false,
      // 필터링 관련 데이터
      availableCancerTypes: [],
      availableFolderNames: [],
      availableAssignmentModes: [],
      selectedCancerType: "",
      selectedFolderName: "",
      selectedAssignmentMode: "",
    };
  },
  computed: {
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, class: "assignment-id" },
        {
          name: "평가유형",
          key: "assignment_mode",
          sortable: true,
          class: "assignment-mode",
        },
        {
          name: "암종명",
          key: "cancer_type",
          sortable: true,
          class: "assignment-cancer",
        },
        {
          name: "폴더명",
          key: "folder_name",
          sortable: true,
          class: "assignment-folder",
        },
        {
          name: "제목",
          key: "title",
          sortable: true,
          class: "assignment-title",
        },
        {
          name: "생성시간",
          key: "CreationDate",
          sortable: true,
          class: "assignment-creation-date",
        },
        {
          name: "종료시간",
          key: "end_time",
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
        {
          name: "소요시간",
          key: "evaluation_time",
          sortable: true,
          class: "assignment-duration",
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

  watch: {
    // Watch for changes in searchQuery and update the Vuex store
    searchQuery(newQuery) {
      this.updateAssignmentSearchHistory(newQuery);
    },

    // Watch for changes in current page and update the Vuex store
    current(newPage) {
      this.updateAssignmentCurrentPage(newPage);
    },
  },

  mounted() {
    // 필터 옵션 가져오기
    this.loadFilterOptions();
    
    // 헤더에 jwt 토큰을 담아서 요청
    this.loadAssignments();
  },

  methods: {
    // 다른 페이지로 리다이렉트
    redirect(id) {
      this.$router.push({ name: "assignmentDetail", params: { id } });
    },

    // 페이지 변경
    changePage(pageNumber) {
      const newPage = Math.max(1, Math.min(pageNumber, this.total));
      this.current = newPage;
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
      if (key === "CreationDate" || key === "end_time") {
        if (obj[key] && !isNaN(Date.parse(obj[key]))) {
          const date = new Date(obj[key]);
          // YYYY-MM-DD HH:MM:SS 형식으로 반환
          return (
            date.getFullYear() +
            "-" +
            ("0" + (date.getMonth() + 1)).slice(-2) +
            "-" +
            ("0" + date.getDate()).slice(-2) +
            " " +
            ("0" + date.getHours()).slice(-2) +
            ":" +
            ("0" + date.getMinutes()).slice(-2) +
            ":" +
            ("0" + date.getSeconds()).slice(-2)
          );
        }
        return "N/A";
      }
      if (key === "evaluation_time") {
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
      return obj[key] || "N/A";
    },
    searchAssignment() {
      if (this.searchQuery === "") {
        this.resetSearch();
        return;
      }
      this.assignments = this.originalAssignments.filter((assignment) =>
        assignment.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
      );
      this.current = 1; // 검색 후 첫 페이지로 이동
    },
    resetSearch() {
      this.searchQuery = "";
      this.selectedCancerType = "";
      this.selectedFolderName = "";
      this.selectedAssignmentMode = "";
      this.loadAssignments();
      this.current = 1; // 리셋 후 첫 페이지로 이동
    },

    // Assign search from store
    assignAssignmentSearchFromStore() {
      this.assignments = this.originalAssignments.filter((assignment) =>
        assignment.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
      this.current = 1;
    },

    // Update search history in Vuex store
    updateAssignmentSearchHistory(history) {
      this.$store.commit("setAssignmentSearchHistory", history);
    },

    // Update current page in Vuex store
    updateAssignmentCurrentPage(page) {
      this.$store.commit("setAssignmentCurrentPage", page);
    },

    // 필터 옵션 로드
    async loadFilterOptions() {
      try {
        const response = await this.$axios.get("/api/assignments/filters", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getUser.token}`,
          },
        });
        
        this.availableCancerTypes = response.data.cancerTypes;
        this.availableFolderNames = response.data.folderNames;
        this.availableAssignmentModes = response.data.assignmentModes;
      } catch (error) {
        console.error("필터 옵션 로드 실패:", error);
      }
    },

    // 과제 목록 로드
    async loadAssignments() {
      try {
        const params = {};
        
        if (this.selectedCancerType) params.cancer_type = this.selectedCancerType;
        if (this.selectedFolderName) params.folder_name = this.selectedFolderName;
        if (this.selectedAssignmentMode) params.assignment_mode = this.selectedAssignmentMode;
        
        const response = await this.$axios.get("/api/assignments", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getUser.token}`,
          },
          params,
        });
        
        this.originalAssignments = response.data;
        this.assignments = response.data;

        // 만약 store에 검색 기록이 있다면 해당 검색을 수행
        if (this.searchQuery) {
          this.assignAssignmentSearchFromStore();
        }

        // 만약 store에 현재 페이지가 있다면 해당 페이지로 이동
        if (this.$store.getters.getAssignmentCurrentPage) {
          // 페이지 번호가 총 페이지 수를 초과하지 않도록 조정
          this.current = Math.min(
            this.$store.getters.getAssignmentCurrentPage,
            this.total
          );
        }
      } catch (error) {
        console.error("과제 목록 로드 실패:", error);
      }
    },

    // 필터 적용
    applyFilters() {
      this.loadAssignments();
      this.current = 1; // 필터 적용 시 첫 페이지로 이동
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

.controls-container {
  display: flex;
  align-items: center;
  gap: 16px;
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

.filter-select:focus {
  outline: none;
  border-color: var(--blue);
  box-shadow: 0 0 5px var(--blue);
}

.filter-select:hover {
  border-color: var(--blue);
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}

.assignment-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--light-gray);
  margin-right: 22px;
  transition: all 0.3s ease;
}

.search-input-focused {
  border-color: var(--blue);
  box-shadow: 0 0 5px var(--blue);
}

.assignment-search-input input {
  border: none;
  padding: 8px;
  box-sizing: border-box;
}

.assignment-search:focus {
  outline: none;
}

.search-icon,
.reset-icon {
  padding: 12px;
  cursor: pointer;
}

.search-icon {
  color: var(--white);
  background-color: var(--blue);
}

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
.assignment-progress,
.assignment-mode,
.assignment-cancer,
.assignment-folder {
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

.filter-group {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
}
</style>
