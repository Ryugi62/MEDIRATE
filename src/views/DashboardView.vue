<!-- DashboardView.vue -->

<template>
  <div v-if="isExporting" class="exporting-message">
    {{ exportingMessage }}
  </div>
  <!-- 대시보드 헤더 -->
  <div class="dashboard-header">
    <div class="header-row">
      <h1 class="header-title">대시 보드</h1>

      <!-- 일괄 할당 버튼 (Consensus 선택 시 표시) -->
      <button
        v-if="selectedConsensusIds.length > 0"
        class="bulk-assign-button"
        @click="showBulkAssignModal = true"
      >
        <i class="fa-solid fa-users-gear"></i>
        선택된 과제 할당자 변경 ({{ selectedConsensusIds.length }})
      </button>

      <!-- 필터 그룹 -->
      <div class="filter-group">
        <select v-model="selectedMode" class="mode-filter" @change="current = 1">
          <option value="all">전체 모드</option>
          <option value="TextBox">TextBox</option>
          <option value="BBox">BBox</option>
          <option value="Consensus">Consensus (합의)</option>
        </select>

        <!-- 태그 필터 (자동완성 input) -->
        <div class="tag-filter-wrapper">
          <div class="tag-filter-input-container">
            <span v-if="selectedTag !== 'all'" class="selected-tag-badge">
              #{{ selectedTag }}
              <i class="fa-solid fa-xmark" @click="clearTagFilter"></i>
            </span>
            <input
              v-else
              type="text"
              v-model="tagFilterInput"
              class="tag-filter-input"
              placeholder="태그 검색..."
              @focus="showTagSuggestions = true"
              @blur="hideTagSuggestions"
              @input="onTagFilterInput"
            />
          </div>
          <div v-if="showTagSuggestions && filteredTagSuggestions.length > 0" class="tag-suggestions-dropdown">
            <div
              v-for="tag in filteredTagSuggestions"
              :key="tag.name"
              class="tag-suggestion-item"
              @mousedown.prevent="selectTagFilter(tag.name)"
            >
              #{{ tag.name }} <span class="tag-count">({{ tag.count }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 슬라이더 그룹 -->
      <div class="slider-group">
        <div class="slider-item">
          <span class="slider-label">{{ score_value }}%</span>
          <input
            type="range"
            v-model="score_value"
            min="0"
            max="100"
          />
        </div>
        <div class="slider-item">
          <span class="slider-label">{{ sliderValue }}인 일치</span>
          <input
            type="range"
            min="1"
            max="5"
            :value="sliderValue"
            @input="changeSliderValue"
          />
        </div>
      </div>

      <!-- 검색 그룹 -->
      <div
        class="search-group"
        :class="{ 'search-input-focused': isFocused }"
      >
        <i
          class="fa-solid fa-rotate-left reset-button"
          @click="resetSearch"
          title="검색 초기화"
        ></i>
        <input
          class="search-input"
          type="text"
          v-model="searchQuery"
          placeholder="검색"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keypress.enter="searchDashboard"
        />
        <i
          class="fa-solid fa-magnifying-glass search-button"
          @click="searchDashboard"
        ></i>
      </div>

      <!-- 버튼 그룹 -->
      <div class="button-group">
        <button class="icon-button metrics-button" @click="showMetrics" title="Metrics 보기">
          <i class="fa-solid fa-chart-bar"></i>
        </button>
        <button class="icon-button download-image-button" @click="downloadSearchedItemsAssets" title="이미지 다운로드">
          <i class="fa-solid fa-images"></i>
        </button>
        <button class="icon-button download-button" @click="downloadSearchedItems" title="엑셀 다운로드">
          <i class="fa-solid fa-file-excel"></i>
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
          <!-- 체크박스 열 (Consensus 전용) -->
          <th class="checkbox-col" v-if="showConsensusCheckbox">
            <input
              type="checkbox"
              :checked="isAllConsensusSelected"
              @change="toggleAllConsensus"
              title="전체 선택/해제"
            />
          </th>
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
            'selected-row': item.isConsensus && selectedConsensusIds.includes(item.consensusId),
          }"
          @click="goToDetail(item)"
        >
          <!-- 체크박스 열 (Consensus 전용) -->
          <td class="checkbox-col" v-if="showConsensusCheckbox">
            <input
              v-if="item.isConsensus"
              type="checkbox"
              :checked="selectedConsensusIds.includes(item.consensusId)"
              @click.stop="toggleConsensusSelection(item.consensusId)"
            />
          </td>
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

  <!-- 일괄 할당 모달 -->
  <BulkAssignModal
    v-if="showBulkAssignModal"
    :assignment-ids="selectedConsensusIds"
    @close="showBulkAssignModal = false"
    @assigned="onBulkAssigned"
  />

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
import BulkAssignModal from "@/components/BulkAssignModal.vue";

export default {
  name: "DashboardView",

  components: {
    BulkAssignModal,
  },

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
      selectedTag: "all", // 태그 필터
      tagFilterInput: "", // 태그 필터 검색어
      showTagSuggestions: false, // 태그 제안 드롭다운 표시 여부
      // 모든 태그 목록 (사용 빈도순)
      allTags: [],
      // 일괄 할당 관련
      selectedConsensusIds: [],
      showBulkAssignModal: false,
    };
  },

  computed: {
    // 체크박스 표시 여부 (Consensus 모드이거나 전체 모드일 때)
    showConsensusCheckbox() {
      return this.selectedMode === "all" || this.selectedMode === "Consensus";
    },
    // 현재 페이지의 모든 Consensus 과제가 선택되었는지
    isAllConsensusSelected() {
      const consensusItems = this.paginatedData.filter((item) => item.isConsensus);
      if (consensusItems.length === 0) return false;
      return consensusItems.every((item) =>
        this.selectedConsensusIds.includes(item.consensusId)
      );
    },
    // 태그 필터 자동완성 제안
    filteredTagSuggestions() {
      if (!this.tagFilterInput) {
        return this.allTags.slice(0, 10); // 입력 없으면 상위 10개
      }
      const query = this.tagFilterInput.toLowerCase().replace(/^#/, "");
      return this.allTags
        .filter((tag) => tag.name.toLowerCase().includes(query))
        .slice(0, 10);
    },
    // 모드, 태그 필터가 적용된 데이터
    filteredData() {
      let result = this.data;

      // 모드 필터
      if (this.selectedMode !== "all") {
        result = result.filter((item) => item.mode === this.selectedMode);
      }

      // 태그 필터
      if (this.selectedTag !== "all") {
        result = result.filter((item) => {
          if (!item.tags || item.tags.length === 0) return false;
          return item.tags.some((t) => t.name === this.selectedTag);
        });
      }

      return result;
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
        tags: item.tags || [],
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
        tags: c.tags || [],
        isConsensus: true,
      }));

      // 두 목록 합치기
      this.originalData = [...regularData, ...consensusData];

      // 모든 태그 수집 (사용 횟수 포함)
      const tagCount = {};
      this.originalData.forEach((item) => {
        if (item.tags) {
          item.tags.forEach((tag) => {
            tagCount[tag.name] = (tagCount[tag.name] || 0) + 1;
          });
        }
      });
      this.allTags = Object.entries(tagCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
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

    // Consensus 과제 선택 토글
    toggleConsensusSelection(consensusId) {
      const index = this.selectedConsensusIds.indexOf(consensusId);
      if (index > -1) {
        this.selectedConsensusIds.splice(index, 1);
      } else {
        this.selectedConsensusIds.push(consensusId);
      }
    },

    // 현재 페이지의 모든 Consensus 과제 선택/해제
    toggleAllConsensus() {
      const consensusItems = this.paginatedData.filter((item) => item.isConsensus);
      const allSelected = this.isAllConsensusSelected;

      if (allSelected) {
        // 모두 해제
        consensusItems.forEach((item) => {
          const index = this.selectedConsensusIds.indexOf(item.consensusId);
          if (index > -1) {
            this.selectedConsensusIds.splice(index, 1);
          }
        });
      } else {
        // 모두 선택
        consensusItems.forEach((item) => {
          if (!this.selectedConsensusIds.includes(item.consensusId)) {
            this.selectedConsensusIds.push(item.consensusId);
          }
        });
      }
    },

    // 일괄 할당 완료 후 처리
    onBulkAssigned() {
      this.showBulkAssignModal = false;
      this.selectedConsensusIds = [];
      // 데이터 새로고침
      this.$router.go(0);
    },

    // 태그 필터 입력 처리
    onTagFilterInput() {
      this.showTagSuggestions = true;
    },

    // 태그 필터 선택
    selectTagFilter(tagName) {
      this.selectedTag = tagName;
      this.tagFilterInput = "";
      this.showTagSuggestions = false;
      this.current = 1;
    },

    // 태그 필터 초기화
    clearTagFilter() {
      this.selectedTag = "all";
      this.tagFilterInput = "";
      this.current = 1;
    },

    // 태그 제안 드롭다운 숨기기 (딜레이 적용)
    hideTagSuggestions() {
      setTimeout(() => {
        this.showTagSuggestions = false;
      }, 150);
    },
  },
};
</script>

<style scoped>
/* 전체 페이지 좌우 스크롤 방지 */
:deep(.dashboard-view) {
  overflow-x: hidden;
}

.dashboard-header {
  border-bottom: 1px solid var(--light-gray);
  padding: 12px 16px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
}

/* 필터 그룹 */
.filter-group {
  display: flex;
  gap: 8px;
}

.mode-filter {
  padding: 6px 10px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background-color: white;
  min-width: 100px;
}

.mode-filter:focus {
  outline: none;
  border-color: var(--blue);
}

/* 태그 필터 (자동완성) */
.tag-filter-wrapper {
  position: relative;
}

.tag-filter-input-container {
  display: flex;
  align-items: center;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  background-color: white;
  min-width: 140px;
  height: 32px;
}

.tag-filter-input {
  border: none;
  outline: none;
  padding: 6px 10px;
  font-size: 13px;
  width: 100%;
  background: transparent;
}

.tag-filter-input::placeholder {
  color: #999;
}

.selected-tag-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin: 2px 4px;
  background-color: var(--blue);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.selected-tag-badge i {
  cursor: pointer;
  opacity: 0.8;
}

.selected-tag-badge i:hover {
  opacity: 1;
}

.tag-suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
}

.tag-suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.tag-suggestion-item:hover {
  background-color: #f5f5f5;
}

.tag-suggestion-item .tag-count {
  color: #999;
  font-size: 11px;
}

/* 슬라이더 그룹 */
.slider-group {
  display: flex;
  gap: 12px;
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.slider-label {
  font-size: 12px;
  white-space: nowrap;
  min-width: 55px;
  text-align: right;
}

.slider-item input[type="range"] {
  width: 80px;
}

/* 검색 그룹 */
.search-group {
  display: flex;
  align-items: center;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  transition: all 0.3s ease;
  overflow: hidden;
}

.search-group.search-input-focused {
  border-color: var(--blue);
  box-shadow: 0 0 4px var(--blue);
}

.search-group .search-input {
  border: none;
  padding: 6px 8px;
  width: 120px;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
}

.search-button,
.reset-button {
  padding: 8px 10px;
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

/* 버튼 그룹 */
.button-group {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.icon-button {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
}

.icon-button i {
  font-size: 14px;
}

.metrics-button {
  background-color: var(--blue);
  color: white;
}

.metrics-button:hover {
  background-color: var(--blue-hover);
}

.download-button {
  background-color: var(--green);
  color: white;
}

.download-button:hover {
  background-color: var(--green-hover);
}

.download-button:active {
  background-color: var(--green-active);
}

.download-image-button {
  color: white;
  background-color: #333;
  border-color: #333;
}

.download-image-button:hover {
  background-color: #555;
}

.download-image-button:active {
  background-color: #1a1a1a;
}

/* 테이블 박스 */
.table-box {
  min-height: 676px;
  overflow-x: auto;
}

table {
  width: 100%;
  text-align: center;
  border-collapse: collapse;
  table-layout: fixed;
}

th {
  padding: 10px 8px;
  text-align: center;
  font-weight: bold;
  border-bottom: 1px solid var(--light-gray);
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
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
  padding: 10px 8px;
  text-align: center;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

td.id,
th:nth-child(1) {
  width: 50px;
}

td.assignment-mode,
th:nth-child(2) {
  width: 80px;
}

td.assignment-title {
  text-align: left;
  max-width: 300px;
}

td.created-at,
td.end-at,
th:nth-child(4),
th:nth-child(5) {
  width: 90px;
}

td.evaluator,
th:nth-child(6) {
  width: 70px;
}

td.answer-rate,
td.unanswered-rate,
th:nth-child(7),
th:nth-child(8) {
  width: 80px;
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

td.assignment-mode {
  width: 90px;
  font-weight: 500;
}

/* 합의 과제 행 스타일 */
.consensus-row {
  background-color: transparent;
}

.consensus-row:hover {
  background-color: #f5f5f5 !important;
}

/* 체크박스 열 스타일 */
.checkbox-col {
  width: 40px;
  text-align: center;
}

.checkbox-col input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--blue);
}

/* 선택된 행 스타일 */
.selected-row {
  background-color: #e3f2fd !important;
}

.selected-row:hover {
  background-color: #bbdefb !important;
}

/* 일괄 할당 버튼 */
.bulk-assign-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background-color: var(--blue);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.bulk-assign-button:hover {
  background-color: var(--blue-hover);
}

.bulk-assign-button:active {
  background-color: var(--blue-active);
}

.bulk-assign-button i {
  font-size: 14px;
}
</style>
