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
          <div
            v-for="(field, fieldName) in assignmentFields"
            :key="fieldName"
            class="assignment-field"
          >
            <label :for="`field-${fieldName}`">{{ field.label }}</label>
            <input
              v-if="field.component === 'input'"
              :id="`field-${fieldName}`"
              :type="field.options?.type"
              v-model="assignmentDetails[field.model]"
            />
            <select
              v-else-if="field.component === 'select'"
              :id="`field-${fieldName}`"
              v-model="assignmentDetails[field.model]"
            >
              <option
                v-for="(option, index) in field.options.values"
                :key="index"
                :value="option"
              >
                {{ field.options.names[index] }}
              </option>
            </select>
          </div>
        </div>
        <hr />
        <div class="assignment-preview">
          <div class="assignment-overview">
            <div class="assignment-metadata">
              <h2 class="metadata-assignment-title">
                {{ assignmentDetails.title }}
              </h2>
              <span class="metadata-student-name">{{ studentName }}</span>
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
                    <template
                      v-if="
                        assignmentDetails.selectedAssignmentType === 'bin' ||
                        assignmentDetails.selectedAssignmentType === 'grade'
                      "
                    >
                      <th
                        v-for="option in assignmentDetails.selectedAssignmentType ===
                        'bin'
                          ? assignmentDetails.gradingScale.bin
                          : assignmentDetails.gradingScale.grade"
                        :key="option"
                      >
                        {{ option }}
                      </th>
                    </template>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="question in assignmentDetails.questions"
                    :key="question.id"
                  >
                    <td><img :src="question.img" /></td>
                    <template
                      v-if="
                        assignmentDetails.selectedAssignmentType === 'bin' ||
                        assignmentDetails.selectedAssignmentType === 'grade'
                      "
                    >
                      <td
                        v-for="item in assignmentDetails.selectedAssignmentType ===
                        'bin'
                          ? assignmentDetails.gradingScale.bin
                          : assignmentDetails.gradingScale.grade"
                        :key="`bin-${question.id}-${item}`"
                      >
                        <input
                          disabled
                          type="radio"
                          :id="`bin-${question.id}-${item}`"
                          :name="`bin-${question.id}`"
                          :value="item"
                          v-model="question.selectValue"
                        />
                        <label :for="`bin-${question.id}-${item}`">{{
                          item
                        }}</label>
                      </td>
                    </template>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="student-response-image">
              <img
                :src="`https://via.placeholder.com/1025x1025.png?text=${assignmentDetails.selectedAssignmentId}`"
                alt="Student Response"
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
export default {
  name: "EditAssignmentView",
  data() {
    return {
      userList: [], // 기존의 userList 초기화
      addedUsers: [],
      maxUserCount: 5,
      searchInput: "",
      assignmentDetails: {
        title: "",
        deadline: "",
        selectedAssignmentId: "",
        selectedAssignmentType: "",
        questions: [],
        gradingScale: {
          bin: ["Unknown", "Negative", "Positive"],
          grade: ["Unknown", "Grade1", "Grade2", "Grade3", "Grade4"],
        },
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
          component: "select",
          model: "selectedAssignmentId",
          options: { values: ["brst", "test"], names: ["BRST", "TEST"] },
        },
        "assignment-type": {
          label: "선택 유형 :",
          component: "select",
          model: "selectedAssignmentType",
          options: { values: ["bin", "grade"], names: ["Bin", "Grade"] },
        },
      },
    };
  },

  mounted() {
    this.fetchUserList();
    this.fetchAssignmentData();
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
    studentName() {
      return "학생 이름";
    },
  },

  methods: {
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
      // 평가자 검색, 과제 제목, 마감일, 과제 ID, 선택 유형이 모두 입력되었는지 확인
      if (
        this.addedUsers.length === 0 ||
        !this.assignmentDetails.title ||
        !this.assignmentDetails.deadline ||
        !this.assignmentDetails.selectedAssignmentId ||
        !this.assignmentDetails.selectedAssignmentType
      ) {
        alert(
          "평가자, 과제 제목, 마감일, 과제 ID, 선택 유형을 모두 입력해주세요."
        );
        return;
      }

      // 마감일이 내일 이상인지 확인
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

      // 모든 input 비활성화
      this.$el.querySelectorAll("input, select").forEach((input) => {
        input.disabled = true;
      });

      // { title, deadline, assignment_type, selection_type, questions, users }
      const newAssignment = {
        id: this.assignmentDetails.id,
        title: this.assignmentDetails.title,
        deadline: this.assignmentDetails.deadline,
        assignment_type: this.assignmentDetails.selectedAssignmentId,
        selection_type: this.assignmentDetails.selectedAssignmentType,
        questions: this.assignmentDetails.questions,
        users: this.addedUsers.map((user) => user.id),
      };

      console.log("새로운 과제 정보", newAssignment);

      this.$axios
        .put(`/api/assignments/${newAssignment.id}`, newAssignment, {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        })
        .then((response) => {
          console.log("새로운 과제 생성 완료:", response.data);

          // 과제 평가 리스트 페이지로 이동
          this.$router.push({ name: "assignment" });
        })
        .catch((error) => {
          console.error("새로운 과제 생성 중 오류 발생:", error);
        });
    },

    generateQuestions(count) {
      console.log(this.assignmentDetails);

      this.assignmentDetails.questions = Array.from(
        { length: count },
        (_, i) => ({
          id: i + 1,
          img: `https://via.placeholder.com/1080x1080.png?text=Q${i + 1}`,
          select: null,
        })
      );
    },

    fetchUserList() {
      // jwt 토큰을 헤더에 추가하여 유저 정보를 가져옵니다.
      this.$axios
        .post("/api/assignments/user-list")
        .then((response) => {
          this.userList = response.data;
        })
        .catch((error) => {
          console.error("유저 정보를 가져오는 중 오류 발생:", error);
        });
    },

    fetchAssignmentData() {
      this.$axios
        .get(`/api/assignments/${this.$route.params.id}/all`, {
          headers: {
            Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
          },
        })
        .then((response) => {
          console.log(response.data);

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
        })
        .catch((error) => {
          console.error("과제 정보를 가져오는 중 오류 발생:", error);
        });
    },
  },

  watch: {
    "assignmentDetails.selectedAssignmentId"(newVal) {
      this.generateQuestions(
        newVal === "test" ? 100 : newVal === "brst" ? 100 : 0
      );
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
  align-items: center;
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
