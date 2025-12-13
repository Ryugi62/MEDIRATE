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
  --white: #ffffff;
  --black: #25313c;
  --black-hover: #15213c;
  --black-active: #05113c;
  --gray: #6d7d8b;
  --light-gray: #bbc8d4;
  --ultra-light-gray: #bbc8d4;
  --green: #00c04d;
  --green-hover: #00b03d;
  --green-active: #00a02d;
  --yellow: #ffbb00;
  --pink: #ed455d;
  --pink-hover: #dd355d;
  --pink-active: #cd255d;
  --blue: #5a4ff3;
  --blue-hover: #4a3ff3;
  --blue-active: #3a2ff3;
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
  width: fit-content;
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
