<template>
  <!-- 상세 페이지 컨테이너 -->
  <div class="assignment-detail-container">
    <!-- 제목 -->
    <h2 class="detail-title">{{ assignment.title }}</h2>

    <!-- 생성 및 종료일 -->
    <div class="detail-dates">
      <p><strong>생성일:</strong> {{ assignment.creationDate }}</p>
      <p><strong>종료일:</strong> {{ assignment.dueDate }}</p>
    </div>

    <!-- 내용 -->
    <div class="detail-content">
      <p>{{ assignment.content }}</p>
    </div>

    <!-- 수정 버튼 -->
    <button @click="editMode = true" v-if="!editMode">수정</button>

    <!-- 수정 폼 -->
    <form @submit.prevent="saveChanges" v-if="editMode">
      <label for="title">제목:</label>
      <input type="text" id="title" v-model="editedAssignment.title" required />

      <label for="content">내용:</label>
      <textarea
        id="content"
        v-model="editedAssignment.content"
        required
      ></textarea>

      <label for="dueDate">종료일:</label>
      <input
        type="date"
        id="dueDate"
        v-model="editedAssignment.dueDate"
        required
      />

      <button type="submit">저장</button>
      <button @click="cancelEdit">취소</button>
    </form>
  </div>
</template>

<script>
export default {
  name: "AssignmentDetail",
  data() {
    return {
      assignment: null,
      editedAssignment: {
        title: "",
        content: "",
        dueDate: "",
      },
      editMode: false,
    };
  },
  created() {
    // 과제 정보를 가져오는 API 호출
    const assignmentId = this.$route.params.id;
    this.fetchAssignment(assignmentId);
  },
  methods: {
    fetchAssignment(id) {
      // 과제 정보를 가져오는 API 호출
      // 예시: axios.get(`/api/assignments/${id}`)
      //   .then(response => {
      //     this.assignment = response.data;
      //     this.editedAssignment = { ...this.assignment };
      //   })
      //   .catch(error => {
      //     console.error('Error fetching assignment:', error);
      //   });

      // 임시 데이터
      this.assignment = {
        id: id,
        title: "과제 제목",
        creationDate: "2024-02-08",
        dueDate: "2024-02-15",
        content: "과제 내용을 여기에 입력하세요.",
      };
      this.editedAssignment = { ...this.assignment };
    },
    saveChanges() {
      // 수정된 과제 정보를 저장하는 API 호출
      // 예시: axios.put(`/api/assignments/${this.assignment.id}`, this.editedAssignment)
      //   .then(response => {
      //     this.assignment = response.data;
      //     this.editMode = false;
      //   })
      //   .catch(error => {
      //     console.error('Error saving assignment changes:', error);
      //   });

      // 임시: 수정 모드를 종료하고 수정 내용을 적용
      this.assignment = { ...this.editedAssignment };
      this.editMode = false;
    },
    cancelEdit() {
      // 수정 취소 시 수정 모드를 종료하고 원래 과제 정보로 돌아감
      this.editMode = false;
      this.editedAssignment = { ...this.assignment };
    },
  },
};
</script>

<style scoped>
.detail-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.detail-dates {
  margin-bottom: 20px;
}

.detail-content {
  margin-bottom: 20px;
}

.detail-content p {
  white-space: pre-line; /* 줄 바꿈을 보존하기 위해 */
}

button {
  margin-right: 10px;
}
</style>
