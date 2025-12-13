import { createRouter, createWebHashHistory } from "vue-router";
import store from "../store/index";
import LoginView from "../views/LoginView.vue";
import BoardView from "../views/BoardView.vue";
import CreatePostView from "../views/CreatePostView.vue";
import EditPostView from "../views/EditPostView.vue";
import PostDetailView from "../views/PostDetailView.vue";
import AssignmentView from "../views/AssignmentView.vue";
import AssignmentDetail from "../views/AssignmentDetailView.vue";
import EvaluationView from "../views/EvaluationView.vue";
import DashboardView from "../views/DashboardView.vue";
import DashboardDetailView from "../views/DashboardDetailView.vue";
import UserManagementView from "../views/UserManagementView.vue";
import ConsensusDetailView from "../views/ConsensusDetailView.vue";

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
    path: "/edit-post/:id", // 게시물 수정 페이지 경로
    name: "edit-post", // 게시물 수정 페이지 이름
    component: EditPostView, // 게시물 수정 컴포넌트
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
    path: "/edit-assignment/:id",
    name: "edit-assignment",
    component: EvaluationView,
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
  {
    path: "/user-management",
    name: "user-management",
    component: UserManagementView,
    meta: { requiresAuth: true },
  },
  {
    path: "/consensus/:id",
    name: "consensusDetail",
    component: ConsensusDetailView,
    meta: { requiresAuth: true },
  },
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
    // 현재 시간과 토큰의 만료 시간을 비교합니다.
    const currentTime = Math.floor(Date.now() / 1000); // 현재 시간을 초 단위로 변환
    const tokenExpires = store.getters.tokenExpires; // 'tokenExpires'는 토큰의 만료 시간을 초 단위로 반환하는 getter입니다.

    // 토큰의 남은 기간을 확인합니다.
    const tokenRemainingTime = tokenExpires - currentTime;

    // 토큰이 만료되었거나, 만료 시간이 매우 임박했을 경우 로그인 페이지로 리다이렉트합니다.
    if (tokenRemainingTime <= 0 || tokenExpires === undefined) {
      alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      store.dispatch("logoutUser"); // 사용자 로그아웃 처리
      next({ name: "login" });
    } else {
      next(); // 토큰이 유효하면 요청한 페이지로 진행
    }
  } else {
    next(); // 인증이 필요하지 않은 페이지에 대한 접근 허용
  }
});

export default router;
