<!-- DashboardView.vue -->

<template>
  <div v-if="isExporting" class="exporting-message">
    {{ exportingMessage }}
  </div>
  <!-- 대시보드 헤더 -->
  <div class="dashboard-header">
    <div class="header-row">
      <h1 class="header-title">대시 보드</h1>

      <!-- 일괄 작업 영역 (선택된 항목이 있을 때 표시) -->
      <div v-if="selectedItems.length > 0" class="bulk-actions">
        <span class="selection-count">{{ selectedItems.length }}개 선택됨</span>
        <button class="bulk-action-btn" @click="selectAllPage" title="현재 페이지 전체 선택">
          <i class="fa-solid fa-check-double"></i>
          페이지 전체 선택 ({{ data.length }})
        </button>
        <button class="bulk-action-btn" @click="clearSelection" title="선택 해제">
          <i class="fa-solid fa-xmark"></i>
          선택 해제
        </button>
        <div class="bulk-action-dropdown">
          <button class="bulk-action-btn bulk-action-main" @click="toggleBulkMenu">
            <i class="fa-solid fa-ellipsis-vertical"></i>
            일괄 작업
            <i class="fa-solid fa-caret-down"></i>
          </button>
          <div v-if="showBulkMenu" class="bulk-menu">
            <div class="bulk-menu-item" @click="openBulkTagModal">
              <i class="fa-solid fa-tags"></i>
              태그 추가
            </div>
            <div class="bulk-menu-item" @click="showBulkAssignModal = true; showBulkMenu = false">
              <i class="fa-solid fa-users-gear"></i>
              평가자 변경
            </div>
            <div class="bulk-menu-item bulk-menu-item--danger" @click="confirmBulkDelete">
              <i class="fa-solid fa-trash"></i>
              삭제
            </div>
          </div>
        </div>
      </div>

      <!-- 필터 그룹 -->
      <div class="filter-group">
        <select v-model="selectedMode" class="mode-filter">
          <option value="all">전체 모드</option>
          <option value="TextBox">TextBox</option>
          <option value="BBox">BBox</option>
          <option value="Segment">Segment</option>
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
          <!-- 체크박스 열 -->
          <th class="checkbox-col">
            <input
              type="checkbox"
              :checked="isAllPageSelected"
              @change="toggleAllPage"
              title="현재 페이지 전체 선택/해제"
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
            'selected-row': isItemSelected(item),
          }"
          @click="goToDetail(item)"
        >
          <!-- 체크박스 열 -->
          <td class="checkbox-col">
            <input
              type="checkbox"
              :checked="isItemSelected(item)"
              @click.stop="toggleItemSelection(item)"
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

  <!-- 평가자 그룹 관리 섹션 (관리자만 표시) -->
  <div v-if="isAdmin" class="group-manager-section">
    <EvaluatorGroupManager />
  </div>

  <!-- 일괄 할당 모달 -->
  <BulkAssignModal
    v-if="showBulkAssignModal"
    :assignment-ids="selectedConsensusOnlyIds"
    :regular-assignment-ids="selectedRegularOnlyIds"
    @close="showBulkAssignModal = false"
    @assigned="onBulkAssigned"
  />

  <!-- 일괄 태그 추가 모달 -->
  <div v-if="showBulkTagModal" class="modal-overlay" @click.self="showBulkTagModal = false">
    <div class="bulk-tag-modal">
      <div class="modal-header">
        <h3>태그 일괄 추가</h3>
        <i class="fa-solid fa-xmark modal-close" @click="showBulkTagModal = false"></i>
      </div>
      <div class="modal-body">
        <p class="modal-info">{{ selectedItems.length }}개 과제에 태그를 추가합니다.</p>
        <div class="bulk-tag-input-wrapper">
          <input
            type="text"
            v-model="bulkTagInput"
            @input="searchBulkTags"
            @keydown.enter.prevent="addBulkTagFromInput"
            placeholder="추가할 태그 입력..."
            class="bulk-tag-input"
          />
          <div v-if="bulkTagSuggestions.length > 0" class="bulk-tag-suggestions">
            <div
              v-for="tag in bulkTagSuggestions"
              :key="tag.name"
              class="bulk-tag-suggestion-item"
              @click="addBulkTag(tag.name)"
            >
              #{{ tag.name }} <span class="tag-count">({{ tag.count }})</span>
            </div>
          </div>
        </div>
        <div class="selected-bulk-tags">
          <span v-for="tag in bulkTagsToAdd" :key="tag" class="bulk-tag-badge">
            #{{ tag }}
            <i class="fa-solid fa-xmark" @click="removeBulkTag(tag)"></i>
          </span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn--cancel" @click="showBulkTagModal = false">취소</button>
        <button class="modal-btn modal-btn--confirm" @click="applyBulkTags" :disabled="bulkTagsToAdd.length === 0">
          적용
        </button>
      </div>
    </div>
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
import BulkAssignModal from "@/components/BulkAssignModal.vue";
import EvaluatorGroupManager from "@/components/EvaluatorGroupManager.vue";

export default {
  name: "DashboardView",

  components: {
    BulkAssignModal,
    EvaluatorGroupManager,
  },

  data() {
    return {
      sortColumn: "id",
      sortDirection: "down", // 기본 내림차순
      data: [], // 현재 페이지 데이터
      current: this.$store.getters.getDashboardCurrentPage || 1,
      total: 0, // 서버에서 받은 총 개수
      totalPages: 1, // 총 페이지 수
      itemsPerPage: 15,
      searchQuery: this.$store.getters.getDashboardSearchHistory || "",
      isFocused: false,
      isExporting: false,
      isLoading: false, // 로딩 상태
      exportingMessage: "잠시만 기다려주세요. 데이터를 다운로드 중입니다.",
      sliderValue: 1,
      score_value: 50,
      selectedMode: "all", // all, TextBox, BBox, Consensus, Segment
      selectedTag: "all", // 태그 필터
      tagFilterInput: "", // 태그 필터 검색어
      showTagSuggestions: false,
      allTags: [], // 서버에서 받은 태그 목록
      // 일괄 작업 관련
      selectedItems: [],
      showBulkMenu: false,
      showBulkAssignModal: false,
      showBulkTagModal: false,
      bulkTagInput: "",
      bulkTagSuggestions: [],
      bulkTagsToAdd: [],
    };
  },

  computed: {
    // 관리자 여부
    isAdmin() {
      const user = this.$store.getters.getUser;
      return user && user.role === "admin";
    },
    // 현재 페이지의 모든 과제가 선택되었는지
    isAllPageSelected() {
      if (this.data.length === 0) return false;
      return this.data.every((item) => this.isItemSelected(item));
    },
    // 선택된 항목 중 Consensus가 있는지
    hasSelectedConsensus() {
      return this.selectedItems.some((item) => item.isConsensus);
    },
    // 선택된 Consensus 과제의 ID만 추출
    selectedConsensusOnlyIds() {
      return this.selectedItems
        .filter((item) => item.isConsensus)
        .map((item) => item.consensusId);
    },
    // 선택된 일반 과제의 ID만 추출
    selectedRegularOnlyIds() {
      return this.selectedItems
        .filter((item) => !item.isConsensus)
        .map((item) => item.id);
    },
    // 태그 필터 자동완성 제안
    filteredTagSuggestions() {
      if (!this.tagFilterInput) {
        return this.allTags.slice(0, 10);
      }
      const query = this.tagFilterInput.toLowerCase().replace(/^#/, "");
      return this.allTags
        .filter((tag) => tag.name.toLowerCase().includes(query))
        .slice(0, 10);
    },
    // 서버 페이지네이션 - 현재 페이지 데이터 그대로 사용
    paginatedData() {
      return this.data;
    },
    // 서버에서 받은 데이터를 필터된 데이터로 사용 (일괄 선택용)
    filteredData() {
      return this.data;
    },
    filteredLastPage() {
      return this.totalPages || 1;
    },
    visiblePages() {
      const startPage = Math.max(1, Math.min(this.current - 2, this.totalPages - 4));
      const endPage = Math.min(this.totalPages, startPage + 4);
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

    // 모드 필터 변경 시 데이터 다시 로드
    selectedMode() {
      this.current = 1;
      this.loadPaginatedData();
    },

    // 태그 필터 변경 시 데이터 다시 로드
    selectedTag() {
      this.current = 1;
      this.loadPaginatedData();
    },
  },

  async mounted() {
    // 초기 데이터 로드
    await this.loadPaginatedData();
  },

  methods: {
    // 서버 페이지네이션 데이터 로드
    async loadPaginatedData() {
      this.isLoading = true;
      const headers = {
        Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
      };

      try {
        // Consensus 모드일 경우 별도 처리
        if (this.selectedMode === "Consensus") {
          const consensusRes = await this.$axios.get("/api/consensus", { headers });
          let consensusData = consensusRes.data.map((c) => ({
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

          // 검색어 필터 (클라이언트)
          if (this.searchQuery) {
            consensusData = consensusData.filter((item) =>
              item.title.toLowerCase().startsWith(this.searchQuery.toLowerCase())
            );
          }

          // 태그 필터 (클라이언트)
          if (this.selectedTag !== "all") {
            consensusData = consensusData.filter((item) => {
              if (!item.tags || item.tags.length === 0) return false;
              return item.tags.some((t) => t.name === this.selectedTag);
            });
          }

          // 정렬 (클라이언트)
          consensusData.sort((a, b) => {
            let aValue = a[this.sortColumn];
            let bValue = b[this.sortColumn];
            if (typeof aValue === "string" && aValue.includes("%")) {
              aValue = parseFloat(aValue.replace("%", ""));
            }
            if (typeof bValue === "string" && bValue.includes("%")) {
              bValue = parseFloat(bValue.replace("%", ""));
            }
            let comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            return this.sortDirection === "up" ? comparison : -comparison;
          });

          // 페이지네이션 (클라이언트)
          this.total = consensusData.length;
          this.totalPages = Math.ceil(this.total / this.itemsPerPage) || 1;
          const start = (this.current - 1) * this.itemsPerPage;
          const end = start + this.itemsPerPage;
          this.data = consensusData.slice(start, end);

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
        } else {
          // 일반 대시보드 서버 페이지네이션
          const params = {
            page: this.current,
            limit: this.itemsPerPage,
            search: this.searchQuery || "",
            mode: this.selectedMode,
            tag: this.selectedTag,
            sortBy: this.sortColumn,
            sortDir: this.sortDirection,
          };

          const response = await this.$axios.get("/api/dashboard/paginated", { headers, params });
          const { data, pagination, allTags } = response.data;

          // 데이터 변환
          this.data = data.map((item) => ({
            ...item,
            mode: item.assignmentMode || "BBox",
            tags: item.tags || [],
            isConsensus: false,
          }));

          this.total = pagination.total;
          this.totalPages = pagination.totalPages;
          this.allTags = allTags || [];
        }
      } catch (error) {
        console.error("대시보드 데이터 로딩 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },

    // 다른 페이지로 리다이렉트
    goToDetail(item) {
      if (item.isConsensus) {
        this.$router.push({ name: "consensusDetail", params: { id: item.consensusId } });
      } else {
        this.$router.push({ name: "dashboardDetail", params: { id: item.id } });
      }
    },

    // 페이지 변경
    async changePage(pageNumber) {
      if (pageNumber >= 1 && pageNumber <= this.totalPages && pageNumber !== this.current) {
        this.current = pageNumber;
        await this.loadPaginatedData();
      }
    },

    formatPercentage(value) {
      if (typeof value === "string") {
        value = parseFloat(value.replace("%", ""));
      }
      return Math.round(value) + "%";
    },

    async sortBy(columnKey) {
      if (this.sortColumn === columnKey) {
        this.sortDirection = this.sortDirection === "up" ? "down" : "up";
      } else {
        this.sortColumn = columnKey;
        this.sortDirection = "down"; // 새 컬럼은 내림차순 시작
      }

      this.current = 1;
      await this.loadPaginatedData();
    },

    changeSliderValue(event) {
      this.sliderValue = event.target.value;
    },

    async searchDashboard() {
      this.current = 1;
      this.$store.commit("setDashboardSearchHistory", this.searchQuery);
      await this.loadPaginatedData();
    },

    async resetSearch() {
      this.searchQuery = "";
      this.current = 1;
      this.$store.commit("setDashboardSearchHistory", "");
      await this.loadPaginatedData();
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

    // 아이템이 선택되었는지 확인
    isItemSelected(item) {
      return this.selectedItems.some(
        (selected) => selected.id === item.id && selected.isConsensus === item.isConsensus
      );
    },

    // 개별 아이템 선택 토글
    toggleItemSelection(item) {
      const index = this.selectedItems.findIndex(
        (selected) => selected.id === item.id && selected.isConsensus === item.isConsensus
      );
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push({
          id: item.id,
          isConsensus: item.isConsensus,
          consensusId: item.consensusId,
        });
      }
    },

    // 현재 페이지 전체 선택/해제
    toggleAllPage() {
      const allSelected = this.isAllPageSelected;
      if (allSelected) {
        // 현재 페이지 아이템들 해제
        this.data.forEach((item) => {
          const index = this.selectedItems.findIndex(
            (selected) => selected.id === item.id && selected.isConsensus === item.isConsensus
          );
          if (index > -1) {
            this.selectedItems.splice(index, 1);
          }
        });
      } else {
        // 현재 페이지 아이템들 선택
        this.data.forEach((item) => {
          if (!this.isItemSelected(item)) {
            this.selectedItems.push({
              id: item.id,
              isConsensus: item.isConsensus,
              consensusId: item.consensusId,
            });
          }
        });
      }
    },

    // 현재 페이지 전체 선택
    selectAllPage() {
      this.data.forEach((item) => {
        if (!this.isItemSelected(item)) {
          this.selectedItems.push({
            id: item.id,
            isConsensus: item.isConsensus,
            consensusId: item.consensusId,
          });
        }
      });
    },

    // 선택 해제
    clearSelection() {
      this.selectedItems = [];
    },

    // 일괄 작업 메뉴 토글
    toggleBulkMenu() {
      this.showBulkMenu = !this.showBulkMenu;
    },

    // 일괄 할당 완료 후 처리
    onBulkAssigned() {
      this.showBulkAssignModal = false;
      this.selectedItems = [];
      this.showBulkMenu = false;
      // 데이터 새로고침
      this.$router.go(0);
    },

    // 일괄 태그 추가 모달 열기
    openBulkTagModal() {
      this.showBulkTagModal = true;
      this.showBulkMenu = false;
      this.bulkTagInput = "";
      this.bulkTagSuggestions = [];
      this.bulkTagsToAdd = [];
    },

    // 일괄 태그 검색
    searchBulkTags() {
      if (!this.bulkTagInput) {
        this.bulkTagSuggestions = this.allTags.slice(0, 10);
        return;
      }
      const query = this.bulkTagInput.toLowerCase().replace(/^#/, "");
      this.bulkTagSuggestions = this.allTags
        .filter((tag) => tag.name.toLowerCase().includes(query))
        .slice(0, 10);
    },

    // 일괄 태그 추가
    addBulkTag(tagName) {
      const normalizedTag = tagName.toLowerCase().replace(/^#/, "").trim();
      if (normalizedTag && !this.bulkTagsToAdd.includes(normalizedTag)) {
        this.bulkTagsToAdd.push(normalizedTag);
      }
      this.bulkTagInput = "";
      this.bulkTagSuggestions = [];
    },

    // 입력에서 태그 추가
    addBulkTagFromInput() {
      if (this.bulkTagInput.trim()) {
        this.addBulkTag(this.bulkTagInput);
      }
    },

    // 일괄 태그 제거
    removeBulkTag(tagName) {
      const index = this.bulkTagsToAdd.indexOf(tagName);
      if (index > -1) {
        this.bulkTagsToAdd.splice(index, 1);
      }
    },

    // 일괄 태그 적용
    async applyBulkTags() {
      if (this.bulkTagsToAdd.length === 0) return;

      try {
        this.isExporting = true;
        this.exportingMessage = "태그를 추가하는 중입니다...";

        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        // 일반 과제와 Consensus 과제 분리
        const regularAssignments = this.selectedItems.filter((item) => !item.isConsensus);
        const consensusAssignments = this.selectedItems.filter((item) => item.isConsensus);

        // 일반 과제에 태그 추가
        for (const item of regularAssignments) {
          await this.$axios.post(
            `/api/tags/assignment/${item.id}/add`,
            { tags: this.bulkTagsToAdd },
            { headers }
          );
        }

        // Consensus 과제에 태그 추가
        for (const item of consensusAssignments) {
          await this.$axios.post(
            `/api/tags/consensus/${item.consensusId}/add`,
            { tags: this.bulkTagsToAdd },
            { headers }
          );
        }

        alert(`${this.selectedItems.length}개 과제에 태그가 추가되었습니다.`);
        this.showBulkTagModal = false;
        this.selectedItems = [];
        this.$router.go(0);
      } catch (error) {
        console.error("태그 추가 오류:", error);
        alert("태그 추가 중 오류가 발생했습니다.");
      } finally {
        this.isExporting = false;
        this.exportingMessage = "잠시만 기다려주세요. 데이터를 다운로드 중입니다.";
      }
    },

    // 일괄 삭제 확인
    async confirmBulkDelete() {
      this.showBulkMenu = false;

      const regularCount = this.selectedItems.filter((item) => !item.isConsensus).length;
      const consensusCount = this.selectedItems.filter((item) => item.isConsensus).length;

      let message = `정말 ${this.selectedItems.length}개 과제를 삭제하시겠습니까?\n`;
      if (regularCount > 0) message += `- 일반 과제: ${regularCount}개\n`;
      if (consensusCount > 0) message += `- Consensus 과제: ${consensusCount}개\n`;
      message += "\n이 작업은 되돌릴 수 없습니다.";

      if (!confirm(message)) return;

      try {
        this.isExporting = true;
        this.exportingMessage = "과제를 삭제하는 중입니다...";

        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        // 일반 과제와 Consensus 과제 분리
        const regularAssignments = this.selectedItems.filter((item) => !item.isConsensus);
        const consensusAssignments = this.selectedItems.filter((item) => item.isConsensus);

        // 일반 과제 삭제
        for (const item of regularAssignments) {
          await this.$axios.delete(`/api/assignments/${item.id}`, { headers });
        }

        // Consensus 과제 삭제
        for (const item of consensusAssignments) {
          await this.$axios.delete(`/api/consensus/${item.consensusId}`, { headers });
        }

        alert(`${this.selectedItems.length}개 과제가 삭제되었습니다.`);
        this.selectedItems = [];
        this.$router.go(0);
      } catch (error) {
        console.error("삭제 오류:", error);
        alert("삭제 중 오류가 발생했습니다.");
      } finally {
        this.isExporting = false;
        this.exportingMessage = "잠시만 기다려주세요. 데이터를 다운로드 중입니다.";
      }
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
      // current = 1과 loadPaginatedData는 watch에서 처리됨
    },

    // 태그 필터 초기화
    clearTagFilter() {
      this.selectedTag = "all";
      this.tagFilterInput = "";
      // current = 1과 loadPaginatedData는 watch에서 처리됨
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

/* 일괄 작업 영역 */
.bulk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background-color: #e3f2fd;
  border-radius: 6px;
}

.selection-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--blue);
  white-space: nowrap;
}

.bulk-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  background-color: white;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}

.bulk-action-btn:hover {
  background-color: #f5f5f5;
}

.bulk-action-btn.bulk-action-main {
  background-color: var(--blue);
  color: white;
  border-color: var(--blue);
}

.bulk-action-btn.bulk-action-main:hover {
  background-color: var(--blue-hover);
}

.bulk-action-dropdown {
  position: relative;
}

.bulk-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid var(--light-gray);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 200;
  min-width: 160px;
  margin-top: 4px;
}

.bulk-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  cursor: pointer;
}

.bulk-menu-item:hover {
  background-color: #f5f5f5;
}

.bulk-menu-item:first-child {
  border-radius: 6px 6px 0 0;
}

.bulk-menu-item:last-child {
  border-radius: 0 0 6px 6px;
}

.bulk-menu-item--danger {
  color: #dc3545;
}

.bulk-menu-item--danger:hover {
  background-color: #fff5f5;
}

/* 일괄 태그 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.bulk-tag-modal {
  background: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--light-gray);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.modal-close {
  cursor: pointer;
  color: #999;
  font-size: 16px;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.modal-info {
  margin: 0 0 16px;
  font-size: 13px;
  color: #666;
}

.bulk-tag-input-wrapper {
  position: relative;
}

.bulk-tag-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.bulk-tag-input:focus {
  outline: none;
  border-color: var(--blue);
}

.bulk-tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  max-height: 150px;
  overflow-y: auto;
  margin-top: 2px;
}

.bulk-tag-suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.bulk-tag-suggestion-item:hover {
  background-color: #f5f5f5;
}

.selected-bulk-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  min-height: 30px;
}

.bulk-tag-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: var(--blue);
  color: white;
  border-radius: 4px;
  font-size: 12px;
}

.bulk-tag-badge i {
  cursor: pointer;
  opacity: 0.8;
}

.bulk-tag-badge i:hover {
  opacity: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--light-gray);
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}

.modal-btn--cancel {
  background-color: white;
  border-color: var(--light-gray);
  color: #333;
}

.modal-btn--cancel:hover {
  background-color: #f5f5f5;
}

.modal-btn--confirm {
  background-color: var(--blue);
  color: white;
}

.modal-btn--confirm:hover:not(:disabled) {
  background-color: var(--blue-hover);
}

.modal-btn--confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 평가자 그룹 관리 섹션 */
.group-manager-section {
  margin: 20px 16px;
}
</style>
