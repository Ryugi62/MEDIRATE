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
          <div class="mode-group">
            <span class="group-label">평가 유형</span>
            <div class="mode-options">
              <label class="mode-option" :class="{ active: assignmentDetails.mode === 'TextBox' }">
                <input
                  type="radio"
                  id="field-text-mode"
                  name="mode"
                  value="TextBox"
                  v-model="assignmentDetails.mode"
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
                />
                <i class="fas fa-draw-polygon"></i>
                <span>Segment</span>
              </label>
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

          <div
            v-for="(field, fieldName) in assignmentFields"
            :key="fieldName"
            class="assignment-field"
          >
            <!-- 만약 mode가 BBox 또는 Segment면 선택 유형 입력창은 출력하지 않는다. -->
            <template
              v-if="
                !(
                  fieldName === 'assignment-type' &&
                  (assignmentDetails.mode === 'BBox' || assignmentDetails.mode === 'Segment')
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
                    <th>문제</th>
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
    await this.fetchUserList();
    await this.fetchFolderList();
    if (this.isEditMode) {
      await this.fetchAssignmentData();
    }
  },

  components: {
    ImageComponent,
  },

  computed: {
    isEditMode() {
      return !!this.$route.params.id;
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
  },
  methods: {
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

      const today = new Date();
      const deadline = new Date(this.assignmentDetails.deadline);
      deadline.setHours(0, 0, 0, 0);
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (deadline < tomorrow) {
        alert("마감일은 내일 이상으로 지정해야 합니다.");
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
      };

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
        this.assignmentDetails.mode = response.data.assigment_mode;
        this.assignmentDetails.is_score =
          response.data.is_score === 1 ? true : false;
        this.assignmentDetails.is_ai_use =
          response.data.is_ai_use === 1 ? true : false;
      } catch (error) {
        console.error("과제 정보를 가져오는 중 오류 발생:", error);
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

          alert("문제가 성공적으로 삭제되었습니다.");
        } else {
          alert("삭제할 문제를 찾을 수 없습니다.");
        }
      } else {
        alert("삭제할 문제가 선택되지 않았습니다.");
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
  width: 100%;
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
}

.user-affiliation {
  font-size: 11px;
  color: #666;
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
  padding: 0 10px;
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
