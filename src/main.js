import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import axios from "axios";

// Axios 인스턴스 생성 및 기본 URL 설정
const axiosInstance = axios.create({
  baseURL: "http://localhost:3000", // 모든 요청에 자동으로 이 URL이 앞에 붙음
});

// 애플리케이션 인스턴스를 생성
const app = createApp(App);

// 생성한 Axios 인스턴스를 전역 속성으로 설정
app.config.globalProperties.$axios = axiosInstance;

// 스토어와 라우터 사용 설정
app.use(store).use(router).mount("#app");
