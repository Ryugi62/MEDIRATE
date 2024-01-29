<template>
  <div class="evaluation-container">
    <h1>Evaluation</h1>
    <div v-if="tasks.length">
      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id">
          <h3>{{ task.title }}</h3>
          <!-- 평가를 위한 버튼 또는 링크 -->
          <button @click="evaluateTask(task.id)">Evaluate</button>
        </li>
      </ul>
    </div>
    <div v-else>
      <p>No tasks available for evaluation.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: "EvaluationView",
  data() {
    return {
      tasks: [
        // 임시 데이터
        { id: 1, title: "Task 1" },
        { id: 2, title: "Task 2" },
        // ...
      ],
    };
  },
  methods: {
    evaluateTask(taskId) {
      // 평가 페이지로 이동 또는 평가 모달을 여는 로직
      console.log("Evaluating task:", taskId);
      // 예시: this.$router.push(`/evaluate/${taskId}`);
    },
  },
};
</script>

<style>
.evaluation-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.task-list {
  list-style: none;
  padding: 0;
}

.task-list li {
  margin-bottom: 15px;
}

.task-list h3 {
  margin-bottom: 5px;
}

/* 기타 스타일 */
</style>
