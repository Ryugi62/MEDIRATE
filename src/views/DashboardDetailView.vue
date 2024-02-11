<template>
  <div class="dashboard">
    <h1 class="title">대시보드</h1>
    <div class="dashboard-content">
      <div class="table-box">
        <div class="table-header">
          <span class="table-title">과제 이야기</span>
          <span class="completed-status"
            ><strong>{{ completedPercentage }}%</strong> / 100%</span
          >
          <button class="edit-button" @click="moveToAssignmentManagement">
            수정
          </button>
        </div>
        <div class="table-body">
          <div class="table-section">
            <table class="assignment-table">
              <thead class="table-head">
                <tr>
                  <th>문번</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in data[0].questions" :key="index">
                  <td>
                    <img
                      src="https://via.placeholder.com/1050"
                      alt="과제 이야기 이미지"
                    />
                  </td>
                  <td v-for="person in data" :key="person.name">
                    {{ person.questions[index].questionSelection }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-footer">
                <tr>
                  <th>답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.answeredCount }}
                  </th>
                </tr>
                <tr>
                  <th>미답변</th>
                  <th v-for="person in data" :key="person.name">
                    {{ person.unansweredCount }}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="image-box">
            <img
              src="https://via.placeholder.com/1050"
              alt="과제 이야기 이미지"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "DashboardDetailView",
  data() {
    return {
      data: [], // This will hold your users and their question data
    };
  },
  created() {
    this.loadData();
  },
  methods: {
    loadData() {
      const names = ["홍길동", "김미숙", "박동규", "박세훈", "김진우"];
      this.data = names.map((name) => {
        let answeredCount = 0;
        let unansweredCount = 0;
        const questions = Array.from({ length: 1000 }, (_, i) => {
          const questionSelection = Math.floor(Math.random() * 4) - 1; // Randomly assign -1, 0, 1, 2
          if (questionSelection === -1) {
            unansweredCount += 1;
          } else {
            answeredCount += 1;
          }
          return {
            questionId: i + 1,
            questionImage: "이미지경로",
            questionSelection: questionSelection,
          };
        });

        return {
          name,
          answeredCount,
          unansweredCount,
          questions,
        };
      });
    },

    moveToAssignmentManagement() {
      // Implement the logic for when the "수정" button is clicked
      // For example, navigating to an assignment management page or showing a form
      console.log("Move to assignment management");
    },
  },

  computed: {
    completedPercentage() {
      if (!this.data.length) return 0; // 데이터가 없을 경우 0을 반환합니다.

      // 모든 사용자의 답변한 문제 수와 미답변 문제 수의 총합을 계산합니다.
      const totalAnswered = this.data.reduce(
        (acc, user) => acc + user.answeredCount,
        0
      );
      const totalUnanswered = this.data.reduce(
        (acc, user) => acc + user.unansweredCount,
        0
      );

      // 전체 문제 수는 답변한 문제 수와 미답변 문제 수의 합입니다.
      const totalQuestions = totalAnswered + totalUnanswered;

      // 전체 완료율을 계산합니다. 전체 문제 수가 0이 아닌 경우에만 계산을 수행합니다.
      return totalQuestions > 0
        ? ((totalAnswered / totalQuestions) * 100).toFixed(2)
        : 0;
    },
  },
};
</script>

<style scoped>
.dashboard {
  /* border: 1px solid red; */
}

.title {
  font-size: 24px;
  height: 60px;
  display: flex;
  align-items: center;
  padding-left: 24px;
  font-weight: 500;
  margin: 0;
  border-bottom: 1px solid var(--light-gray);
}

.table-header {
  height: 60px;
  display: flex;
  padding-left: 24px;
  padding-right: 46px;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--light-gray);
}

.table-title {
  font-weight: bold;
  margin: 0;
  padding: 0;
}

.completed-status {
  margin-left: auto;
  font-size: 14px;
}

.completed-status > strong {
  color: var(--blue);
  font-size: 20px;
}

.table-body {
  display: flex;
  gap: 16px;
}

.table-section {
  max-height: 710px;
  overflow-y: auto;
}

.assignment-table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}

td {
  text-align: center;
  padding: 4px 8px;
  width: 70px;
}

td > img {
  width: 25px;
}

.image-box {
  flex: 1;
  display: flex;
  margin-right: 46px;
}

.image-box > img {
  margin: auto;
  object-fit: contain;
  max-height: 710px;
}

.table-head {
  position: sticky;
  top: 0;
  background-color: var(--white);
}

.table-footer {
  position: sticky;
  bottom: 0;
  background-color: var(--white);
}
</style>
