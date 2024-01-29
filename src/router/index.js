import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import AboutView from "../views/AboutView.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import BoardView from "../views/BoardView.vue";
import TaskView from "../views/TaskView.vue";
import EvaluationView from "../views/EvaluationView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/about",
    name: "about",
    component: AboutView,
  },
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
    // 메타 필드를 사용하여 이 라우트가 인증이 필요함을 나타냄
    meta: { requiresAuth: true },
  },
  {
    path: "/board",
    name: "board",
    component: BoardView,
  },
  {
    path: "/tasks",
    name: "tasks",
    component: TaskView,
    meta: { requiresAuth: true },
  },
  {
    path: "/evaluation",
    name: "evaluation",
    component: EvaluationView,
    meta: { requiresAuth: true },
  },
  // 추가적인 라우트는 여기에 정의합니다.
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 라우터 네비게이션 가드를 추가하여 인증이 필요한 페이지에 접근할 때 인증 여부를 확인할 수 있음
router.beforeEach((to, from, next) => {
  // 'requiresAuth' 메타 필드가 있는 라우트를 확인하고 인증 상태를 확인하는 로직 추가
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    // 여기에 인증 확인 로직 추가 (예: 로그인 상태 확인)
    // 인증되지 않았으면 로그인 페이지로 리디렉션
    next({ name: "login" });
  } else {
    // 인증이 필요없는 페이지라면 바로 이동
    next();
  }
});

export default router;
