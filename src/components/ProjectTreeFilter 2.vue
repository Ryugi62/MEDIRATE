<template>
  <div class="project-tree-filter" :class="{ collapsed: isCollapsed }">
    <div class="tree-header" @click="toggleCollapse">
      <i :class="['fas', isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down']"></i>
      <span>필터</span>
      <span v-if="hasActiveFilter" class="filter-badge">{{ activeFilterCount }}</span>
    </div>

    <div v-if="!isCollapsed" class="tree-content">
      <!-- 태그 필터 섹션 -->
      <div v-if="allTags && allTags.length > 0" class="tag-filter-section">
        <div class="section-header">
          <i class="fas fa-tags"></i>
          <span>태그</span>
        </div>
        <div class="tag-list">
          <div
            class="tag-item"
            :class="{ active: selectedTag === 'all' }"
            @click="selectTag('all')"
          >
            <span>전체</span>
          </div>
          <div
            v-for="tag in displayedTags"
            :key="tag.name"
            class="tag-item"
            :class="{ active: selectedTag === tag.name }"
            @click="selectTag(tag.name)"
          >
            <span>#{{ tag.name }}</span>
            <span class="tag-count">{{ tag.count }}</span>
          </div>
          <div v-if="allTags.length > 5 && !showAllTags" class="tag-item more-tags" @click="showAllTags = true">
            <span>+{{ allTags.length - 5 }}개 더보기</span>
          </div>
        </div>
      </div>

      <!-- 프로젝트 필터 섹션 -->
      <div class="section-header project-section-header">
        <i class="fas fa-folder-tree"></i>
        <span>프로젝트</span>
      </div>

      <div v-if="loading" class="tree-loading">
        <i class="fas fa-spinner fa-spin"></i> 로딩 중...
      </div>

      <div v-else-if="treeData.length === 0" class="tree-empty">
        프로젝트 데이터가 없습니다
      </div>

      <div v-else class="tree-list">
        <!-- 전체 선택 -->
        <div class="tree-item all-item" :class="{ active: !hasActiveFilter }" @click="clearFilter">
          <i class="fas fa-layer-group"></i>
          <span>전체</span>
          <span class="item-count">{{ totalCount }}</span>
        </div>

        <!-- 프로젝트 레벨 -->
        <div v-for="project in treeData" :key="project.key" class="tree-node project-node">
          <div
            class="tree-item project-item"
            :class="{ active: isProjectActive(project), expanded: expandedProjects[project.key] }"
            @click="toggleProject(project)"
          >
            <i
              class="expand-icon fas"
              :class="expandedProjects[project.key] ? 'fa-chevron-down' : 'fa-chevron-right'"
              @click.stop="toggleProjectExpand(project.key)"
            ></i>
            <i class="fas fa-folder"></i>
            <span class="item-name" :title="project.name">{{ project.name }}</span>
            <span class="item-count">{{ project.count }}</span>
          </div>

          <!-- 암종 레벨 -->
          <div v-if="expandedProjects[project.key]" class="children cancer-list">
            <div
              v-for="cancer in project.children"
              :key="cancer.key"
              class="tree-node cancer-node"
            >
              <div
                class="tree-item cancer-item"
                :class="{ active: isCancerActive(project, cancer), expanded: expandedCancers[`${project.key}_${cancer.key}`] }"
                @click="toggleCancer(project, cancer)"
              >
                <i
                  class="expand-icon fas"
                  :class="expandedCancers[`${project.key}_${cancer.key}`] ? 'fa-chevron-down' : 'fa-chevron-right'"
                  @click.stop="toggleCancerExpand(project.key, cancer.key)"
                ></i>
                <i class="fas fa-dna"></i>
                <span class="item-name">{{ cancer.name }}</span>
                <span class="item-count">{{ cancer.count }}</span>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- 필터 초기화 버튼 -->
      <div v-if="hasActiveFilter" class="tree-actions">
        <button class="clear-filter-btn" @click="clearFilter">
          <i class="fas fa-times"></i> 필터 초기화
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ProjectTreeFilter",

  props: {
    // 현재 선택된 필터
    selectedProject: {
      type: [Number, String],
      default: null,
    },
    selectedCancer: {
      type: [Number, String],
      default: null,
    },
    // 태그 관련
    selectedTag: {
      type: String,
      default: "all",
    },
    allTags: {
      type: Array,
      default: () => [],
    },
    // 사용자별 필터링 (AssignmentView에서 사용)
    forUser: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      isCollapsed: false,
      loading: false,
      treeData: [],
      expandedProjects: {},
      expandedCancers: {},
      showAllTags: false,
    };
  },

  computed: {
    hasActiveFilter() {
      return this.selectedProject !== null || this.selectedCancer !== null || this.selectedTag !== "all";
    },
    activeFilterCount() {
      let count = 0;
      if (this.selectedProject !== null) count++;
      if (this.selectedCancer !== null) count++;
      if (this.selectedTag !== "all") count++;
      return count;
    },
    totalCount() {
      return this.treeData.reduce((sum, p) => sum + p.count, 0);
    },
    displayedTags() {
      if (this.showAllTags) {
        return this.allTags;
      }
      return this.allTags.slice(0, 5);
    },
  },

  async mounted() {
    await this.loadTreeData();
  },

  methods: {
    async loadTreeData() {
      this.loading = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getUser.token}`,
        };
        const params = this.forUser ? { forUser: "true" } : {};
        const response = await this.$axios.get("/api/projects/tree", { headers, params });
        this.treeData = response.data;
      } catch (error) {
        console.error("트리 데이터 로딩 오류:", error);
      } finally {
        this.loading = false;
      }
    },

    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    },

    toggleProjectExpand(projectKey) {
      this.expandedProjects[projectKey] = !this.expandedProjects[projectKey];
    },

    toggleCancerExpand(projectKey, cancerKey) {
      const key = `${projectKey}_${cancerKey}`;
      this.expandedCancers[key] = !this.expandedCancers[key];
    },

    toggleProject(project) {
      // 프로젝트 선택 (id가 null이면 "unclassified"로 전달)
      const projectId = project.id === null ? "unclassified" : project.id;
      console.log("[ProjectTreeFilter] toggleProject:", projectId, project.name);
      this.$emit("filter-change", {
        projectId: projectId,
        projectName: project.name,
        cancerId: null,
        cancerName: null,
        mode: null,
      });
      // 확장도 함께
      this.expandedProjects[project.key] = true;
    },

    toggleCancer(project, cancer) {
      // 암종 선택 (id가 null이면 "unclassified"로 전달)
      const projectId = project.id === null ? "unclassified" : project.id;
      const cancerId = cancer.id === null ? "unclassified" : cancer.id;
      this.$emit("filter-change", {
        projectId: projectId,
        projectName: project.name,
        cancerId: cancerId,
        cancerName: cancer.name,
        mode: null,
      });
      // 확장도 함께
      const key = `${project.key}_${cancer.key}`;
      this.expandedCancers[key] = true;
    },

    clearFilter() {
      this.$emit("filter-change", {
        projectId: null,
        projectName: null,
        cancerId: null,
        cancerName: null,
        tag: "all",
      });
      this.showAllTags = false;
    },

    selectTag(tagName) {
      this.$emit("tag-change", tagName);
    },

    isProjectActive(project) {
      const projectId = project.id === null ? "unclassified" : project.id;
      return this.selectedProject === projectId && this.selectedCancer === null;
    },

    isCancerActive(project, cancer) {
      const projectId = project.id === null ? "unclassified" : project.id;
      const cancerId = cancer.id === null ? "unclassified" : cancer.id;
      return this.selectedProject === projectId && this.selectedCancer === cancerId;
    },
  },
};
</script>

<style scoped>
.project-tree-filter {
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
}

.project-tree-filter.collapsed {
  width: 40px;
  min-width: 40px;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.tree-header:hover {
  background: #dee2e6;
}

.filter-badge {
  background: #007bff;
  color: white;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  margin-left: auto;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-loading,
.tree-empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-size: 13px;
}

.tree-list {
  padding: 0 4px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.tree-item:hover {
  background: #e9ecef;
}

.tree-item.active {
  background: #d4edff;
  color: #0056b3;
}

.tree-item.all-item {
  font-weight: 500;
  margin-bottom: 4px;
  border-bottom: 1px solid #dee2e6;
  border-radius: 0;
  padding-bottom: 10px;
}

.expand-icon {
  width: 12px;
  font-size: 10px;
  color: #6c757d;
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  line-height: 1.3;
  max-height: 2.6em; /* line-height * 2 */
}

.item-count {
  font-size: 11px;
  color: #6c757d;
  background: #e9ecef;
  border-radius: 8px;
  padding: 1px 6px;
}

.tree-item.active .item-count {
  background: #007bff;
  color: white;
}

.children {
  margin-left: 16px;
}

.project-item i.fa-folder {
  color: #ffc107;
}

.cancer-item i.fa-dna {
  color: #28a745;
}

.mode-item i {
  color: #6c757d;
}

.tree-actions {
  padding: 8px 12px;
  border-top: 1px solid #dee2e6;
}

.clear-filter-btn {
  width: 100%;
  padding: 8px;
  border: none;
  background: #6c757d;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-filter-btn:hover {
  background: #5a6268;
}

/* 태그 필터 섹션 */
.tag-filter-section {
  padding: 0 8px 8px;
  border-bottom: 1px solid #dee2e6;
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.section-header i {
  color: #6c757d;
}

.project-section-header {
  padding: 8px 12px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-item {
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}

.tag-item:hover {
  background: #dee2e6;
}

.tag-item.active {
  background: #007bff;
  color: white;
}

.tag-item .tag-count {
  font-size: 10px;
  opacity: 0.8;
}

.tag-item.more-tags {
  background: transparent;
  color: #6c757d;
  border: 1px dashed #adb5bd;
}

.tag-item.more-tags:hover {
  background: #f8f9fa;
  color: #495057;
}

/* 접힌 상태 */
.collapsed .tree-header span,
.collapsed .filter-badge {
  display: none;
}

.collapsed .tree-header {
  justify-content: center;
  padding: 12px 8px;
}
</style>
