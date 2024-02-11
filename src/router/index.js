import { createRouter, createWebHashHistory } from "vue-router";
import store from "../store/index";
import LoginView from "../views/LoginView.vue";
import BoardView from "../views/BoardView.vue";
import CreatePostView from "../views/CreatePostView.vue";
import PostDetailView from "../views/PostDetailView.vue";
import AssignmentView from "../views/AssignmentView.vue";
import AssignmentDetail from "../views/AssignmentDetailView.vue";
import EvaluationView from "../views/EvaluationView.vue";
import DashboardView from "../views/DashboardView.vue";
import DashboardDetailView from "../views/DashboardDetailView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: BoardView,
    meta: { requiresAuth: true },
  },
  {
    path: "/login",
    name: "login",
    component: LoginView,
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
    path: "/assignment",
    name: "assignment",
    component: AssignmentView,
    meta: { requiresAuth: true },
  },
  {
    path: "/assignment/:id",
    name: "assignmentDetail",
    component: AssignmentDetail,
    meta: { requiresAuth: true },
  },
  {
    path: "/evaluation",
    name: "evaluation",
    component: EvaluationView,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/:id",
    name: "dashboardDetail",
    component: DashboardDetailView,
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
