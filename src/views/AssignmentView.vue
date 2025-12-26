<template>
  <div class="assignment-view-container">
    <!-- 프로젝트 트리 필터 (사용자에게 할당된 과제만 표시) -->
    <ProjectTreeFilter
      :selected-project="filterProjectId"
      :selected-cancer="filterCancerId"
      :selected-mode="filterMode"
      :selected-tag="selectedTag"
      :all-tags="allTags"
      :for-user="true"
      @filter-change="onTreeFilterChange"
      @tag-change="onTagFilterChange"
    />

    <div class="assignment-main">
      <!-- 평가 수행 제목 -->
      <div class="assignment-header">
    <h1 class="header-title">평가 수행</h1>

    <div class="header-controls">
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
          @click="redirect(assignment)"
          :class="{
            'consensus-row': assignment.isConsensus,
            'opened-row': isAssignmentOpened(assignment)
          }"
        >
          <td v-for="column in columns" :key="column.key" :class="column.class">
            <template v-if="column.key === 'id'">
              <i v-if="isAssignmentOpened(assignment)" class="fas fa-external-link-alt opened-icon" title="열린 과제"></i>
              {{ getValue(assignment, column.key) }}
            </template>
            <template v-else>
              {{ getValue(assignment, column.key) }}
            </template>
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
          :class="{ 'pagination__button--disabled': current === totalPages }"
        ></i>
      </li>
      <li>
        <i
          class="fa-solid fa-angles-right pagination__button"
          @click="changePage(totalPages)"
          :class="{ 'pagination__button--disabled': current === totalPages }"
        ></i>
      </li>
    </ul>
  </nav>
    </div>
  </div>
</template>

<script>
import ProjectTreeFilter from "@/components/ProjectTreeFilter.vue";

export default {
  name: "AssignmentEvaluationView",
  components: {
    ProjectTreeFilter,
  },
  data() {
    return {
      // 트리 필터 상태
      filterProjectId: null,
      filterCancerId: null,
      filterMode: null,
      assignments: [], // 현재 페이지 데이터
      current: this.$store.getters.getAssignmentCurrentPage || 1,
      perPage: 15,
      total: 0, // 서버에서 받은 총 개수
      totalPages: 1, // 총 페이지 수
      sortColumn: this.$store.getters.getAssignmentSortColumn || "id",
      sortDirection: this.$store.getters.getAssignmentSortDirection || "down",
      searchQuery: this.$store.getters.getAssignmentSearchHistory || "",
      isFocused: false,
      isLoading: false, // 로딩 상태
      selectedMode: "all", // all, TextBox, BBox, Segment, Consensus
      selectedTag: "all",
      allTags: [], // 서버에서 받은 태그 목록
    };
  },
  computed: {
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, class: "assignment-id" },
        {
          name: "모드",
          key: "mode",
          sortable: true,
          class: "assignment-mode",
        },
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
    // 서버 페이지네이션 - 현재 페이지 데이터 그대로 사용
    visibleAssignments() {
      return this.assignments;
    },
    // 표시되는 페이지 수 계산
    visiblePages() {
      const start = Math.max(1, this.current - 2);
      const end = Math.min(this.totalPages, start + 4);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    },
    // 열린 과제 목록
    openedAssignments() {
      return this.$store.getters.getOpenedAssignments;
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

    // 모드 필터 변경 시 데이터 다시 로드
    selectedMode() {
      this.current = 1;
      this.loadPaginatedData();
    },
  },

  async mounted() {
    await this.loadPaginatedData();

    // 실시간 업데이트를 위한 storage 이벤트 리스너
    window.addEventListener('storage', this.handleStorageChange);
  },

  beforeUnmount() {
    window.removeEventListener('storage', this.handleStorageChange);
  },

  methods: {
    // 실시간 업데이트를 위한 storage 이벤트 핸들러
    handleStorageChange(event) {
      if (event.key === 'assignmentUpdated') {
        this.loadPaginatedData();
      }
    },

    // 서버 페이지네이션 데이터 로드
    async loadPaginatedData() {
      this.isLoading = true;
      const headers = {
        Authorization: `Bearer ${this.$store.getters.getUser.token}`,
      };

      try {
        // Consensus 모드일 경우 별도 처리
        if (this.selectedMode === "Consensus") {
          const consensusRes = await this.$axios.get("/api/consensus", { headers });
          let consensusAssignments = consensusRes.data.map((c) => ({
            id: `C${c.id}`,
            consensusId: c.id,
            title: c.title,
            mode: "Consensus",
            CreationDate: c.creation_date,
            dueDate: c.deadline,
            status: this.getConsensusStatus(c),
            completed: c.responded_fp || 0,
            total: c.total_fp || 0,
            tags: c.tags || [],
            isConsensus: true,
            project_id: c.project_id,
            cancer_type_id: c.cancer_type_id,
          }));

          // 검색어 필터 (클라이언트)
          if (this.searchQuery) {
            consensusAssignments = consensusAssignments.filter((a) =>
              a.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
            );
          }

          // 태그 필터 (클라이언트)
          if (this.selectedTag !== "all") {
            consensusAssignments = consensusAssignments.filter((a) => {
              if (!a.tags || a.tags.length === 0) return false;
              return a.tags.some((t) => t.name === this.selectedTag);
            });
          }

          // 프로젝트 필터 (클라이언트)
          if (this.filterProjectId !== null) {
            if (this.filterProjectId === "unclassified") {
              consensusAssignments = consensusAssignments.filter((a) => a.project_id === null);
            } else {
              consensusAssignments = consensusAssignments.filter((a) => a.project_id === this.filterProjectId);
            }
          }

          // 암종 필터 (클라이언트)
          if (this.filterCancerId !== null) {
            if (this.filterCancerId === "unclassified") {
              consensusAssignments = consensusAssignments.filter((a) => a.cancer_type_id === null);
            } else {
              consensusAssignments = consensusAssignments.filter((a) => a.cancer_type_id === this.filterCancerId);
            }
          }

          // 정렬 (클라이언트)
          consensusAssignments.sort((a, b) => {
            let aValue = this.getValue(a, this.sortColumn);
            let bValue = this.getValue(b, this.sortColumn);
            if (aValue < bValue) return this.sortDirection === "up" ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === "up" ? 1 : -1;
            return 0;
          });

          // 페이지네이션 (클라이언트)
          this.total = consensusAssignments.length;
          this.totalPages = Math.ceil(this.total / this.perPage) || 1;
          const start = (this.current - 1) * this.perPage;
          const end = start + this.perPage;
          this.assignments = consensusAssignments.slice(start, end);

          // 태그 목록 수집
          const tagCount = {};
          consensusRes.data.forEach((c) => {
            if (c.tags) {
              c.tags.forEach((tag) => {
                tagCount[tag.name] = (tagCount[tag.name] || 0) + 1;
              });
            }
          });
          this.allTags = Object.entries(tagCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        } else if (this.selectedMode === "all") {
          // 일반 과제 + Consensus 과제 모두 로드

          // 1. 일반 과제 로드 (서버 사이드 필터링)
          const regularParams = {
            page: 1,
            limit: 9999,
            search: this.searchQuery || "",
            mode: "all",
            tag: this.selectedTag,
            status: "all",
            sortBy: this.sortColumn === "CreationDate" ? "createdAt" : this.sortColumn,
            sortDir: this.sortDirection,
            projectId: this.filterProjectId,
            cancerId: this.filterCancerId,
          };

          const regularRes = await this.$axios.get("/api/assignments/paginated", { headers, params: regularParams });
          let regularAssignments = regularRes.data.data.map((a) => ({
            ...a,
            mode: a.assignmentMode || "BBox",
            tags: a.tags || [],
            isConsensus: false,
          }));

          // 2. Consensus 과제 로드
          const consensusRes = await this.$axios.get("/api/consensus", { headers });
          let consensusAssignments = consensusRes.data.map((c) => ({
            id: `C${c.id}`,
            consensusId: c.id,
            title: c.title,
            mode: "Consensus",
            CreationDate: c.creation_date,
            dueDate: c.deadline,
            status: this.getConsensusStatus(c),
            completed: c.responded_fp || 0,
            total: c.total_fp || 0,
            tags: c.tags || [],
            isConsensus: true,
            project_id: c.project_id,
            cancer_type_id: c.cancer_type_id,
          }));

          // 3. Consensus 필터 적용 (클라이언트 사이드)
          if (this.filterProjectId !== null) {
            if (this.filterProjectId === "unclassified") {
              consensusAssignments = consensusAssignments.filter((a) => a.project_id === null);
            } else {
              consensusAssignments = consensusAssignments.filter((a) => a.project_id === this.filterProjectId);
            }
          }

          if (this.filterCancerId !== null) {
            if (this.filterCancerId === "unclassified") {
              consensusAssignments = consensusAssignments.filter((a) => a.cancer_type_id === null);
            } else {
              consensusAssignments = consensusAssignments.filter((a) => a.cancer_type_id === this.filterCancerId);
            }
          }

          if (this.searchQuery) {
            consensusAssignments = consensusAssignments.filter((a) =>
              a.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
            );
          }

          if (this.selectedTag !== "all") {
            consensusAssignments = consensusAssignments.filter((a) => {
              if (!a.tags || a.tags.length === 0) return false;
              return a.tags.some((t) => t.name === this.selectedTag);
            });
          }

          // 4. 합치기
          const allAssignments = [...regularAssignments, ...consensusAssignments];

          // 5. 정렬
          allAssignments.sort((a, b) => {
            let aValue = this.getValue(a, this.sortColumn);
            let bValue = this.getValue(b, this.sortColumn);
            if (aValue < bValue) return this.sortDirection === "up" ? -1 : 1;
            if (aValue > bValue) return this.sortDirection === "up" ? 1 : -1;
            return 0;
          });

          // 6. 페이지네이션
          this.total = allAssignments.length;
          this.totalPages = Math.ceil(this.total / this.perPage) || 1;
          const start = (this.current - 1) * this.perPage;
          const end = start + this.perPage;
          this.assignments = allAssignments.slice(start, end);

          // 7. 태그 목록 수집
          const tagCount = {};
          [...regularRes.data.data, ...consensusRes.data].forEach((item) => {
            if (item.tags) {
              item.tags.forEach((tag) => {
                const tagName = tag.name || tag;
                tagCount[tagName] = (tagCount[tagName] || 0) + 1;
              });
            }
          });
          this.allTags = Object.entries(tagCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        } else {
          // 특정 모드 (BBox, Segment, TextBox) 서버 페이지네이션
          const params = {
            page: this.current,
            limit: this.perPage,
            search: this.searchQuery || "",
            mode: this.selectedMode,
            tag: this.selectedTag,
            status: "all",
            sortBy: this.sortColumn === "CreationDate" ? "createdAt" : this.sortColumn,
            sortDir: this.sortDirection,
            projectId: this.filterProjectId,
            cancerId: this.filterCancerId,
          };

          const response = await this.$axios.get("/api/assignments/paginated", { headers, params });
          const { data, pagination, allTags } = response.data;

          // 데이터 변환
          this.assignments = data.map((a) => ({
            ...a,
            mode: a.assignmentMode || "BBox",
            tags: a.tags || [],
            isConsensus: false,
          }));

          this.total = pagination.total;
          this.totalPages = pagination.totalPages;
          this.allTags = allTags || [];
        }
      } catch (error) {
        console.error("과제 목록 로딩 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },
    // 합의 과제 상태 계산
    getConsensusStatus(consensus) {
      const responded = consensus.responded_fp || 0;
      const total = consensus.total_fp || 0;
      if (total === 0) return "대기";
      if (responded === 0) return "대기";
      if (responded >= total) return "완료";
      return "진행중";
    },

    // 과제가 열렸는지 확인
    isAssignmentOpened(assignment) {
      const id = assignment.isConsensus ? `C${assignment.consensusId}` : String(assignment.id);
      return this.openedAssignments.includes(id);
    },

    // 새 탭으로 평가 수행 열기
    redirect(assignment) {
      const route = assignment.isConsensus
        ? { name: "consensusDetail", params: { id: assignment.consensusId } }
        : { name: "assignmentDetail", params: { id: assignment.id } };

      // 열린 과제로 추가
      const id = assignment.isConsensus ? `C${assignment.consensusId}` : String(assignment.id);
      this.$store.commit("addOpenedAssignment", id);

      const url = this.$router.resolve(route).href;
      window.open(url, '_blank');
    },

    // 페이지 변경
    async changePage(pageNumber) {
      const newPage = Math.max(1, Math.min(pageNumber, this.totalPages));
      if (newPage !== this.current) {
        this.current = newPage;
        await this.loadPaginatedData();
      }
    },

    // 특정 키로 과제 목록 정렬
    async sortBy(columnKey) {
      if (this.sortColumn === columnKey) {
        this.sortDirection = this.sortDirection === "up" ? "down" : "up";
      } else {
        this.sortColumn = columnKey;
        this.sortDirection = columnKey === "id" ? "down" : "up";
      }
      // Vuex에 정렬 상태 저장
      this.$store.commit("setAssignmentSortColumn", this.sortColumn);
      this.$store.commit("setAssignmentSortDirection", this.sortDirection);

      this.current = 1;
      await this.loadPaginatedData();
    },

    getValue(obj, key) {
      if (key === "progress") {
        return `${obj.completed || 0} / ${obj.total || 0}`;
      }
      if (key === "CreationDate" || key === "dueDate") {
        if (obj[key] && !isNaN(Date.parse(obj[key]))) {
          const date = new Date(obj[key]);
          return date.toISOString().split("T")[0];
        }
        return "N/A";
      }
      return obj[key] || "N/A";
    },

    async searchAssignment() {
      this.current = 1;
      this.$store.commit("setAssignmentSearchHistory", this.searchQuery);
      await this.loadPaginatedData();
    },

    async resetSearch() {
      this.searchQuery = "";
      this.current = 1;
      this.$store.commit("setAssignmentSearchHistory", "");
      await this.loadPaginatedData();
    },

    // Update search history in Vuex store
    updateAssignmentSearchHistory(history) {
      this.$store.commit("setAssignmentSearchHistory", history);
    },

    // Update current page in Vuex store
    updateAssignmentCurrentPage(page) {
      this.$store.commit("setAssignmentCurrentPage", page);
    },

    // 트리 필터 변경 처리
    onTreeFilterChange({ projectId, cancerId, mode, tag }) {
      this.filterProjectId = projectId;
      this.filterCancerId = cancerId;
      this.filterMode = mode;

      // 트리에서 모드를 선택한 경우 모드 필터도 동기화
      if (mode) {
        this.selectedMode = mode;
      }

      // 태그 초기화 (필터 초기화 시)
      if (tag !== undefined) {
        this.selectedTag = tag;
      }

      this.current = 1;
      this.loadPaginatedData();
    },

    // 태그 필터 변경 처리
    onTagFilterChange(tagName) {
      this.selectedTag = tagName;
      this.current = 1;
      this.loadPaginatedData();
    },
  },
};
</script>

<style scoped>
.assignment-view-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.assignment-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--light-gray);
  padding: 12px 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
}

.assignment-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--light-gray);
  transition: all 0.3s ease;
}

.search-input-focused {
  border-color: var(--blue);
  box-shadow: 0 0 4px var(--blue);
}

.assignment-search-input input {
  border: none;
  padding: 6px 8px;
  box-sizing: border-box;
  width: 120px;
  font-size: 13px;
}

.assignment-search:focus {
  outline: none;
}

.search-icon,
.reset-icon {
  padding: 8px 10px;
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
  flex: 1;
  overflow-x: auto;
}

.assignments-table-container table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

table thead tr {
  border-bottom: 1px solid var(--light-gray);
}

th {
  padding: 10px 8px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid var(--light-gray);
  font-size: 13px;
  white-space: nowrap;
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
  padding: 10px 8px;
  text-align: center;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

tbody > tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}

.assignment-id {
  width: 50px;
}

.assignment-mode {
  width: 80px;
  font-weight: 500;
}

.assignment-title {
  text-align: left;
}

.assignment-creation-date,
.assignment-due-date {
  width: 90px;
}

.assignment-status {
  width: 70px;
}

.assignment-progress {
  width: 80px;
}

.assignment-progress strong {
  font-size: 14px;
  color: var(--blue);
}

.pagination-nav {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}

.pagination {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
  align-items: center;
}

.pagination__item {
  display: inline;
}

.pagination__button,
.pagination__link {
  display: inline-block;
  margin: 0 4px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 50%;
  border: 1px solid var(--white);
  font-size: 13px;
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

/* 모드 필터 및 헤더 컨트롤 스타일 */
.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 합의 과제 행 스타일 */
.consensus-row {
  background-color: transparent;
}

.consensus-row:hover {
  background-color: #f5f5f5;
}

/* 열린 과제 표시 스타일 */
.opened-row {
  background-color: #e3f2fd;
}

.opened-row:hover {
  background-color: #bbdefb;
}

.opened-icon {
  color: #1976d2;
  margin-right: 6px;
  font-size: 11px;
}
</style>
