import { createRouter, createWebHashHistory } from "vue-router";
import store from "../store/index";
import HomeView from "../views/HomeView.vue";
import CreatePostView from "../views/CreatePostView.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import BoardView from "../views/BoardView.vue";
import PostDetailView from "../views/PostDetailView.vue";
import TaskView from "../views/TaskView.vue";
import TaskDetailView from "../views/TaskDetailView.vue";
import EvaluationView from "../views/EvaluationView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: { requiresAuth: true },
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
    meta: { requiresAuth: true },
  },
  {
    path: "/create-post", // 게시물 생성 페이지 경로
    name: "create-post", // 게시물 생성 페이지 이름
    component: CreatePostView, // 게시물 생성 컴포넌트
    meta: { requiresAuth: true }, // 인증이 필요한지 여부
  },
  {
    path: "/post/:id",
    name: "post",
    component: PostDetailView, // 상세 페이지 컴포넌트
    meta: { requiresAuth: true },
  },

  {
    path: "/tasks",
    name: "tasks",
    component: TaskView,
    meta: { requiresAuth: true },
  },
  {
    path: "/task/:id",
    name: "taskDetail",
    component: TaskDetailView, // 세부사항 페이지 컴포넌트
    meta: { requiresAuth: true },
  },
  {
    path: "/evaluation",
    name: "evaluation",
    component: EvaluationView,
    meta: { requiresAuth: true },
  },
  // 추가적인 라우트는 여기에 정의합니다.
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("../views/NotFoundView.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: "smooth" };
  },
});

router.beforeEach((to, from, next) => {
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    // 여기에서 Vuex Store의 상태를 확인하여 인증 상태를 확인합니다.
    if (!store.getters.isAuthenticated) {
      // 인증되지 않았으면 로그인 페이지로 리디렉션
      next({ name: "login" });
    } else {
      // 인증된 상태라면 다음으로 이동
      next();
    }
  } else {
    // 인증이 필요하지 않은 페이지라면 바로 이동
    next();
  }
});

export default router;
