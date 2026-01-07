<!-- EvaluationView.vue -->

<template>
  <div class="assignment-container">
    <h1 class="assignment-title">{{ isEditMode ? '과제 수정' : '과제 관리' }}</h1>

    <div class="content-container">
      <div class="user-addition">
        <div class="user-search-box">
          <label for="user-search" class="user-search-label"
            >평가자 검색:</label
          >
          <div class="user-search-input">
            <input
              id="user-search"
              type="text"
              placeholder="유저 검색"
              v-model="searchInput"
            />
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
          </div>
        </div>
        <!-- 그룹 선택 드롭다운 -->
        <div class="group-select-box" v-if="groups.length > 0">
          <label class="group-select-label">그룹 선택:</label>
          <select v-model="selectedGroupId" @change="applyGroupSelection" class="group-select">
            <option value="">그룹 선택...</option>
            <option v-for="group in groups" :key="group.id" :value="group.id">
              {{ group.name }} ({{ group.member_count }}명)
            </option>
          </select>
        </div>
        <hr />
        <div class="user-list">
          <span class="user-count"
            >선택된 평가자: {{ addedUsers.length }} / {{ maxUserCount }}</span
          >
          <div class="user-item-box user-item-box--toggle">
            <div
              v-for="user in filteredUserList"
              :key="user.id"
              @click="toggleUser(user)"
              :class="['user-item-toggle', { selected: isUserAdded(user) }]"
            >
              <div class="user-item-content">
                <span class="user-name">{{ user.realname.trim() }}</span>
                <span class="user-affiliation">{{ user.username }}</span>
              </div>
              <i :class="isUserAdded(user) ? 'fa-solid fa-check' : 'fa-solid fa-plus'"></i>
            </div>
          </div>
        </div>

        <div class="guide_container">
          <img
            src="../assets/evaluation_guide.png"
            class="guide_container_image"
          />
        </div>
      </div>
      <div class="assignment-addition">
        <div class="assignment-info">
          <!-- A1: 평가 유형 그룹 (택일형, BBox, Segment) -->
          <div class="mode-group" :class="{ 'mode-group--disabled': isConsensusMode }">
            <span class="group-label">평가 유형</span>
            <div class="mode-options">
              <label class="mode-option" :class="{ active: assignmentDetails.mode === 'TextBox' }">
                <input
                  type="radio"
                  id="field-text-mode"
                  name="mode"
                  value="TextBox"
                  v-model="assignmentDetails.mode"
                  :disabled="isConsensusMode"
                />
                <i class="fas fa-list-ul"></i>
                <span>택일형</span>
              </label>
              <label class="mode-option" :class="{ active: assignmentDetails.mode === 'BBox' }">
                <input
                  type="radio"
                  id="field-bbox-mode"
                  name="mode"
                  value="BBox"
                  v-model="assignmentDetails.mode"
                  :disabled="isConsensusMode"
                />
                <i class="fas fa-square"></i>
                <span>BBox</span>
              </label>
              <label class="mode-option" :class="{ active: assignmentDetails.mode === 'Segment' }">
                <input
                  type="radio"
                  id="field-segment-mode"
                  name="mode"
                  value="Segment"
                  v-model="assignmentDetails.mode"
                  :disabled="isConsensusMode"
                />
                <i class="fas fa-draw-polygon"></i>
                <span>Segment</span>
              </label>
            </div>
            <!-- Consensus 모드 오버레이 -->
            <div v-if="isConsensusMode" class="mode-disabled-overlay">
              <span>Consensus이기 때문에 모드를 변경할 수 없습니다</span>
            </div>
          </div>

          <!-- A2: 검수 옵션 그룹 (Score/AI/Timer) - BBox/Segment 모드에서만 표시 -->
          <div class="options-group" v-if="assignmentDetails.mode === 'BBox' || assignmentDetails.mode === 'Segment'">
            <span class="group-label">검수 옵션</span>
            <div class="option-items">
              <label class="option-item" :class="{ active: assignmentDetails.is_score }">
                <input
                  type="checkbox"
                  name="is_score"
                  id="is_score"
                  v-model="assignmentDetails.is_score"
                />
                <i class="fas fa-chart-bar"></i>
                <span>Score</span>
              </label>
              <label class="option-item" :class="{ active: assignmentDetails.is_ai_use }">
                <input
                  type="checkbox"
                  name="is_ai_use"
                  id="is_ai_use"
                  v-model="assignmentDetails.is_ai_use"
                />
                <i class="fas fa-robot"></i>
                <span>AI</span>
              </label>
              <label class="option-item" :class="{ active: assignmentDetails.is_timer }">
                <input
                  type="checkbox"
                  name="is_timer"
                  id="is_timer"
                  v-model="assignmentDetails.is_timer"
                />
                <i class="fas fa-stopwatch"></i>
                <span>Timer</span>
              </label>
            </div>
          </div>

          <!-- A3: 프로젝트/암종 선택 -->
          <div class="project-select-group">
            <div class="select-field">
              <label class="select-label">프로젝트:</label>
              <div class="select-with-add">
                <select v-model="selectedProjectId" class="project-select" @change="selectedCancerId = null">
                  <option :value="null">프로젝트 선택...</option>
                  <option v-for="project in projectList" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
                <button type="button" class="add-inline-btn" @click="showNewProjectModal = true" title="새 프로젝트 추가">
                  <i class="fas fa-plus"></i>
                </button>
                <button
                  type="button"
                  class="delete-inline-btn"
                  @click="confirmDeleteProject"
                  :disabled="!selectedProjectId"
                  title="선택한 프로젝트 삭제"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="select-field">
              <label class="select-label">암종:</label>
              <div class="select-with-add">
                <select v-model="selectedCancerId" class="cancer-select">
                  <option :value="null">암종 선택...</option>
                  <option v-for="cancer in cancerList" :key="cancer.id" :value="cancer.id">
                    {{ cancer.name }}
                  </option>
                </select>
                <button type="button" class="add-inline-btn" @click="showNewCancerModal = true" title="새 암종 추가">
                  <i class="fas fa-plus"></i>
                </button>
                <button
                  type="button"
                  class="delete-inline-btn"
                  @click="confirmDeleteCancer"
                  :disabled="!selectedCancerId"
                  title="선택한 암종 삭제"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- A4: 해시태그 입력 -->
          <div class="tag-input-group">
            <label class="tag-label">태그:</label>
            <div class="tag-input-container">
              <div class="selected-tags">
                <span
                  v-for="tag in assignmentDetails.tags"
                  :key="tag.id || tag.name"
                  class="tag-badge"
                >
                  #{{ tag.name }}
                  <i class="fa-solid fa-xmark" @click="removeTag(tag)"></i>
                </span>
                <input
                  type="text"
                  v-model="tagInput"
                  @input="searchTags"
                  @keydown.enter.prevent="addTagFromInput"
                  @keydown.tab.prevent="addTagFromInput"
                  @keydown.backspace="handleBackspace"
                  @blur="addTagFromInput"
                  placeholder="태그 입력 후 Enter (예: brst)"
                  class="tag-text-input"
                />
              </div>
              <div v-if="tagSuggestions.length > 0" class="tag-suggestions">
                <div
                  v-for="suggestion in tagSuggestions"
                  :key="suggestion.id"
                  class="tag-suggestion-item"
                  @click="addTag(suggestion)"
                >
                  <span class="suggestion-name">#{{ suggestion.name }}</span>
                  <span class="suggestion-count">{{ suggestion.usage_count || 0 }}회 사용</span>
                </div>
              </div>
            </div>
          </div>

          <div
            v-for="(field, fieldName) in assignmentFields"
            :key="fieldName"
            class="assignment-field"
          >
            <!--
              Consensus 모드: 과제 ID, 선택 유형 필드 숨김
              BBox/Segment 모드: 선택 유형 필드 숨김
            -->
            <template
              v-if="
                !(
                  (isConsensusMode && (fieldName === 'assignment-id' || fieldName === 'assignment-type')) ||
                  (fieldName === 'assignment-type' &&
                    (assignmentDetails.mode === 'BBox' || assignmentDetails.mode === 'Segment'))
                )
              "
            >
              <label :for="`field-${fieldName}`">{{ field.label }}</label>
              <input
                v-if="field.component === 'input'"
                :id="`field-${fieldName}`"
                :type="field.options?.type"
                v-model="assignmentDetails[field.model]"
                :list="
                  fieldName === 'assignment-id' ? 'assignment-id-list' : null
                "
              />
              <datalist id="assignment-id-list">
                <option
                  v-for="folder in folderList"
                  :key="folder"
                  :value="folder"
                >
                  {{ folder }}
                </option>
              </datalist>
              <button
                v-if="field.method"
                @click="field.method ? this[field.method]() : null"
              >
                조회
              </button>
            </template>
          </div>
        </div>
        <hr />
        <div class="assignment-preview">
          <div class="assignment-overview">
            <div class="assignment-metadata">
              <h2 class="metadata-assignment-title">
                {{ assignmentDetails.title }}
              </h2>
              <span class="metadata-due-date">{{
                assignmentDetails.deadline
              }}</span>
            </div>
          </div>
          <div class="assignment-preview-content">
            <div class="grades-table">
              <table>
                <thead>
                  <tr>
                    <th>이미지</th>
                    <th
                      v-for="option in assignmentDetails.gradingScale"
                      :key="option"
                    >
                      {{ option }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    @click="activeQuestionId = question.id"
                    :class="[{ active: question.id === activeQuestionId }]"
                    v-for="question in assignmentDetails.questions"
                    :key="question.id"
                  >
                    <td><img :src="question.img" /></td>
                    <td
                      v-for="option in assignmentDetails.gradingScale"
                      :key="`question-${question.id}-option-${option}`"
                    >
                      <input
                        type="radio"
                        :name="`question-${question.id}`"
                        :value="option"
                        v-model="question.select"
                        disabled
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="student-response-image">
              <ImageComponent
                v-if="activeQuestionId !== null"
                :src="
                  assignmentDetails.questions.find(
                    (question) => question.id === activeQuestionId
                  )?.img
                "
              />
            </div>
          </div>
          <div class="assignment-save">
            <button
              class="delete-question-button"
              v-if="activeQuestionId !== null"
              @click="handlerDeleteQuestion(activeQuestionId)"
            >
              삭제
            </button>
            <button @click="saveAssignment">{{ isEditMode ? '과제 저장' : '과제 생성' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 새 프로젝트 추가 모달 -->
    <div v-if="showNewProjectModal" class="modal-overlay" @click.self="showNewProjectModal = false">
      <div class="inline-modal">
        <div class="modal-header">
          <h4>새 프로젝트</h4>
          <button class="close-btn" @click="showNewProjectModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>프로젝트 이름 *</label>
            <input
              type="text"
              v-model="newProjectName"
              placeholder="예: 유방암 연구, Pilot Study"
              maxlength="100"
              @keydown.enter="saveNewProject"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="showNewProjectModal = false">취소</button>
          <button class="save-btn" @click="saveNewProject" :disabled="!newProjectName.trim() || savingProject">
            <i v-if="savingProject" class="fas fa-spinner fa-spin"></i>
            <span v-else>저장</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 새 암종 추가 모달 -->
    <div v-if="showNewCancerModal" class="modal-overlay" @click.self="showNewCancerModal = false">
      <div class="inline-modal">
        <div class="modal-header">
          <h4>새 암종 추가</h4>
          <button class="close-btn" @click="showNewCancerModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>암종 이름 (한글) *</label>
            <input
              type="text"
              v-model="newCancerName"
              placeholder="예: 유방암, 폐암, 대장암"
              maxlength="100"
              @keydown.enter="saveNewCancer"
            />
          </div>
          <p class="hint-text">* 암종 코드는 자동으로 생성됩니다.</p>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="showNewCancerModal = false">취소</button>
          <button class="save-btn" @click="saveNewCancer" :disabled="!newCancerName.trim() || savingCancer">
            <i v-if="savingCancer" class="fas fa-spinner fa-spin"></i>
            <span v-else>저장</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="confirm-modal">
        <h4>{{ deleteTarget.type === 'project' ? '프로젝트' : '암종' }} 삭제 확인</h4>
        <p>
          '<strong>{{ deleteTarget.name }}</strong>'을(를) 삭제하시겠습니까?
        </p>
        <p class="warning-text">이 작업은 되돌릴 수 없습니다.</p>
        <div class="confirm-actions">
          <button class="cancel-btn" @click="deleteTarget = null">취소</button>
          <button class="delete-confirm-btn" @click="executeDelete" :disabled="deleting">
            <i v-if="deleting" class="fas fa-spinner fa-spin"></i>
            <span v-else>삭제</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";

export default {
  name: "AssignmentManagementView",
  data() {
    return {
      userList: [],
      addedUsers: [],
      maxUserCount: 5,
      searchInput: "",
      folderList: [],
      // 그룹 관련
      groups: [],
      selectedGroupId: "",
      // 프로젝트/암종 관련
      projectList: [],
      cancerTypeList: [], // 전역 암종 목록
      selectedProjectId: null,
      selectedCancerId: null,
      // 새 프로젝트/암종 추가 모달
      showNewProjectModal: false,
      showNewCancerModal: false,
      newProjectName: "",
      newCancerName: "",
      savingProject: false,
      savingCancer: false,
      // 삭제 관련
      deleteTarget: null,
      deleting: false,
      // 태그 관련
      tagInput: "", // 태그 입력 필드
      tagSuggestions: [], // 자동완성 목록
      assignmentDetails: {
        title: "",
        deadline: "",
        selectedAssignmentId: "",
        selectedAssignmentType: "",
        questions: [],
        gradingScale: null,
        mode: "BBox",
        is_score: true,
        is_ai_use: true,
        is_timer: true,
        tags: [], // 태그 배열 [{id, name, color}, ...]
      },
      activeQuestionId: null,
      assignmentFields: {
        "assignment-title": {
          label: "과제 제목 :",
          component: "input",
          model: "title",
          options: {},
        },
        "assignment-deadline": {
          label: "마감일 :",
          component: "input",
          model: "deadline",
          options: { type: "date" },
        },
        "assignment-id": {
          label: "과제 ID :",
          component: "input",
          model: "selectedAssignmentId",
          method: "generateQuestions",
          options: {},
        },
        "assignment-type": {
          label: "선택 유형 :",
          component: "input",
          model: "selectedAssignmentType",
          method: "updateTableHeader",
          options: {},
        },
      },
    };
  },

  async mounted() {
    await Promise.all([
      this.fetchUserList(),
      this.fetchFolderList(),
      this.fetchGroups(),
      this.fetchProjectList(),
      this.fetchCancerTypes(),
    ]);
    if (this.isEditMode) {
      if (this.isConsensusMode) {
        await this.fetchConsensusData();
      } else {
        await this.fetchAssignmentData();
      }
    }
  },

  components: {
    ImageComponent,
  },

  computed: {
    isEditMode() {
      return !!this.$route.params.id;
    },
    isConsensusMode() {
      return this.$route.meta?.isConsensus === true;
    },
    assignmentId() {
      return this.$route.params.id;
    },
    filteredUserList() {
      if (!this.searchInput) return this.userList;
      const searchKeyword = this.searchInput.toLowerCase();
      return this.userList.filter((user) => {
        const userName = user.realname ? user.realname.toLowerCase() : "";
        const userOrganization = user.organization
          ? user.organization.toLowerCase()
          : "";
        return (
          userName.includes(searchKeyword) ||
          userOrganization.includes(searchKeyword)
        );
      });
    },
    // 암종 목록 (전역 암종 테이블 사용)
    cancerList() {
      return this.cancerTypeList;
    },
    // 선택된 프로젝트 이름
    selectedProjectName() {
      if (!this.selectedProjectId) return "";
      const project = this.projectList.find((p) => p.id === this.selectedProjectId);
      return project?.name || "";
    },
  },
  methods: {
    // 프로젝트 목록 로드
    async fetchProjectList() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/projects", { headers });
        this.projectList = response.data;
      } catch (error) {
        console.error("프로젝트 목록 로딩 오류:", error);
      }
    },

    // 암종 목록 로드
    async fetchCancerTypes() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/projects/cancer-types", { headers });
        // API 응답을 cancerList 형식에 맞게 변환
        this.cancerTypeList = response.data.map(ct => ({
          id: ct.id,
          name: ct.name_ko || ct.code,
          code: ct.code,
        }));
      } catch (error) {
        console.error("암종 목록 로딩 오류:", error);
      }
    },

    // 새 프로젝트 저장
    async saveNewProject() {
      if (!this.newProjectName.trim()) return;
      this.savingProject = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.post(
          "/api/projects",
          { name: this.newProjectName.trim() },
          { headers }
        );
        // 프로젝트 목록 새로고침 후 새 프로젝트 선택
        await this.fetchProjectList();
        // API는 projectId를 반환
        this.selectedProjectId = response.data.projectId;
        this.selectedCancerId = null;
        this.showNewProjectModal = false;
        this.newProjectName = "";
      } catch (error) {
        console.error("프로젝트 저장 오류:", error);
        const errorMsg = error.response?.data?.message || "프로젝트 저장 중 오류가 발생했습니다.";
        alert(errorMsg);
      } finally {
        this.savingProject = false;
      }
    },

    // 새 암종 저장 (전역 암종 테이블 사용)
    async saveNewCancer() {
      if (!this.newCancerName.trim()) return;
      this.savingCancer = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        // 암종 코드는 이름을 기반으로 자동 생성
        const code = this.newCancerName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20);
        const response = await this.$axios.post(
          "/api/projects/cancer-types",
          {
            code: code,
            name_ko: this.newCancerName.trim(),
            name_en: ""
          },
          { headers }
        );
        // 암종 목록 새로고침 후 새 암종 선택
        await this.fetchCancerTypes();
        this.selectedCancerId = response.data.cancerTypeId;
        this.showNewCancerModal = false;
        this.newCancerName = "";
      } catch (error) {
        console.error("암종 저장 오류:", error);
        const errorMsg = error.response?.data?.message || "암종 저장 중 오류가 발생했습니다.";
        alert(errorMsg);
      } finally {
        this.savingCancer = false;
      }
    },

    // 프로젝트 삭제 확인
    confirmDeleteProject() {
      if (!this.selectedProjectId) return;
      const project = this.projectList.find(p => p.id === this.selectedProjectId);
      if (project) {
        this.deleteTarget = {
          type: 'project',
          id: this.selectedProjectId,
          name: project.name
        };
      }
    },

    // 암종 삭제 확인
    confirmDeleteCancer() {
      if (!this.selectedCancerId) return;
      const cancer = this.cancerList.find(c => c.id === this.selectedCancerId);
      if (cancer) {
        this.deleteTarget = {
          type: 'cancer',
          id: this.selectedCancerId,
          name: cancer.name
        };
      }
    },

    // 삭제 실행
    async executeDelete() {
      if (!this.deleteTarget) return;
      this.deleting = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.deleteTarget.type === 'project') {
          await this.$axios.delete(`/api/projects/${this.deleteTarget.id}`, { headers });
          // 삭제된 프로젝트가 선택되어 있었다면 선택 해제
          if (this.selectedProjectId === this.deleteTarget.id) {
            this.selectedProjectId = null;
            this.selectedCancerId = null;
          }
          await this.fetchProjectList();
        } else {
          await this.$axios.delete(`/api/projects/cancer-types/${this.deleteTarget.id}`, { headers });
          // 삭제된 암종이 선택되어 있었다면 선택 해제
          if (this.selectedCancerId === this.deleteTarget.id) {
            this.selectedCancerId = null;
          }
          await this.fetchCancerTypes();
        }

        this.deleteTarget = null;
      } catch (error) {
        console.error("삭제 오류:", error);
        const errorMsg = error.response?.data?.message || "삭제 중 오류가 발생했습니다.";
        alert(errorMsg);
      } finally {
        this.deleting = false;
      }
    },

    fetchFolderList() {
      this.$axios
        .get("/api/assets")
        .then((response) => {
          this.folderList = response.data;
        })
        .catch((error) => {
          console.error("폴더 리스트를 가져오는 중 오류 발생:", error);
        });
    },

    updateTableHeader() {
      if (this.assignmentDetails.selectedAssignmentType.trim() === "") {
        alert("선택 유형을 먼저 선택하세요.");
        return;
      }

      const headerText = this.assignmentDetails.selectedAssignmentType;
      const headerArray = headerText.split(",").map((item) => item.trim());

      const hasDuplicates = new Set(headerArray).size !== headerArray.length;
      if (hasDuplicates) {
        alert("중복된 선택 유형은 추가할 수 없습니다.");
        return;
      }

      this.assignmentDetails.gradingScale = headerArray;
    },

    isUserAdded(user) {
      return this.addedUsers.some(
        (addedUser) => addedUser.username === user.username
      );
    },
    toggleUser(user) {
      const index = this.addedUsers.findIndex(
        (addedUser) => addedUser.username === user.username
      );
      if (index !== -1) {
        // 이미 선택됨 -> 선택 해제
        this.addedUsers.splice(index, 1);
      } else if (this.addedUsers.length < this.maxUserCount) {
        // 선택 안됨 + 최대 수 미만 -> 선택
        this.addedUsers.push(user);
      } else {
        alert(`최대 ${this.maxUserCount}명까지 선택 가능합니다.`);
      }
    },
    saveAssignment() {
      // Consensus 모드일 때는 다른 저장 로직 사용
      if (this.isConsensusMode) {
        this.saveConsensus();
        return;
      }

      if (
        this.addedUsers.length === 0 ||
        !this.assignmentDetails.title ||
        !this.assignmentDetails.deadline ||
        !this.assignmentDetails.selectedAssignmentId ||
        !this.assignmentDetails.questions.length > 0 ||
        (this.assignmentDetails.mode === "TextBox" &&
          !this.assignmentDetails.selectedAssignmentType)
      ) {
        alert(
          "평가자, 과제 제목, 마감일, 과제 ID, 선택 유형을 모두 입력해주세요."
        );
        return;
      }

      this.$el.querySelectorAll("input, select").forEach((input) => {
        input.disabled = true;
      });

      const assignmentData = {
        title: this.assignmentDetails.title,
        deadline: this.assignmentDetails.deadline,
        assignment_type: this.assignmentDetails.selectedAssignmentId,
        selection_type:
          this.assignmentDetails.mode === "TextBox"
            ? this.assignmentDetails.selectedAssignmentType
            : "",
        questions: this.assignmentDetails.questions,
        users: this.addedUsers.map((user) => user.id),
        mode: this.assignmentDetails.mode,
        is_score: this.assignmentDetails.is_score,
        is_ai_use: this.assignmentDetails.is_ai_use,
        is_timer: this.assignmentDetails.is_timer,
        gradingScale:
          this.assignmentDetails.mode === "TextBox"
            ? this.assignmentDetails.gradingScale
            : [],
        tags: this.assignmentDetails.tags.map((t) => t.name), // 태그 이름 배열
        project_id: this.selectedProjectId,
        cancer_type_id: this.selectedCancerId,
      };

      console.log("[DEBUG] saveAssignment - mode:", this.assignmentDetails.mode);
      console.log("[DEBUG] saveAssignment - assignmentData:", JSON.stringify(assignmentData, null, 2));

      if (this.isEditMode) {
        // 수정 모드: PUT 요청
        assignmentData.id = this.assignmentDetails.id;
        this.$axios
          .put(`/api/assignments/edit/${this.assignmentDetails.id}`, assignmentData, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            alert("과제가 성공적으로 저장되었습니다.");
            // 평가자 변경 시 해당 과제의 AI 데이터 캐시 무효화
            this.$store.commit("clearAiDataByAssignment", this.assignmentDetails.id);
            this.$store.commit("setAssignmentSearchHistory", "");
            this.$store.commit("setAssignmentCurrentPage", 1);
            this.$router.push({ name: "assignment" });
          })
          .catch((error) => {
            console.error("과제 수정 중 오류 발생:", error);
            this.$el.querySelectorAll("input, select").forEach((input) => {
              input.disabled = false;
            });
          });
      } else {
        // 생성 모드: POST 요청
        this.$axios
          .post("/api/assignments/", assignmentData, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then(() => {
            alert("새로운 과제가 생성되었습니다.");
            this.$store.commit("setAssignmentSearchHistory", "");
            this.$store.commit("setAssignmentCurrentPage", 1);
            this.$router.push({ name: "assignment" });
          })
          .catch((error) => {
            console.error("새로운 과제 생성 중 오류 발생:", error);
            this.$el.querySelectorAll("input, select").forEach((input) => {
              input.disabled = false;
            });
          });
      }
    },
    formatNumber(number, length) {
      number += 1;
      return number.toString().padStart(length, "0");
    },
    generateQuestions() {
      if (this.assignmentDetails.selectedAssignmentId === "") {
        alert("과제 ID를 먼저 선택하세요.");
        return;
      }

      // trim()을 사용하여 공백 문제 해결
      const trimmedFolderList = this.folderList.map(folder => folder.trim());
      const trimmedAssignmentId = this.assignmentDetails.selectedAssignmentId.trim();
      
      if (!trimmedFolderList.includes(trimmedAssignmentId)) {
        alert(
          `해당 과제 ID가 존재하지 않습니다.\n\n입력된 ID: "${trimmedAssignmentId}"\n\n가능한 과제 ID는 다음과 같습니다:\n${this.folderList.join(
            ",\n"
          )}`
        );
        return;
      }

      this.$axios
        .get(`/api/assets/${this.assignmentDetails.selectedAssignmentId}`)
        .then((response) => {
          const { files, metadata, originalFolderName } = response.data;
          const rout = `/api/assets/${originalFolderName || this.assignmentDetails.selectedAssignmentId}`;

          console.log(`response.data : ${JSON.stringify(response.data)}`);

          const questions = files.map((image, index) => {
            return {
              id: index,
              img: `https://aialpa-eval.duckdns.org${rout}/${encodeURIComponent(
                image
              )}`,
              select: null,
            };
          });

          this.assignmentDetails.questions = questions;
          this.activeQuestionId = 0;

          if (metadata) {
            // metadata가 있을 경우 데이터를 알림으로 표시
            console.log(`Metadata:\n${JSON.stringify(metadata, null, 2)}`);
          } else {
            // metadata가 없을 경우 알림 표시
            console.log("metadata가 없습니다.");
          }
        })
        .catch((error) => {
          console.error(
            "해당 폴더의 이미지 리스트를 가져오는 중 오류 발생:",
            error
          );
          
          // 404 오류인 경우 더 구체적인 메시지 제공
          if (error.response && error.response.status === 404) {
            alert(`과제 ID "${this.assignmentDetails.selectedAssignmentId}"에 대한 데이터를 찾을 수 없습니다.\n\n가능한 원인:\n1. taskdata API 업로드가 실패했을 수 있습니다\n2. 다른 과제 ID를 사용했을 수 있습니다\n3. 파일이 삭제되었을 수 있습니다\n\n다시 업로드하거나 올바른 과제 ID를 확인해주세요.`);
          } else {
            alert("이미지 리스트를 가져오는 중 오류가 발생했습니다.\n\n서버 오류이거나 네트워크 문제일 수 있습니다.");
          }
        });
    },

    fetchUserList() {
      this.$axios
        .get("/api/auth/user-list/", {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        })
        .then((response) => {
          this.userList = response.data;
        })
        .catch((error) => {
          console.error("유저 정보를 가져오는 중 오류 발생:", error);
        });
    },

    // 그룹 목록 조회
    async fetchGroups() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/consensus/groups/list", { headers });
        this.groups = response.data;
      } catch (error) {
        console.error("그룹 목록 조회 오류:", error);
      }
    },

    // 그룹 선택 시 해당 그룹의 멤버를 평가자로 추가
    applyGroupSelection() {
      if (!this.selectedGroupId) return;

      const group = this.groups.find(g => g.id === this.selectedGroupId);
      if (!group || !group.members) return;

      // 기존 선택 초기화 후 그룹 멤버 추가
      this.addedUsers = [];

      for (const member of group.members) {
        // userList에서 해당 멤버 찾기
        const user = this.userList.find(u => u.id === member.id);
        if (user && this.addedUsers.length < this.maxUserCount) {
          this.addedUsers.push(user);
        }
      }

      if (group.members.length > this.maxUserCount) {
        alert(`그룹에 ${group.members.length}명이 있지만, 최대 ${this.maxUserCount}명까지만 선택됩니다.`);
      }
    },

    // 태그 검색 (자동완성)
    async searchTags() {
      if (!this.tagInput.trim()) {
        this.tagSuggestions = [];
        return;
      }
      try {
        const response = await this.$axios.get("/api/tags", {
          params: { q: this.tagInput.trim() },
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        });
        // 이미 추가된 태그 제외
        const addedNames = new Set(this.assignmentDetails.tags.map((t) => t.name));
        this.tagSuggestions = response.data.filter((t) => !addedNames.has(t.name));
      } catch (error) {
        console.error("태그 검색 중 오류 발생:", error);
        this.tagSuggestions = [];
      }
    },

    // 태그 추가 (자동완성에서 선택)
    addTag(tag) {
      if (!this.assignmentDetails.tags.some((t) => t.name === tag.name)) {
        this.assignmentDetails.tags.push(tag);
      }
      this.tagInput = "";
      this.tagSuggestions = [];
    },

    // 태그 추가 (직접 입력)
    addTagFromInput() {
      const name = this.tagInput.trim().toLowerCase().replace(/^#/, "");
      if (!name) return;
      if (this.assignmentDetails.tags.some((t) => t.name === name)) {
        this.tagInput = "";
        this.tagSuggestions = [];
        return;
      }
      this.assignmentDetails.tags.push({ name, color: "#666666" });
      this.tagInput = "";
      this.tagSuggestions = [];
    },

    // 태그 제거
    removeTag(tag) {
      const index = this.assignmentDetails.tags.findIndex(
        (t) => t.name === tag.name
      );
      if (index !== -1) {
        this.assignmentDetails.tags.splice(index, 1);
      }
    },

    // Backspace로 마지막 태그 삭제
    handleBackspace() {
      if (this.tagInput === "" && this.assignmentDetails.tags.length > 0) {
        this.assignmentDetails.tags.pop();
      }
    },

    async fetchAssignmentData() {
      try {
        const response = await this.$axios.get(
          `/api/assignments/${this.assignmentId}/all`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        this.activeQuestionId = 0;
        this.addedUsers = response.data.assignedUsers;
        this.assignmentDetails.id = response.data.id;
        this.assignmentDetails.title = response.data.title;
        this.assignmentDetails.deadline = new Date(response.data.deadline)
          .toISOString()
          .split("T")[0];
        this.assignmentDetails.selectedAssignmentId =
          response.data.selectedAssignmentType;
        this.assignmentDetails.selectedAssignmentType =
          response.data.selectedAssignmentId;
        this.assignmentDetails.questions = response.data.questions;
        this.assignmentDetails.gradingScale = response.data.gradingScale;
        console.log("[DEBUG] fetchAssignmentData - assigment_mode from server:", response.data.assigment_mode);
        console.log("[DEBUG] fetchAssignmentData - full response:", JSON.stringify(response.data, null, 2));
        this.assignmentDetails.mode = response.data.assigment_mode;
        this.assignmentDetails.is_score =
          response.data.is_score === 1 ? true : false;
        this.assignmentDetails.is_ai_use =
          response.data.is_ai_use === 1 ? true : false;
        this.assignmentDetails.tags = response.data.tags || [];
        // 프로젝트/암종 정보 로드
        this.selectedProjectId = response.data.project_id ? Number(response.data.project_id) : null;
        this.selectedCancerId = response.data.cancer_type_id ? Number(response.data.cancer_type_id) : null;
      } catch (error) {
        console.error("과제 정보를 가져오는 중 오류 발생:", error);
      }
    },

    // Consensus 데이터 로드
    async fetchConsensusData() {
      try {
        const response = await this.$axios.get(
          `/api/consensus/${this.assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );
        const data = response.data;

        // Consensus 데이터를 assignmentDetails 형식에 맞게 매핑
        this.assignmentDetails.id = data.id;
        this.assignmentDetails.title = data.title;
        this.assignmentDetails.deadline = data.deadline
          ? new Date(data.deadline).toISOString().split("T")[0]
          : "";
        this.assignmentDetails.mode = data.assignment_mode || "BBox";
        this.assignmentDetails.is_score = false;
        this.assignmentDetails.is_ai_use = false;
        this.assignmentDetails.selectedAssignmentId = data.assignment_type;

        // 할당된 평가자 설정
        this.addedUsers = data.evaluators || [];

        // 프로젝트/암종 정보
        this.selectedProjectId = data.project_id ? Number(data.project_id) : null;
        this.selectedCancerId = data.cancer_type_id ? Number(data.cancer_type_id) : null;

        // fpSquares에서 이미지 목록 추출
        if (data.fpSquares && data.fpSquares.length > 0) {
          const imageSet = new Set();
          data.fpSquares.forEach((fp) => {
            if (fp.question_image) {
              imageSet.add(fp.question_image);
            }
          });

          const questions = Array.from(imageSet)
            .sort()
            .map((imageName, index) => ({
              id: index,
              img: `https://aialpa-eval.duckdns.org/api/assets/${data.assignment_type}/${encodeURIComponent(imageName)}`,
              select: null,
            }));

          this.assignmentDetails.questions = questions;
          this.activeQuestionId = questions.length > 0 ? 0 : null;
        }

        console.log("[DEBUG] fetchConsensusData - loaded:", data);
      } catch (error) {
        console.error("Consensus 정보를 가져오는 중 오류 발생:", error);
      }
    },

    // Consensus 저장
    async saveConsensus() {
      if (!this.assignmentDetails.title) {
        alert("제목을 입력해주세요.");
        return;
      }

      try {
        await this.$axios.put(
          `/api/consensus/${this.assignmentId}`,
          {
            title: this.assignmentDetails.title,
            deadline: this.assignmentDetails.deadline || null,
            evaluator_threshold: 2, // 기본값
            project_id: this.selectedProjectId,
            cancer_type_id: this.selectedCancerId,
            users: this.addedUsers.map((user) => user.id), // 평가자 목록 추가
          },
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        alert("Consensus가 저장되었습니다.");
        this.$router.push(`/consensus/${this.assignmentId}/analysis`);
      } catch (error) {
        console.error("Consensus 저장 중 오류 발생:", error);
        alert("저장 실패: " + (error.response?.data?.message || error.message));
      }
    },

    handlerDeleteQuestion(questionId) {
      // 삭제할 문제가 선택되었는지 확인
      if (questionId !== null) {
        // 삭제할 문제의 인덱스 찾기
        const questionIndex = this.assignmentDetails.questions.findIndex(
          (question) => question.id === questionId
        );

        if (questionIndex !== -1) {
          // 문제 삭제
          this.assignmentDetails.questions.splice(questionIndex, 1);

          // activeQuestionId 업데이트
          if (this.assignmentDetails.questions.length > 0) {
            if (questionIndex < this.assignmentDetails.questions.length) {
              this.activeQuestionId =
                this.assignmentDetails.questions[questionIndex].id;
            } else {
              this.activeQuestionId =
                this.assignmentDetails.questions[questionIndex - 1].id;
            }
          } else {
            this.activeQuestionId = null;
          }

          alert("이미지가 성공적으로 삭제되었습니다.");
        } else {
          alert("삭제할 이미지를 찾을 수 없습니다.");
        }
      } else {
        alert("삭제할 이미지가 선택되지 않았습니다.");
      }
    },
  },

  watch: {
    assignmentDetails: {
      handler() {
        if (this.assignmentDetails.mode === "BBox" || this.assignmentDetails.mode === "Segment") {
          this.assignmentDetails.selectedAssignmentType = "";
          this.assignmentDetails.gradingScale = null;
        }
      },
      deep: true,
    },
  },
};
</script>

<style scoped>
/* 공통 스타일 */
hr {
  margin: 0;
  border: none;
  border-top: 1px solid var(--light-gray);
}

/* 전체 컨테이너 */
.assignment-container {
  height: calc(100vh - 71px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 과제 제목 */
.assignment-title {
  margin: 0;
  height: 50px;
  display: flex;
  font-size: 20px;
  font-weight: 600;
  align-items: center;
  padding-left: 16px;
  border-bottom: 1px solid var(--light-gray);
}

/* 내용 컨테이너 */
.content-container {
  gap: 12px;
  flex: 1;
  display: flex;
  padding: 12px 16px;
  overflow: hidden;
  min-height: 0;
}

/* 유저 추가 섹션 */
.user-addition {
  display: flex;
  gap: 12px;
  flex-direction: column;
  width: 240px;
  min-width: 240px;
  flex-shrink: 0;
}

/* 라벨 */
.content-container label {
  font-weight: bold;
  font-size: 13px;
}

#user-search {
  width: 100%;
}

/* 유저 검색 박스 */
.user-search-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-search-label {
  font-size: 12px;
}

/* 그룹 선택 박스 */
.group-select-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.group-select-label {
  font-size: 12px;
  font-weight: bold;
}

.group-select {
  padding: 6px 8px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background-color: white;
}

.group-select:focus {
  outline: none;
  border-color: var(--blue);
}

/* 유저 검색 입력 */
.user-search-input {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--light-gray);
}

/* 유저 검색 입력 상자 */
.user-search-input input {
  border: none;
  padding: 6px 8px;
  box-sizing: border-box;
  font-size: 13px;
  width: 100%;
}

/* 검색 아이콘 */
.search-icon {
  color: var(--white);
  padding: 8px 10px;
  background-color: var(--blue);
  cursor: pointer;
}

/* 검색 아이콘 호버 및 액티브 */
.search-icon:hover {
  background-color: var(--blue-hover);
}

.search-icon:active {
  background-color: var(--blue-active);
}

/* 유저 리스트 */
.user-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  gap: 6px;
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
}

/* 유저 아이템 박스 */
.user-item-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 10px;
}

/* 유저 추가 및 제거 아이템 */
.user-item-add,
.user-item-added {
  padding: 3px 0;
  font-size: 13px;
}

/* 유저 토글 아이템 박스 */
.user-item-box--toggle {
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 유저 토글 아이템 */
.user-item-toggle {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
  justify-content: space-between;
  align-items: center;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.user-item-toggle:hover {
  background-color: #f5f5f5;
}

.user-item-toggle.selected {
  background-color: #e3f2fd;
  border-color: var(--blue);
}

.user-item-toggle.selected .fa-check {
  color: var(--blue);
}

.user-item-toggle .fa-plus {
  color: #999;
}

.user-item-toggle:hover .fa-plus {
  color: var(--blue);
}

/* 유저 추가 아이템 박스 (기존 호환) */
.user-item-box--add {
  overflow-y: auto;
  flex: 1;
}

/* 유저 추가 아이템 */
.user-item-add.active {
  color: var(--blue);
}

/* 유저 추가 및 제거 아이템 */
.user-item-add,
.user-item-added {
  display: flex;
  gap: 6px;
  width: 100%;
  height: fit-content;
  cursor: pointer;
  justify-content: space-between;
}

.user-item-add.disabled {
  color: var(--gray);
}

/* 유저 추가 아이템 콘텐츠 */
.user-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.user-affiliation {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

/* 이미 추가된 유저 아이템 박스 */
.user-item-box--added {
  min-height: 150px;
}

.user-item-added {
  display: flex;
}

.user-item-add:hover {
  color: var(--blue-hover);
}

.user-item-added:hover {
  color: var(--pink-hover);
}

/* 유저 수 카운트 */
.user-count {
  padding: 15px 10px 0;
  font-size: 12px;
}

.user-count strong {
  font-size: 16px;
  color: var(--blue);
}

/* 유저 추가 및 제거 아이콘 */
.fa-user-plus,
.fa-user-minus {
  cursor: pointer;
  font-size: 12px;
}

.fa-user-plus:hover,
.fa-user-plus:active {
  color: var(--blue-hover);
}

.fa-user-minus {
  color: var(--pink);
}

.fa-user-minus:hover,
.fa-user-minus:active {
  color: var(--pink-hover);
}

/* 가이드 이미지 숨기기 (공간 절약) */
.guide_container {
  display: none;
}

.guide_container_image {
  width: 100%;
}

/* 과제 추가 섹션 */
.assignment-addition {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

/* 과제 정보 섹션 */
.assignment-info {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-start;
}

/* A3: 프로젝트/암종 선택 스타일 */
.project-select-group {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--light-gray);
  border-radius: 6px;
  background-color: #fafafa;
}

.project-select-group .select-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.project-select-group .select-label {
  font-weight: bold;
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.project-select-group select {
  padding: 6px 10px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
  cursor: pointer;
}

.project-select-group select:disabled {
  background-color: #f0f0f0;
  cursor: not-allowed;
}

/* 선택 + 추가 버튼 래퍼 */
.select-with-add {
  display: flex;
  gap: 4px;
}

.select-with-add select {
  flex: 1;
}

.add-inline-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--blue);
  border-radius: 4px;
  background-color: var(--blue);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.add-inline-btn:hover:not(:disabled) {
  background-color: var(--blue-hover);
}

.add-inline-btn:disabled {
  background-color: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}

.delete-inline-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #dc3545;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.delete-inline-btn:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #c82333;
}

.delete-inline-btn:disabled {
  background-color: #ccc;
  border-color: #ccc;
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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-modal h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 600;
}

.confirm-modal p {
  margin: 8px 0;
  font-size: 13px;
  color: #666;
}

.confirm-modal .warning-text {
  color: #dc3545;
  font-size: 12px;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.delete-confirm-btn {
  padding: 8px 20px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.delete-confirm-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.delete-confirm-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 인라인 모달 스타일 */
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

.inline-modal {
  background-color: white;
  border-radius: 8px;
  width: 360px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.inline-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--light-gray);
}

.inline-modal .modal-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.inline-modal .close-btn {
  background: none;
  border: none;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  padding: 0;
}

.inline-modal .close-btn:hover {
  color: #333;
}

.inline-modal .modal-body {
  padding: 16px;
}

.inline-modal .form-group {
  margin-bottom: 14px;
}

.inline-modal .form-group:last-child {
  margin-bottom: 0;
}

.inline-modal .form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.inline-modal .form-group input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.inline-modal .form-group input:focus {
  outline: none;
  border-color: var(--blue);
}

.inline-modal .disabled-input {
  background-color: #f5f5f5;
  color: #666;
}

.inline-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--light-gray);
}

.inline-modal .cancel-btn {
  padding: 8px 16px;
  background-color: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.inline-modal .cancel-btn:hover {
  background-color: #e0e0e0;
}

.inline-modal .save-btn {
  padding: 8px 16px;
  background-color: var(--blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline-modal .save-btn:hover:not(:disabled) {
  background-color: var(--blue-hover);
}

.inline-modal .save-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.inline-modal .hint-text {
  margin: 0;
  font-size: 11px;
  color: #888;
  font-style: italic;
}

/* A1: 평가 유형 그룹 스타일 */
.mode-group,
.options-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--light-gray);
  border-radius: 6px;
  background-color: #fafafa;
  position: relative;
}

/* Consensus 모드일 때 비활성화 스타일 */
.mode-group--disabled {
  pointer-events: none;
}

.mode-group--disabled .mode-options {
  opacity: 0.5;
}

.mode-disabled-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.mode-disabled-overlay span {
  color: white;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  padding: 8px 12px;
}

.group-label {
  font-weight: bold;
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mode-options,
.option-items {
  display: flex;
  gap: 6px;
}

.mode-option,
.option-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border: 2px solid var(--light-gray);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
  min-width: 50px;
}

.mode-option input,
.option-item input {
  display: none;
}

.mode-option i,
.option-item i {
  font-size: 16px;
  color: #888;
  transition: color 0.2s ease;
}

.mode-option span,
.option-item span {
  font-size: 11px;
  font-weight: 500;
  color: #666;
}

/* A3: 아이콘 색상 통일 - On 상태 */
.mode-option.active,
.option-item.active {
  border-color: var(--blue);
  background-color: var(--blue);
}

.mode-option.active i,
.option-item.active i {
  color: white;
}

.mode-option.active span,
.option-item.active span {
  color: white;
}

/* Hover 효과 */
.mode-option:hover:not(.active),
.option-item:hover:not(.active) {
  border-color: var(--blue);
  background-color: #f0f7ff;
}

.mode-option:hover:not(.active) i,
.option-item:hover:not(.active) i {
  color: var(--blue);
}

/* A3: 해시태그 입력 */
.tag-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-label {
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}

.tag-input-container {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  background-color: white;
  min-height: 34px;
  align-items: center;
}

.selected-tags:focus-within {
  border-color: var(--blue);
  box-shadow: 0 0 4px var(--blue);
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: white;
  background-color: var(--blue);
  white-space: nowrap;
}

.tag-badge i {
  cursor: pointer;
  font-size: 10px;
  opacity: 0.8;
}

.tag-badge i:hover {
  opacity: 1;
}

.tag-text-input {
  border: none;
  outline: none;
  padding: 4px 6px;
  font-size: 13px;
  min-width: 140px;
  flex: 1;
}

.tag-text-input::placeholder {
  color: #999;
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-top: 2px;
}

.tag-suggestion-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.tag-suggestion-item:hover {
  background-color: #f5f5f5;
}

.suggestion-name {
  color: #333;
}

.suggestion-count {
  color: #999;
  font-size: 11px;
}

/* 과제 필드 */
.assignment-field {
  display: flex;
  gap: 6px;
  white-space: nowrap;
  align-items: center;
  font-size: 13px;
}

/* 과제 필드 입력 */
.assignment-field input,
.assignment-field select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  box-sizing: border-box;
  height: 34px;
  font-size: 13px;
  min-width: 120px;
  max-width: 200px;
}

.assignment-field button {
  padding: 6px 12px;
  font-size: 12px;
  height: 34px;
}

.assignment-field-select {
  display: flex;
  white-space: nowrap;
}

/* 과제 미리보기 */
.assignment-preview {
  flex: 1;
  border: 1px solid var(--light-gray);
  display: flex;
  border-radius: 4px;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* 과제 미리보기 머리글 */
.assignment-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  height: 40px;
  flex-shrink: 0;
}

/* 과제 메타데이터 */
.assignment-metadata {
  width: 100%;
  display: flex;
  align-items: center;
  padding-left: 12px;
  gap: 12px;
}

.metadata-assignment-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.metadata-student-name {
  font-size: 12px;
}

.metadata-due-date {
  font-size: 12px;
  color: #666;
}

.delete-question-button {
  background-color: var(--pink);
  padding: 4px 10px;
  font-size: 12px;
}

.delete-question-button:hover {
  background-color: var(--pink-hover);
}

/* 평가 액션 */
.evaluation-actions {
  display: flex;
  align-items: center;
  margin-right: 12px;
  gap: 12px;
}

/* 과제 미리보기 내용 */
.assignment-preview-content {
  padding: 10px;
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}

/* 과제 저장 버튼 */
.assignment-save {
  padding: 6px;
  display: flex;
  justify-content: center;
  gap: 10px;
  border-top: 1px solid var(--light-gray);
  flex-shrink: 0;
}

.assignment-save button {
  padding: 6px 16px;
  font-size: 13px;
}

/* 점수 테이블 이미지 */
td > img {
  width: 20px;
}

/* 점수 테이블 */
.grades-table {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 0 0 auto;
  max-width: 200px;
  border: 1px solid var(--light-gray);
}

/* 테이블 */
table {
  width: 100%;
  border-collapse: collapse;
}

/* 머리글 */
thead {
  position: sticky;
  top: 0;
  background-color: var(--ultra-light-gray);
}

/* 테이블 행 호버 */
tbody tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}

/* 셀 */
th,
td {
  padding: 4px 6px;
  text-align: center;
  border-bottom: 1px solid var(--light-gray);
  font-size: 12px;
}

/* 활성 테이블 행 */
tbody tr.active {
  background-color: var(--blue);
}

/* 학생 응답 이미지 */
.student-response-image {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* 학생 응답 이미지 크기 조정 */
.student-response-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* 전체 화면 아이콘 */
.fa-expand {
  position: absolute;
  bottom: 12px;
  right: 12px;
  color: var(--white);
  background-color: var(--black);
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
}

/* 전체 화면 아이콘 호버 */
.fa-expand:hover {
  max-height: fit-content;
}
</style>
