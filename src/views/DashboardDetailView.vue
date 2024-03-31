<template>
  <div class="dashboard" v-if="data.length">
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
                <tr
                  v-for="(item, index) in data[0].questions"
                  :key="index"
                  :class="{ active: index === activeIndex }"
                  @click="setActiveImage(item.questionImage, index)"
                >
                  <td>
                    <img :src="item.questionImage" alt="과제 이야기 이미지" />
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
            <ImageComponent
              v-if="assignmentMode === 'TextBox'"
              :src="activeImageUrl"
            />

            <BBoxViewerComponent
              v-else
              :src="activeImageUrl"
              :questionIndex="activeIndex"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="loading-message">
    <p>과제를 불러오는 중입니다...</p>
  </div>
</template>

<script>
import ImageComponent from "@/components/ImageComponent.vue";
import BBoxViewerComponent from "@/components/BBoxViewerComponent.vue";

export default {
  name: "DashboardDetailView",

  components: {
    ImageComponent,
    BBoxViewerComponent,
  },

  data() {
    return {
      data: [], // This will hold your users and their question data
      activeImageUrl: "https://via.placeholder.com/1050", // 기본 이미지 URL 설정
      assignmentId: this.$route.params.id,
      activeIndex: 0,
    };
  },

  created() {
    this.loadData();
  },

  methods: {
    async loadData() {
      try {
        const response = await this.$axios.get(
          `/api/dashboard/${this.assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.$store.getters.getJwtToken}`,
            },
          }
        );

        this.assignmentMode = response.data.assignmentMode;
        this.data = response.data.assignemnt; // Assuming the response has the data in { data: { data: [...] } } format
        this.activeImageUrl = this.data[0].questions[0].questionImage;
      } catch (error) {
        console.error("Failed to load data:", error);
        // Handle error, perhaps show a user-friendly message
      }
    },

    moveToAssignmentManagement() {
      this.$router.push(`/edit-assignment/${this.assignmentId}`);
    },

    setActiveImage(imageUrl, index) {
      this.activeImageUrl = imageUrl;

      this.activeIndex = index;
    },
  },

  computed: {
    completedPercentage() {
      if (!this.data.length) return 0;

      const totalAnswered = this.data.reduce(
        (acc, user) => acc + user.answeredCount,
        0
      );
      const totalUnanswered = this.data.reduce(
        (acc, user) => acc + user.unansweredCount,
        0
      );
      const totalQuestions = totalAnswered + totalUnanswered;

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

tr.active {
  color: var(--white);
  background-color: var(--blue);
}
w td {
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
  width: 100%;
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
