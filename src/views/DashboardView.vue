<template>
  <div class="dashboard">
    <h1>Dashboard</h1>
    <p>
      Welcome to your dashboard. Here you can manage your application's
      features.
    </p>

    <!-- 대시보드에 추가할 정보 및 관리 기능 -->
    <div class="dashboard-section">
      <h2>Section 1</h2>
      <p>Details about section 1...</p>
    </div>

    <div class="dashboard-section">
      <h2>Section 2</h2>
      <p>Details about section 2...</p>
    </div>

    <!-- 추가 섹션 및 기능 -->
  </div>
</template>

<script>
export default {
  name: "DashboardView",
};
</script>

<style>
.dashboard {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.dashboard-section {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.dashboard h1 {
  margin-bottom: 15px;
}

.dashboard p {
  font-size: 1em;
  color: #333;
}

/* 추가 스타일링 */
</style>
