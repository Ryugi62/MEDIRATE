<!-- ProjectManager.vue -->
<!-- 프로젝트/암종 관리 컴포넌트 -->
<template>
  <div class="project-manager">
    <!-- 탭 헤더 -->
    <div class="manager-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'projects' }"
        @click="activeTab = 'projects'"
      >
        <i class="fas fa-folder"></i> 프로젝트
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'cancers' }"
        @click="activeTab = 'cancers'"
      >
        <i class="fas fa-disease"></i> 암종
      </button>
    </div>

    <!-- 프로젝트 탭 -->
    <div v-if="activeTab === 'projects'" class="tab-content">
      <div class="manager-header">
        <h3><i class="fas fa-folder-tree"></i> 프로젝트 관리</h3>
        <button class="add-btn" @click="showCreateProjectForm">
          <i class="fas fa-plus"></i> 새 프로젝트
        </button>
      </div>

      <div class="manager-body">
        <div v-if="loading" class="loading">
          <i class="fas fa-spinner fa-spin"></i> 로딩 중...
        </div>

        <div v-else-if="projects.length === 0" class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>등록된 프로젝트가 없습니다.</p>
          <button class="create-btn" @click="showCreateProjectForm">
            첫 번째 프로젝트 만들기
          </button>
        </div>

        <div v-else class="project-list">
          <div
            v-for="project in projects"
            :key="project.id"
            class="project-card"
          >
            <div class="project-card-header">
              <div class="project-info">
                <span class="project-name">{{ project.name }}</span>
                <span class="project-meta">
                  {{ project.assignment_count || 0 }}개 과제
                </span>
              </div>
              <div class="project-actions">
                <button
                  class="action-btn edit-btn"
                  @click="editProject(project)"
                  title="수정"
                >
                  <i class="fas fa-edit"></i>
                </button>
                <button
                  class="action-btn delete-btn"
                  @click="confirmDeleteProject(project)"
                  title="삭제"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div v-if="project.description" class="project-description">
              {{ project.description }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 암종 탭 -->
    <div v-if="activeTab === 'cancers'" class="tab-content">
      <div class="manager-header">
        <h3><i class="fas fa-disease"></i> 암종 관리</h3>
        <button class="add-btn" @click="showAddCancerForm">
          <i class="fas fa-plus"></i> 새 암종
        </button>
      </div>

      <div class="manager-body">
        <div v-if="loading" class="loading">
          <i class="fas fa-spinner fa-spin"></i> 로딩 중...
        </div>

        <div v-else-if="cancerTypes.length === 0" class="empty-state">
          <i class="fas fa-disease"></i>
          <p>등록된 암종이 없습니다.</p>
          <button class="create-btn" @click="showAddCancerForm">
            첫 번째 암종 만들기
          </button>
        </div>

        <div v-else class="cancer-type-list">
          <div
            v-for="cancer in cancerTypes"
            :key="cancer.id"
            class="cancer-type-card"
          >
            <div class="cancer-type-info">
              <span class="cancer-code">{{ cancer.code }}</span>
              <span class="cancer-name">{{ cancer.name_ko }}</span>
            </div>
            <div class="cancer-type-actions">
              <button
                class="action-btn edit-btn"
                @click="editCancer(cancer)"
                title="수정"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                class="action-btn delete-btn"
                @click="confirmDeleteCancer(cancer)"
                title="삭제"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 프로젝트 생성/수정 모달 -->
    <div v-if="showProjectForm" class="modal-overlay" @click.self="closeProjectForm">
      <div class="modal-container">
        <div class="modal-header">
          <h4>{{ editingProject ? '프로젝트 수정' : '새 프로젝트' }}</h4>
          <button class="close-btn" @click="closeProjectForm">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>프로젝트 이름 *</label>
            <input
              type="text"
              v-model="projectFormData.name"
              placeholder="예: 유방암 연구, Pilot Study"
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label>설명</label>
            <textarea
              v-model="projectFormData.description"
              placeholder="프로젝트에 대한 설명 (선택사항)"
              maxlength="500"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeProjectForm">취소</button>
          <button
            class="save-btn"
            @click="saveProject"
            :disabled="!projectFormData.name || saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <span v-else>{{ editingProject ? '수정' : '저장' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 암종 생성/수정 모달 -->
    <div v-if="showCancerForm" class="modal-overlay" @click.self="closeCancerForm">
      <div class="modal-container">
        <div class="modal-header">
          <h4>{{ editingCancer ? '암종 수정' : '새 암종' }}</h4>
          <button class="close-btn" @click="closeCancerForm">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>암종 코드 *</label>
            <input
              type="text"
              v-model="cancerFormData.code"
              placeholder="예: brst, lung (영문 소문자)"
              maxlength="20"
            />
          </div>

          <div class="form-group">
            <label>암종 이름 (한글) *</label>
            <input
              type="text"
              v-model="cancerFormData.name_ko"
              placeholder="예: 유방암, 폐암"
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label>암종 이름 (영문)</label>
            <input
              type="text"
              v-model="cancerFormData.name_en"
              placeholder="예: Breast Cancer"
              maxlength="100"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeCancerForm">취소</button>
          <button
            class="save-btn"
            @click="saveCancer"
            :disabled="!cancerFormData.code || !cancerFormData.name_ko || saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <span v-else>{{ editingCancer ? '수정' : '저장' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="confirm-modal">
        <h4>{{ deleteTarget.type === 'project' ? '프로젝트' : '암종' }} 삭제 확인</h4>
        <p>
          '<strong>{{ deleteTarget.item.name || deleteTarget.item.name_ko }}</strong>'을(를) 삭제하시겠습니까?
        </p>
        <p class="warning-text">이 작업은 되돌릴 수 없습니다.</p>
        <div class="confirm-actions">
          <button class="cancel-btn" @click="deleteTarget = null">취소</button>
          <button class="delete-btn" @click="executeDelete" :disabled="deleting">
            <i v-if="deleting" class="fas fa-spinner fa-spin"></i>
            <span v-else>삭제</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ProjectManager",

  data() {
    return {
      activeTab: "projects",
      projects: [],
      cancerTypes: [],
      loading: false,
      saving: false,
      deleting: false,
      showProjectForm: false,
      showCancerForm: false,
      editingProject: null,
      editingCancer: null,
      deleteTarget: null,
      projectFormData: {
        name: "",
        description: "",
      },
      cancerFormData: {
        code: "",
        name_ko: "",
        name_en: "",
      },
    };
  },

  async mounted() {
    await this.fetchData();
  },

  methods: {
    async fetchData() {
      this.loading = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const [projectsRes, cancersRes] = await Promise.all([
          this.$axios.get("/api/projects", { headers }),
          this.$axios.get("/api/projects/cancer-types", { headers }),
        ]);
        this.projects = projectsRes.data;
        this.cancerTypes = cancersRes.data;
      } catch (error) {
        console.error("데이터 조회 오류:", error);
      } finally {
        this.loading = false;
      }
    },

    // 프로젝트 폼
    showCreateProjectForm() {
      this.editingProject = null;
      this.projectFormData = { name: "", description: "" };
      this.showProjectForm = true;
    },

    editProject(project) {
      this.editingProject = project;
      this.projectFormData = {
        name: project.name,
        description: project.description || "",
      };
      this.showProjectForm = true;
    },

    closeProjectForm() {
      this.showProjectForm = false;
      this.editingProject = null;
    },

    async saveProject() {
      this.saving = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.editingProject) {
          await this.$axios.put(
            `/api/projects/${this.editingProject.id}`,
            this.projectFormData,
            { headers }
          );
        } else {
          await this.$axios.post("/api/projects", this.projectFormData, { headers });
        }

        await this.fetchData();
        this.closeProjectForm();
        this.$emit("updated");
      } catch (error) {
        console.error("프로젝트 저장 오류:", error);
        const msg = error.response?.data?.message || "프로젝트 저장 중 오류가 발생했습니다.";
        alert(msg);
      } finally {
        this.saving = false;
      }
    },

    // 암종 폼
    showAddCancerForm() {
      this.editingCancer = null;
      this.cancerFormData = { code: "", name_ko: "", name_en: "" };
      this.showCancerForm = true;
    },

    editCancer(cancer) {
      this.editingCancer = cancer;
      this.cancerFormData = {
        code: cancer.code,
        name_ko: cancer.name_ko,
        name_en: cancer.name_en || "",
      };
      this.showCancerForm = true;
    },

    closeCancerForm() {
      this.showCancerForm = false;
      this.editingCancer = null;
    },

    async saveCancer() {
      this.saving = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.editingCancer) {
          await this.$axios.put(
            `/api/projects/cancer-types/${this.editingCancer.id}`,
            this.cancerFormData,
            { headers }
          );
        } else {
          await this.$axios.post(
            "/api/projects/cancer-types",
            this.cancerFormData,
            { headers }
          );
        }

        await this.fetchData();
        this.closeCancerForm();
        this.$emit("updated");
      } catch (error) {
        console.error("암종 저장 오류:", error);
        const msg = error.response?.data?.message || "암종 저장 중 오류가 발생했습니다.";
        alert(msg);
      } finally {
        this.saving = false;
      }
    },

    // 삭제
    confirmDeleteProject(project) {
      this.deleteTarget = { type: "project", item: project };
    },

    confirmDeleteCancer(cancer) {
      this.deleteTarget = { type: "cancer", item: cancer };
    },

    async executeDelete() {
      this.deleting = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.deleteTarget.type === "project") {
          await this.$axios.delete(
            `/api/projects/${this.deleteTarget.item.id}`,
            { headers }
          );
        } else {
          await this.$axios.delete(
            `/api/projects/cancer-types/${this.deleteTarget.item.id}`,
            { headers }
          );
        }

        await this.fetchData();
        this.deleteTarget = null;
        this.$emit("updated");
      } catch (error) {
        console.error("삭제 오류:", error);
        const msg = error.response?.data?.message || "삭제 중 오류가 발생했습니다.";
        alert(msg);
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style scoped>
.project-manager {
  background-color: #fff;
  border: 1px solid var(--light-gray, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
}

/* 탭 스타일 */
.manager-tabs {
  display: flex;
  border-bottom: 1px solid var(--light-gray, #e0e0e0);
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  background: #f8f9fa;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.tab-btn:first-child {
  border-right: 1px solid var(--light-gray, #e0e0e0);
}

.tab-btn:hover {
  background: #e9ecef;
}

.tab-btn.active {
  background: white;
  color: var(--blue, #007bff);
  border-bottom: 2px solid var(--blue, #007bff);
}

.tab-content {
  padding: 0;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid var(--light-gray, #e0e0e0);
}

.manager-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.manager-header h3 i {
  color: var(--blue, #007bff);
}

.add-btn {
  padding: 6px 12px;
  font-size: 12px;
  background-color: var(--blue, #007bff);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-btn:hover {
  background-color: #0056b3;
}

.manager-body {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.loading,
.empty-state {
  text-align: center;
  padding: 30px;
  color: #666;
}

.empty-state i {
  font-size: 40px;
  color: #ccc;
  margin-bottom: 10px;
}

.empty-state p {
  margin: 10px 0;
}

.create-btn {
  padding: 8px 16px;
  background-color: var(--blue, #007bff);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-card {
  border: 1px solid var(--light-gray, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
}

.project-card.expanded {
  border-color: var(--blue, #007bff);
}

.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: #fafafa;
  cursor: pointer;
}

.project-card-header:hover {
  background-color: #f0f0f0;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-name {
  font-weight: 600;
  font-size: 13px;
}

.cancer-count {
  font-size: 11px;
  color: #666;
  background-color: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.project-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.add-cancer-btn {
  background-color: #28a745;
  color: white;
}

.add-cancer-btn:hover {
  background-color: #218838;
}

.edit-btn {
  background-color: #ffc107;
  color: #333;
}

.edit-btn:hover {
  background-color: #e0a800;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
}

.delete-btn:hover {
  background-color: #c82333;
}

.expand-icon {
  color: #666;
  font-size: 12px;
  margin-left: 4px;
}

.project-description {
  font-size: 12px;
  color: #666;
  padding: 8px 12px;
  background-color: #fafafa;
  border-top: 1px solid var(--light-gray, #e0e0e0);
}

.project-meta {
  font-size: 11px;
  color: #888;
  background-color: #e9ecef;
  padding: 2px 8px;
  border-radius: 10px;
}

/* 암종 목록 스타일 */
.cancer-type-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cancer-type-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #fafafa;
  border-bottom: 1px solid #eee;
}

.cancer-type-card:last-child {
  border-bottom: none;
}

.cancer-type-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cancer-code {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  background-color: #e9ecef;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.cancer-name {
  font-size: 13px;
  font-weight: 500;
}

.cancer-type-actions {
  display: flex;
  gap: 4px;
}

/* 모달 */
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

.modal-container {
  background-color: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--light-gray, #e0e0e0);
}

.modal-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: #666;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--light-gray, #e0e0e0);
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--blue, #007bff);
}

.disabled-input {
  background-color: #f5f5f5;
  color: #666;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--light-gray, #e0e0e0);
}

.cancel-btn {
  padding: 8px 16px;
  background-color: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.save-btn {
  padding: 8px 16px;
  background-color: var(--blue, #007bff);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.save-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 삭제 확인 모달 */
.confirm-modal {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 350px;
  max-width: 90%;
  text-align: center;
}

.confirm-modal h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.confirm-modal p {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
}

.warning-text {
  color: #dc3545;
  font-size: 12px;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.confirm-actions .delete-btn {
  padding: 8px 20px;
}
</style>
