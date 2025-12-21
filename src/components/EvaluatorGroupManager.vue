<!-- EvaluatorGroupManager.vue -->
<!-- 평가자 그룹 관리 컴포넌트 -->
<template>
  <div class="evaluator-group-manager">
    <div class="manager-header">
      <h3><i class="fas fa-users-cog"></i> 평가자 그룹 관리</h3>
      <button class="add-group-btn" @click="showCreateForm">
        <i class="fas fa-plus"></i> 새 그룹
      </button>
    </div>

    <div class="manager-body">
      <!-- 그룹 목록 -->
      <div v-if="loading" class="loading">
        <i class="fas fa-spinner fa-spin"></i> 로딩 중...
      </div>

      <div v-else-if="groups.length === 0" class="empty-state">
        <i class="fas fa-users"></i>
        <p>등록된 평가자 그룹이 없습니다.</p>
        <button class="create-btn" @click="showCreateForm">
          첫 번째 그룹 만들기
        </button>
      </div>

      <div v-else class="group-list">
        <div
          v-for="group in groups"
          :key="group.id"
          class="group-card"
          :class="{ expanded: expandedGroupId === group.id }"
        >
          <div class="group-card-header" @click="toggleExpand(group.id)">
            <div class="group-info">
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ group.member_count }}명</span>
            </div>
            <div class="group-actions">
              <button
                class="action-btn edit-btn"
                @click.stop="editGroup(group)"
                title="수정"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                class="action-btn delete-btn"
                @click.stop="confirmDelete(group)"
                title="삭제"
              >
                <i class="fas fa-trash"></i>
              </button>
              <i
                :class="[
                  'expand-icon',
                  'fas',
                  expandedGroupId === group.id ? 'fa-chevron-up' : 'fa-chevron-down',
                ]"
              ></i>
            </div>
          </div>

          <div v-if="expandedGroupId === group.id" class="group-card-body">
            <div v-if="group.description" class="group-description">
              {{ group.description }}
            </div>
            <div class="member-list">
              <span
                v-for="member in group.members"
                :key="member.id"
                class="member-tag"
              >
                {{ member.realname }}
                <span v-if="member.organization" class="member-org"
                  >({{ member.organization }})</span
                >
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 그룹 생성/수정 모달 -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-container">
        <div class="modal-header">
          <h4>{{ editingGroup ? '그룹 수정' : '새 그룹 만들기' }}</h4>
          <button class="close-btn" @click="closeForm">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>그룹 이름 *</label>
            <input
              type="text"
              v-model="formData.name"
              placeholder="예: A그룹, 방광암 전문팀"
              maxlength="50"
            />
          </div>

          <div class="form-group">
            <label>설명</label>
            <input
              type="text"
              v-model="formData.description"
              placeholder="그룹에 대한 설명 (선택사항)"
              maxlength="200"
            />
          </div>

          <div class="form-group">
            <label>멤버 선택 ({{ formData.memberIds.length }}명 선택됨)</label>
            <div class="member-select-list">
              <label
                v-for="user in users"
                :key="user.id"
                class="member-select-item"
                :class="{ selected: formData.memberIds.includes(user.id) }"
              >
                <input
                  type="checkbox"
                  :checked="formData.memberIds.includes(user.id)"
                  @change="toggleMember(user.id)"
                />
                <span class="member-name">{{ user.realname }}</span>
                <span class="member-org">{{ user.organization || '-' }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeForm">취소</button>
          <button
            class="save-btn"
            @click="saveGroup"
            :disabled="!formData.name || formData.memberIds.length === 0 || saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <span v-else>{{ editingGroup ? '수정' : '저장' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="confirm-modal">
        <h4>그룹 삭제 확인</h4>
        <p>
          '<strong>{{ deleteTarget.name }}</strong>' 그룹을 삭제하시겠습니까?
        </p>
        <p class="warning-text">이 작업은 되돌릴 수 없습니다.</p>
        <div class="confirm-actions">
          <button class="cancel-btn" @click="deleteTarget = null">취소</button>
          <button class="delete-btn" @click="deleteGroup" :disabled="deleting">
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
  name: "EvaluatorGroupManager",

  data() {
    return {
      groups: [],
      users: [],
      loading: false,
      saving: false,
      deleting: false,
      showForm: false,
      editingGroup: null,
      deleteTarget: null,
      expandedGroupId: null,
      formData: {
        name: "",
        description: "",
        memberIds: [],
      },
    };
  },

  async mounted() {
    await Promise.all([this.fetchGroups(), this.fetchUsers()]);
  },

  methods: {
    async fetchGroups() {
      this.loading = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/consensus/groups/list", { headers });
        this.groups = response.data;
      } catch (error) {
        console.error("그룹 목록 조회 오류:", error);
      } finally {
        this.loading = false;
      }
    },

    async fetchUsers() {
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        const response = await this.$axios.get("/api/auth/user-list/", { headers });
        this.users = response.data.filter((u) => u.role !== "admin");
      } catch (error) {
        console.error("사용자 목록 조회 오류:", error);
      }
    },

    toggleExpand(groupId) {
      this.expandedGroupId = this.expandedGroupId === groupId ? null : groupId;
    },

    showCreateForm() {
      this.editingGroup = null;
      this.formData = {
        name: "",
        description: "",
        memberIds: [],
      };
      this.showForm = true;
    },

    editGroup(group) {
      this.editingGroup = group;
      this.formData = {
        name: group.name,
        description: group.description || "",
        memberIds: group.members.map((m) => m.id),
      };
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingGroup = null;
      this.formData = {
        name: "",
        description: "",
        memberIds: [],
      };
    },

    toggleMember(userId) {
      const index = this.formData.memberIds.indexOf(userId);
      if (index > -1) {
        this.formData.memberIds.splice(index, 1);
      } else {
        this.formData.memberIds.push(userId);
      }
    },

    async saveGroup() {
      if (!this.formData.name || this.formData.memberIds.length === 0) {
        return;
      }

      this.saving = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };

        if (this.editingGroup) {
          await this.$axios.put(
            `/api/consensus/groups/${this.editingGroup.id}`,
            {
              name: this.formData.name,
              description: this.formData.description,
              member_ids: this.formData.memberIds,
            },
            { headers }
          );
        } else {
          await this.$axios.post(
            "/api/consensus/groups",
            {
              name: this.formData.name,
              description: this.formData.description,
              member_ids: this.formData.memberIds,
            },
            { headers }
          );
        }

        this.closeForm();
        await this.fetchGroups();
      } catch (error) {
        console.error("그룹 저장 오류:", error);
        alert("그룹 저장 중 오류가 발생했습니다.");
      } finally {
        this.saving = false;
      }
    },

    confirmDelete(group) {
      this.deleteTarget = group;
    },

    async deleteGroup() {
      if (!this.deleteTarget) return;

      this.deleting = true;
      try {
        const headers = {
          Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
        };
        await this.$axios.delete(`/api/consensus/groups/${this.deleteTarget.id}`, { headers });
        this.deleteTarget = null;
        await this.fetchGroups();
      } catch (error) {
        console.error("그룹 삭제 오류:", error);
        alert("그룹 삭제 중 오류가 발생했습니다.");
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style scoped>
.evaluator-group-manager {
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.manager-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-group-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: var(--blue, #007bff);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.add-group-btn:hover {
  background: #0056b3;
}

.manager-body {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}

.empty-state i {
  font-size: 40px;
  margin-bottom: 16px;
  color: #ddd;
}

.empty-state p {
  margin: 0 0 16px 0;
}

.create-btn {
  padding: 10px 20px;
  border: 1px dashed #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.create-btn:hover {
  border-color: var(--blue, #007bff);
  color: var(--blue, #007bff);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.group-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.group-card.expanded {
  border-color: var(--blue, #007bff);
}

.group-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  cursor: pointer;
}

.group-card-header:hover {
  background: #f0f0f0;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-name {
  font-weight: 600;
  font-size: 14px;
}

.group-count {
  font-size: 12px;
  color: #666;
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 10px;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  padding: 6px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
}

.action-btn:hover {
  background: #e9ecef;
}

.edit-btn {
  color: #1976d2;
}

.delete-btn {
  color: #dc3545;
}

.expand-icon {
  color: #888;
  font-size: 12px;
  margin-left: 8px;
}

.group-card-body {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
}

.group-description {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  font-style: italic;
}

.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-tag {
  background: #e3f2fd;
  color: #1565c0;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
}

.member-org {
  color: #888;
  font-size: 11px;
}

/* 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 450px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #888;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
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
  border-color: var(--blue, #007bff);
}

.member-select-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
}

.member-select-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
}

.member-select-item:hover {
  background: #f5f5f5;
}

.member-select-item.selected {
  background: #e3f2fd;
}

.member-select-item input {
  width: 16px;
  height: 16px;
  accent-color: var(--blue, #007bff);
}

.member-name {
  font-size: 14px;
  flex: 1;
}

.member-org {
  font-size: 12px;
  color: #888;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
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

.save-btn {
  padding: 10px 20px;
  border: none;
  background: var(--blue, #007bff);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-btn:hover:not(:disabled) {
  background: #0056b3;
}

.save-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 삭제 확인 모달 */
.confirm-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 350px;
  text-align: center;
}

.confirm-modal h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.confirm-modal p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.warning-text {
  color: #dc3545;
  font-size: 12px;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.confirm-actions .delete-btn {
  padding: 10px 20px;
  border: none;
  background: #dc3545;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.confirm-actions .delete-btn:hover:not(:disabled) {
  background: #c82333;
}

.confirm-actions .delete-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
