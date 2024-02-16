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
    const test = new Date() / 1000;

    if (store.getters.isTokenExpired < test) {
      alert("로그인이 만료되었습니다. 다시 로그인해주세요.");

      store.dispatch("logoutUser");

      next({ name: "login" });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
