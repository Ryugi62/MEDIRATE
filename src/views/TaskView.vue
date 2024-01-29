<template>
  <div class="task-view">
    <h1>Task Management</h1>
    <div class="task-list">
      <h2>Current Tasks</h2>
      <!-- 과제 목록 표시 영역 -->
      <ul>
        <li v-for="task in tasks" :key="task.id">
          {{ task.title }}
          <!-- 과제 세부사항 보기 또는 편집 링크 -->
          <router-link :to="{ name: 'taskDetail', params: { id: task.id } }"
            >View Details</router-link
          >
        </li>
      </ul>
    </div>

    <!-- 과제 추가 기능 구현 부분 -->
    <!-- 예: <button @click="addTask">Add New Task</button> -->
  </div>
</template>

<script>
export default {
  name: "TaskView",
  data() {
    return {
      // 임시 과제 데이터
      tasks: [
        { id: 1, title: "Task 1" },
        { id: 2, title: "Task 2" },
        // ...
      ],
    };
  },
  methods: {
    // 과제 추가 및 관리 관련 메서드
  },
};
</script>

<style>
.task-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.task-list ul {
  list-style: none;
  padding: 0;
}

.task-list li {
  margin-bottom: 10px;
}

/* 추가 스타일링 */
</style>
