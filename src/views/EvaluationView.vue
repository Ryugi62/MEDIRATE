<template>
  <div class="assignment-container">
    <h1 class="assignment-title">과제 관리</h1>

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
          <div class="user-item-box user-item-box--add">
            <div
              v-for="user in filteredUserList"
              :key="user.id"
              @click="addUser(user)"
              :class="['user-item-add', { active: isUserAdded(user) }]"
            >
              <div class="user-item-content">
                <span class="user-name">{{ user.realname.trim() }}</span>
                <span class="user-affiliation">{{ user.username }}</span>
              </div>
              <i class="fa-solid fa-user-plus"></i>
            </div>
          </div>
          <hr />
          <span class="user-count"
            >{{ addedUsers.length }} / {{ maxUserCount }}</span
          >
          <div class="user-item-box user-item-box--added">
            <div
              v-for="(user, index) in addedUsers"
              :key="user.id"
              class="user-item-added"
            >
              <div class="user-item-content">
                <span class="user-name">{{ user.realname.trim() }}</span>
                <span class="user-affiliation">{{ user.username }}</span>
              </div>
              <i class="fa-solid fa-user-minus" @click="removeUser(index)"></i>
            </div>
          </div>
        </div>
      </div>
      <div class="assignment-addition">
        <div class="assignment-info">
          <div class="assignment-field mode-field">
            <span>
              <label for="field-text-mode">TextBox</label>
              <input
                type="radio"
                id="field-text-mode"
                name="mode"
                value="TextBox"
                v-model="assignmentDetails.mode"
              />
            </span>
            <span>
              <label for="field-bbox-mode">BBox</label>
              <input
                type="radio"
                id="field-bbox-mode"
                name="mode"
                value="BBox"
                v-model="assignmentDetails.mode"
              />
            </span>
          </div>

          <div
            v-for="(field, fieldName) in assignmentFields"
            :key="fieldName"
            class="assignment-field"
          >
            <!-- 만약 mode가 bbox면 선택 유형 입력창은 출력하지 않는다. -->
            <template
              v-if="
                !(
                  fieldName === 'assignment-type' &&
                  assignmentDetails.mode === 'BBox'
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
                  :key="folder.id"
                  :value="folder.id"
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
                :src="assignmentDetails.questions[activeQuestionId]?.img"
              />
            </div>
          </div>
          <div class="assignment-save">
            <button @click="saveAssignment">저장</button>
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
        mode: "TextBox",
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

  mounted() {
    this.fetchUserList();
    this.fetchFolderList();
  },

  components: {
    ImageComponent,
  },

  computed: {
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
          console.log(this.folderList);
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
    addUser(user) {
      if (
        this.addedUsers.length < this.maxUserCount &&
        !this.isUserAdded(user)
      ) {
        this.addedUsers.push(user);
      } else {
        alert("최대 유저 수를 초과하였거나 이미 추가된 유저입니다.");
      }
    },
    removeUser(index) {
      this.addedUsers.splice(index, 1);
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

      if (this.assignmentDetails.id) {
        alert("과제 변경사항을 저장합니다");
      } else {
        alert("새로운 과제를 생성합니다");

        const newAssignment = {
          title: this.assignmentDetails.title,
          deadline: this.assignmentDetails.deadline,
          assignment_type: this.assignmentDetails.selectedAssignmentId,
          selection_type: this.assignmentDetails.selectedAssignmentType,
          questions: this.assignmentDetails.questions,
          users: this.addedUsers.map((user) => user.id),
          mode: this.assignmentDetails.mode,
        };

        this.$axios
          .post("/api/assignments/", newAssignment, {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          })
          .then((response) => {
            response.data;

            this.$router.push({ name: "assignment" });
          })
          .catch((error) => {
            console.error("새로운 과제 생성 중 오류 발생:", error);
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

      if (
        !this.folderList.includes(this.assignmentDetails.selectedAssignmentId)
      ) {
        alert(
          `해당 과제 ID가 존재하지 않습니다.\n\n가능한 과제 ID는 다음과 같습니다:${this.folderList.join(
            ", "
          )}`
        );
        return;
      }

      this.$axios
        .get(`/api/assets/${this.assignmentDetails.selectedAssignmentId}`)
        .then((response) => {
          const imageList = response.data;
          const rout = `/api/assets/${this.assignmentDetails.selectedAssignmentId}`;

          const questions = imageList.map((image, index) => {
            return {
              id: index,
              img: `https://aialpa-eval.duckdns.org${rout}/${image}`,
              select: null,
            };
          });

          this.assignmentDetails.questions = questions;
        })
        .catch((error) => {
          console.error(
            "해당 폴더의 이미지 리스트를 가져오는 중 오류 발생:",
            error
          );
        });
    },

    fetchUserList() {
      this.$axios
        .post("/api/assignments/user-list")
        .then((response) => {
          this.userList = response.data;
        })
        .catch((error) => {
          console.error("유저 정보를 가져오는 중 오류 발생:", error);
        });
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
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 1500px;
}

/* 과제 제목 */
.assignment-title {
  margin: 0;
  height: 60px;
  display: flex;
  font-size: 24px;
  font-weight: 500;
  align-items: center;
  padding-left: 24px;
  border-bottom: 1px solid var(--light-gray);
}

/* 내용 컨테이너 */
.content-container {
  gap: 16px;
  flex: 1;
  display: flex;
  padding: 16px;
  padding-left: 24px;
  padding-right: 46px;
}

/* 유저 추가 섹션 */
.user-addition {
  display: flex;
  gap: 16px;
  flex-direction: column;
}

/* 라벨 */
.content-container label {
  font-weight: bold;
}

/* 유저 검색 박스 */
.user-search-box {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
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
  padding: 8px;
  box-sizing: border-box;
}

/* 검색 아이콘 */
.search-icon {
  color: var(--white);
  padding: 12px;
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
  gap: 8px;
  overflow-y: auto;
  max-height: 676px;
}

/* 유저 아이템 박스 */
.user-item-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 16px;
}

/* 유저 추가 및 제거 아이템 */
.user-item-add,
.user-item-added {
  padding: 4px 0;
}

/* 유저 추가 아이템 박스 */
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
  gap: 8px;
  width: 100%;
  height: fit-content;
  justify-content: space-between;
}

.user-item-add.disabled {
  color: var(--gray);
}

/* 유저 추가 아이템 콘텐츠 */
.user-item-content {
  display: flex;
  gap: 16px;
}

/* 이미 추가된 유저 아이템 박스 */
.user-item-box--added {
  min-height: 212px;
}

.user-item-added {
  display: flex;
}

/* 유저 수 카운트 */
.user-count {
  padding: 0 16px;
  font-size: 14px;
}

.user-count strong {
  font-size: 20px;
  color: var(--blue);
}

/* 유저 추가 및 제거 아이콘 */
.fa-user-plus,
.fa-user-minus {
  cursor: pointer;
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

/* 과제 추가 섹션 */
.assignment-addition {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 과제 정보 섹션 */
.assignment-info {
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

/* 과제 필드 */
.assignment-field {
  display: flex;
  flex: 1;
  gap: 8px;
  text-wrap: nowrap;
  align-items: center;
}

.mode-field {
  flex: 0;

  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

/* 과제 필드 입력 */
.assignment-field input,
.assignment-field select {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--light-gray);
  border-radius: 4px;
  box-sizing: border-box;
  height: 42px;
}

.assignment-field-select {
  display: flex;
  text-wrap: nowrap;
}

/* 과제 미리보기 */
.assignment-preview {
  flex: 1;
  border: 1px solid var(--light-gray);
  display: flex;
  border-radius: 4px;
  flex-direction: column;
}

/* 과제 미리보기 머리글 */
.assignment-overview {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--light-gray);
  height: 60px;
}

/* 과제 메타데이터 */
.assignment-metadata {
  display: flex;
  align-items: center;
  padding-left: 16px;
  gap: 16px;
}

.metadata-assignment-title {
  margin: 0;
  font-size: 20px;
}

.metadata-student-name {
  font-size: 14px;
}

.metadata-due-date {
  font-size: 14px;
}

/* 평가 액션 */
.evaluation-actions {
  display: flex;
  align-items: center;
  margin-right: 16px;
  gap: 16px;
}

/* 과제 미리보기 내용 */
.assignment-preview-content {
  padding: 16px;
  flex: 1;
  display: flex;
  gap: 16px;
}

/* 과제 저장 버튼 */
.assignment-save {
  padding: 8px;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--light-gray);
}

/* 점수 테이블 이미지 */
td > img {
  width: 25px;
}

/* 점수 테이블 */
.grades-table {
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 528px;
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
}

/* 셀 */
th,
td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid var(--light-gray);
}

/* 활성 테이블 행 */
tbody tr.active {
  background-color: var(--blue);
}

/* 학생 응답 이미지 */
.student-response-image {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 100%;
}

/* 학생 응답 이미지 크기 조정 */
.student-response-image img {
  width: fit-content;
  width: 100%;
  object-fit: contain;
  max-height: 530px;
}

/* 전체 화면 아이콘 */
.fa-expand {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: var(--white);
  background-color: var(--black);
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
}

/* 전체 화면 아이콘 호버 */
.fa-expand:hover {
  max-height: fit-content;
}
</style>
