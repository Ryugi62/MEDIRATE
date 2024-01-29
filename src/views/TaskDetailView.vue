<template>
  <div class="task-detail">
    <h1>Task Detail</h1>
    <div v-if="task">
      <h2>{{ task.title }}</h2>
      <p>{{ task.description }}</p>
      <!-- 여기에 추가적인 과제 정보 표시 -->

      <!-- taskId -->
      <p>Task ID: {{ $route.params.id }}</p>
    </div>
    <div v-else>
      <p>Loading task details...</p>
    </div>
  </div>
</template>

<script>
export default {
  name: "TaskDetailView",
  data() {
    return {
      task: null,
    };
  },
  created() {
    this.fetchTaskDetail();
  },
  methods: {
    fetchTaskDetail() {
      // const taskId = this.$route.params.id;
      // 여기에 API 호출 로직을 추가하여 과제 정보를 가져옵니다.
      // 예: axios.get(`/api/tasks/${taskId}`).then(response => { ... })

      // 임시 데이터
      this.task = {
        title: "Sample Task",
        description: "This is a sample task description.",
      };
    },
  },
};
</script>

<style>
.task-detail {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.task-detail h1 {
  margin-bottom: 20px;
}

/* 추가 스타일링 */
</style>
