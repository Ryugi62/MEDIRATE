<template>
  <div id="app">
    <HeaderComponent />

    <div class="container">
      <SlideBarComponent v-if="this.$store.getters.isSlideBarOpen" />

      <div class="content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script>
import SlideBarComponent from "./components/SlideBarComponent.vue";
import HeaderComponent from "./components/HeaderComponent.vue";

export default {
  name: "App",

  components: {
    HeaderComponent,
    SlideBarComponent,
  },
};
</script>

<style>
/* 색 정의 */
:root {
  /* 기본 색상 */
  --white: #ffffff;
  --black: #25313c;
  --black-hover: #15213c;
  --black-active: #05113c;
  --gray: #6d7d8b;
  --light-gray: #e0e0e0;
  --ultra-light-gray: #f5f5f5;

  /* 브랜드 색상 */
  --blue: #2196F3;
  --blue-hover: #1976D2;
  --blue-active: #1565C0;
  --green: #28a745;
  --green-hover: #218838;
  --green-active: #1e7e34;
  --yellow: #ffc107;
  --orange: #ff9800;
  --pink: #e91e63;
  --pink-hover: #c2185b;
  --pink-active: #ad1457;

  /* 시맨틱 색상 - 상태별 */
  --primary-color: #2196F3;
  --primary-hover: #1976D2;
  --primary-active: #1565C0;

  --success-color: #28a745;
  --success-hover: #218838;
  --success-bg: #e8f5e9;

  --danger-color: #dc3545;
  --danger-hover: #c82333;
  --danger-bg: #ffebee;

  --warning-color: #ffc107;
  --warning-hover: #e0a800;
  --warning-bg: #fff8e1;

  --info-color: #17a2b8;
  --info-hover: #138496;
  --info-bg: #e3f2fd;

  /* 텍스트 색상 */
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;

  /* 배경 색상 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;

  /* 테두리 색상 */
  --border-color: #dee2e6;
  --border-light: #e9ecef;
}

* {
  /* border: 1px solid red; */
}

html {
  margin: 0;
  padding: 0;
  outline: 0;
}

body {
  margin: 0;
  padding: 0;
  outline: 0;
}

#app {
  width: 100%;
  color: var(--black);
  margin: 0;
  padding: 0;
  outline: 0;
  min-width: 100%;
}

a {
  color: var(--black);
  text-decoration: none;
}

button {
  background-color: var(--blue);
  color: var(--white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 10px 20px;
  transition: 0.105s;
  white-space: nowrap;
}
button:hover {
  background-color: var(--blue-hover);
}
button:active {
  background-color: var(--blue-active);
}

.container {
  display: flex;
  height: fit-content;
  min-height: calc(100vh - 71px);
}

.content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.exporting-message {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--white);
  font-size: 24px;
  z-index: 100;
}

.loading-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 5vh;
  color: var(--gray);
}
</style>
