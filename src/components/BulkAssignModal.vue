<!-- BulkAssignModal.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h2>평가자 일괄 할당</h2>
        <button class="close-btn" @click="$emit('close')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body">
        <p class="info-text">
          <template v-if="assignmentIds.length > 0 && regularAssignmentIds.length > 0">
            Consensus {{ assignmentIds.length }}개 + 일반 과제 {{ regularAssignmentIds.length }}개에 평가자를 할당합니다.
          </template>
          <template v-else-if="assignmentIds.length > 0">
            {{ assignmentIds.length }}개의 Consensus 과제에 평가자를 할당합니다.
          </template>
          <template v-else>
            {{ regularAssignmentIds.length }}개의 과제에 평가자를 할당합니다.
          </template>
        </p>

        <!-- 탭 전환 -->
        <div class="tab-buttons">
          <button
            :class="{ active: activeTab === 'individual' }"
            @click="activeTab = 'individual'"
          >
            개별 선택
          </button>
          <button
            :class="{ active: activeTab === 'group' }"
            @click="activeTab = 'group'"
          >
            그룹 선택
          </button>
        </div>

        <!-- 개별 선택 탭 -->
        <div v-if="activeTab === 'individual'" class="tab-content">
          <div class="user-list">
            <label
              v-for="user in users"
              :key="user.id"
              class="user-item"
              :class="{ selected: selectedUserIds.includes(user.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedUserIds.includes(user.id)"
                @change="toggleUser(user.id)"
              />
              <span class="user-info">
                <span class="user-name">{{ user.realname }}</span>
                <span class="user-org">{{ user.organization || '-' }}</span>
              </span>
            </label>
          </div>
        </div>

        <!-- 그룹 선택 탭 -->
        <div v-if="activeTab === 'group'" class="tab-content">
          <div v-if="groups.length === 0" class="empty-message">
            등록된 그룹이 없습니다.
            <button class="create-group-btn" @click="showGroupForm = true">
              새 그룹 만들기
            </button>
          </div>

          <div v-else class="group-list">
            <div
              v-for="group in groups"
              :key="group.id"
              class="group-item"
              :class="{ selected: selectedGroupId === group.id }"
              @click="selectGroup(group)"
            >
              <div class="group-header">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-count">{{ group.member_count }}명</span>
              </div>
              <div class="group-members">
                {{ group.members.map(m => m.realname).join(', ') }}
              </div>
            </div>
          </div>

          <button class="create-group-btn" @click="showGroupForm = true">
            <i class="fa-solid fa-plus"></i> 새 그룹 만들기
          </button>
        </div>

        <!-- 그룹 생성/수정 폼 -->
        <div v-if="showGroupForm" class="group-form-overlay">
          <div class="group-form">
            <h3>{{ editingGroup ? '그룹 수정' : '새 그룹 만들기' }}</h3>
            <div class="form-group">
              <label>그룹 이름</label>
              <input
                type="text"
                v-model="groupForm.name"
                placeholder="예: A그룹"
              />
            </div>
            <div class="form-group">
              <label>설명 (선택)</label>
              <input
                type="text"
                v-model="groupForm.description"
                placeholder="예: 방광암 전문 평가자 그룹"
              />
            </div>
            <div class="form-group">
              <label>멤버 선택</label>
              <div class="user-list compact">
                <label
                  v-for="user in users"
                  :key="user.id"
                  class="user-item"
                  :class="{ selected: groupForm.memberIds.includes(user.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="groupForm.memberIds.includes(user.id)"
                    @change="toggleGroupMember(user.id)"
                  />
                  <span class="user-name">{{ user.realname }}</span>
                </label>
              </div>
            </div>
            <div class="form-actions">
              <button class="cancel-btn" @click="closeGroupForm">취소</button>
              <button class="save-btn" @click="saveGroup" :disabled="!groupForm.name">
                {{ editingGroup ? '수정' : '저장' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 선택된 평가자 요약 -->
        <div class="selected-summary" v-if="selectedUserIds.length > 0">
          <strong>선택된 평가자 ({{ selectedUserIds.length }}명):</strong>
          {{ selectedUserNames.join(', ') }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" @click="$emit('close')">취소</button>
        <button
          class="assign-btn"
          @click="bulkAssign"
          :disabled="selectedUserIds.length === 0 || isLoading"
        >
          <i v-if="isLoading" class="fa-solid fa-spinner fa-spin"></i>
          <span v-else>할당하기</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "BulkAssignModal",

  props: {
    assignmentIds: {
      type: Array,
      required: true,
      default: () => [],
    },
    regularAssignmentIds: {
      type: Array,
      default: () => [],
    },
  },

  emits: ["close", "assigned"],

  data() {
    return {
      activeTab: "individual",
      users: [],
      groups: [],
      selectedUserIds: [],
      selectedGroupId: null,
      isLoading: false,
      showGroupForm: false,
      editingGroup: null,
      groupForm: {
        name: "",
        description: "",
        memberIds: [],
      },
    };
  },

  computed: {
    selectedUserNames() {
      return this.selectedUserIds
        .map((id) => {
          const user = this.users.find((u) => u.id === id);
          return user ? user.realname : "";
        })
        .filter((name) => name);
    },
  },

  async mounted() {
    await Promise.all([this.fetchUsers(), this.fetchGroups()]);
  },

  methods: {
    async fetchUsers() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/users", { headers });
        this.users = response.data.filter((u) => u.role !== "admin");
      } catch (error) {
        console.error("사용자 목록 조회 오류:", error);
      }
    },

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

    toggleUser(userId) {
      const index = this.selectedUserIds.indexOf(userId);
      if (index > -1) {
        this.selectedUserIds.splice(index, 1);
      } else {
        this.selectedUserIds.push(userId);
      }
      this.selectedGroupId = null;
    },

    selectGroup(group) {
      if (this.selectedGroupId === group.id) {
        this.selectedGroupId = null;
        this.selectedUserIds = [];
      } else {
        this.selectedGroupId = group.id;
        this.selectedUserIds = group.members.map((m) => m.id);
      }
    },

    toggleGroupMember(userId) {
      const index = this.groupForm.memberIds.indexOf(userId);
      if (index > -1) {
        this.groupForm.memberIds.splice(index, 1);
      } else {
        this.groupForm.memberIds.push(userId);
      }
    },

    closeGroupForm() {
      this.showGroupForm = false;
      this.editingGroup = null;
      this.groupForm = {
        name: "",
        description: "",
        memberIds: [],
      };
    },

    async saveGroup() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.editingGroup) {
          await this.$axios.put(
            `/api/consensus/groups/${this.editingGroup.id}`,
            {
              name: this.groupForm.name,
              description: this.groupForm.description,
              member_ids: this.groupForm.memberIds,
            },
            { headers }
          );
        } else {
          await this.$axios.post(
            "/api/consensus/groups",
            {
              name: this.groupForm.name,
              description: this.groupForm.description,
              member_ids: this.groupForm.memberIds,
            },
            { headers }
          );
        }

        this.closeGroupForm();
        await this.fetchGroups();
      } catch (error) {
        console.error("그룹 저장 오류:", error);
        alert("그룹 저장 중 오류가 발생했습니다.");
      }
    },

    async bulkAssign() {
      if (this.selectedUserIds.length === 0) {
        alert("평가자를 선택해주세요.");
        return;
      }

      this.isLoading = true;

      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        let successCount = 0;
        let errorCount = 0;

        // Consensus 과제 일괄 할당
        if (this.assignmentIds.length > 0) {
          try {
            await this.$axios.put(
              "/api/consensus/bulk-assign",
              {
                assignment_ids: this.assignmentIds,
                user_ids: this.selectedUserIds,
              },
              { headers }
            );
            successCount += this.assignmentIds.length;
          } catch (error) {
            console.error("Consensus 일괄 할당 오류:", error);
            errorCount += this.assignmentIds.length;
          }
        }

        // 일반 과제 개별 할당 (각 과제마다 API 호출)
        for (const assignmentId of this.regularAssignmentIds) {
          try {
            // 기존 과제 정보 조회
            const assignmentRes = await this.$axios.get(
              `/api/assignments/${assignmentId}/all`,
              { headers }
            );

            // 평가자 목록 업데이트
            await this.$axios.put(
              `/api/assignments/edit/${assignmentId}`,
              {
                ...assignmentRes.data,
                users: this.selectedUserIds,
              },
              { headers }
            );
            successCount++;
          } catch (error) {
            console.error(`과제 ${assignmentId} 할당 오류:`, error);
            errorCount++;
          }
        }

        const totalCount = this.assignmentIds.length + this.regularAssignmentIds.length;
        if (errorCount === 0) {
          alert(`${totalCount}개 과제에 ${this.selectedUserIds.length}명의 평가자가 할당되었습니다.`);
        } else {
          alert(`${successCount}개 과제 할당 성공, ${errorCount}개 과제 할당 실패`);
        }

        this.$emit("assigned");
      } catch (error) {
        console.error("일괄 할당 오류:", error);
        alert("일괄 할당 중 오류가 발생했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
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
  background: white;
  border-radius: 8px;
  width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 4px;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.info-text {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
}

.tab-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-buttons button {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tab-buttons button.active {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
}

.tab-buttons button:hover:not(.active) {
  background: #f5f5f5;
}

.tab-content {
  min-height: 200px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px;
}

.user-list.compact {
  max-height: 150px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-item:hover {
  background: #f5f5f5;
}

.user-item.selected {
  background: #e3f2fd;
}

.user-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--blue);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.user-org {
  font-size: 12px;
  color: #888;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.group-item {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-item:hover {
  border-color: var(--blue);
}

.group-item.selected {
  border-color: var(--blue);
  background: #e3f2fd;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.group-name {
  font-weight: 600;
  font-size: 14px;
}

.group-count {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.group-members {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-message {
  text-align: center;
  color: #888;
  padding: 30px;
}

.create-group-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1px dashed #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
  margin-top: 8px;
}

.create-group-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.group-form-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.group-form {
  width: 100%;
}

.group-form h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: var(--blue);
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.selected-summary {
  margin-top: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #f5f5f5;
}

.save-btn,
.assign-btn {
  padding: 10px 20px;
  border: none;
  background: var(--blue);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-btn:hover,
.assign-btn:hover {
  background: var(--blue-hover);
}

.save-btn:disabled,
.assign-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
