// src/store/index.js

import { createStore } from "vuex";

export default createStore({
  state: {
    // 로컬스토리지에 저장된 사용자 정보를 가져옴
    user: JSON.parse(localStorage.getItem("user")) || null,
    isAuthenticated: !!localStorage.getItem("user"), // 사용자가 인증되었는지 여부
    isSlideBarOpen: localStorage.getItem("isSlideBarOpen") === "true" || false,
    assignmentSearchHistory:
      localStorage.getItem("assignmentSearchHistory") || "",
    dashboardSearchHistory:
      localStorage.getItem("dashboardSearchHistory") || "",
    assignmentCurrentPage:
      parseInt(localStorage.getItem("assignmentCurrentPage")) || 1,
    dashboardCurrentPage:
      parseInt(localStorage.getItem("dashboardCurrentPage")) || 1, // 추가
    // 정렬 상태 유지
    assignmentSortColumn: localStorage.getItem("assignmentSortColumn") || "id",
    assignmentSortDirection: localStorage.getItem("assignmentSortDirection") || "down",
    // 열린 과제 ID 목록 (새 탭에서 열린 과제 표시용)
    openedAssignments: JSON.parse(localStorage.getItem("openedAssignments")) || [],
    // 대시보드 필터 상태
    dashboardFilterProjectId: JSON.parse(localStorage.getItem("dashboardFilterProjectId")),
    dashboardFilterCancerId: JSON.parse(localStorage.getItem("dashboardFilterCancerId")),
    dashboardFilterMode: localStorage.getItem("dashboardFilterMode") || null,
    dashboardSelectedMode: localStorage.getItem("dashboardSelectedMode") || "all",
    dashboardSelectedTag: localStorage.getItem("dashboardSelectedTag") || "all",
    dashboardSliderValue: parseInt(localStorage.getItem("dashboardSliderValue")) || 1,
    dashboardScoreValue: parseInt(localStorage.getItem("dashboardScoreValue")) || 50,
    dashboardSortColumn: localStorage.getItem("dashboardSortColumn") || "id",
    dashboardSortDirection: localStorage.getItem("dashboardSortDirection") || "down",
  },
  getters: {
    isAuthenticated: (state) => !!state.user,
    getUser: (state) => state.user,
    isSlideBarOpen: (state) => state.isSlideBarOpen,
    getJwtToken: (state) => state.user?.token,
    tokenExpires: (state) => state.user?.expires,
    getAssignmentSearchHistory: (state) => state.assignmentSearchHistory,
    getDashboardSearchHistory: (state) => state.dashboardSearchHistory,
    getAssignmentCurrentPage: (state) => state.assignmentCurrentPage,
    getDashboardCurrentPage: (state) => state.dashboardCurrentPage, // 추가
    getAssignmentSortColumn: (state) => state.assignmentSortColumn,
    getAssignmentSortDirection: (state) => state.assignmentSortDirection,
    getOpenedAssignments: (state) => state.openedAssignments,
    // 대시보드 필터 상태 getters
    getDashboardFilterProjectId: (state) => state.dashboardFilterProjectId,
    getDashboardFilterCancerId: (state) => state.dashboardFilterCancerId,
    getDashboardFilterMode: (state) => state.dashboardFilterMode,
    getDashboardSelectedMode: (state) => state.dashboardSelectedMode,
    getDashboardSelectedTag: (state) => state.dashboardSelectedTag,
    getDashboardSliderValue: (state) => state.dashboardSliderValue,
    getDashboardScoreValue: (state) => state.dashboardScoreValue,
    getDashboardSortColumn: (state) => state.dashboardSortColumn,
    getDashboardSortDirection: (state) => state.dashboardSortDirection,
  },
  mutations: {
    setAuthenticated(state, isAuthenticated) {
      state.isAuthenticated = isAuthenticated;
    },
    setUser(state, user) {
      state.user = user;
    },
    clearUser(state) {
      state.user = null;
    },
    toggleSlideBar(state) {
      state.isSlideBarOpen = !state.isSlideBarOpen;
      localStorage.setItem("isSlideBarOpen", state.isSlideBarOpen);
    },
    closeSlideBar(state) {
      state.isSlideBarOpen = false;
      localStorage.setItem("isSlideBarOpen", state.isSlideBarOpen);
    },
    openSlideBar(state) {
      state.isSlideBarOpen = true;
      localStorage.setItem("isSlideBarOpen", state.isSlideBarOpen);
    },
    setAssignmentSearchHistory(state, history) {
      state.assignmentSearchHistory = history;
      localStorage.setItem("assignmentSearchHistory", history);
    },
    setDashboardSearchHistory(state, history) {
      state.dashboardSearchHistory = history;
      localStorage.setItem("dashboardSearchHistory", history);
    },
    setAssignmentCurrentPage(state, page) {
      state.assignmentCurrentPage = page;
      localStorage.setItem("assignmentCurrentPage", page);
    },
    setDashboardCurrentPage(state, page) {
      // 추가
      state.dashboardCurrentPage = page;
      localStorage.setItem("dashboardCurrentPage", page);
    },
    setAssignmentSortColumn(state, column) {
      state.assignmentSortColumn = column;
      localStorage.setItem("assignmentSortColumn", column);
    },
    setAssignmentSortDirection(state, direction) {
      state.assignmentSortDirection = direction;
      localStorage.setItem("assignmentSortDirection", direction);
    },
    addOpenedAssignment(state, assignmentId) {
      // 마지막 하나만 유지
      state.openedAssignments = [assignmentId];
      localStorage.setItem("openedAssignments", JSON.stringify(state.openedAssignments));
    },
    removeOpenedAssignment(state, assignmentId) {
      state.openedAssignments = state.openedAssignments.filter(id => id !== assignmentId);
      localStorage.setItem("openedAssignments", JSON.stringify(state.openedAssignments));
    },
    clearOpenedAssignments(state) {
      state.openedAssignments = [];
      localStorage.removeItem("openedAssignments");
    },
    // 대시보드 필터 상태 mutations
    setDashboardFilterProjectId(state, projectId) {
      state.dashboardFilterProjectId = projectId;
      localStorage.setItem("dashboardFilterProjectId", JSON.stringify(projectId));
    },
    setDashboardFilterCancerId(state, cancerId) {
      state.dashboardFilterCancerId = cancerId;
      localStorage.setItem("dashboardFilterCancerId", JSON.stringify(cancerId));
    },
    setDashboardFilterMode(state, mode) {
      state.dashboardFilterMode = mode;
      localStorage.setItem("dashboardFilterMode", mode);
    },
    setDashboardSelectedMode(state, mode) {
      state.dashboardSelectedMode = mode;
      localStorage.setItem("dashboardSelectedMode", mode);
    },
    setDashboardSelectedTag(state, tag) {
      state.dashboardSelectedTag = tag;
      localStorage.setItem("dashboardSelectedTag", tag);
    },
    setDashboardSliderValue(state, value) {
      state.dashboardSliderValue = value;
      localStorage.setItem("dashboardSliderValue", value);
    },
    setDashboardScoreValue(state, value) {
      state.dashboardScoreValue = value;
      localStorage.setItem("dashboardScoreValue", value);
    },
    setDashboardSortColumn(state, column) {
      state.dashboardSortColumn = column;
      localStorage.setItem("dashboardSortColumn", column);
    },
    setDashboardSortDirection(state, direction) {
      state.dashboardSortDirection = direction;
      localStorage.setItem("dashboardSortDirection", direction);
    },
  },
  actions: {
    loginUser({ commit }, user) {
      // 사용자 정보를 저장하고 로그인
      commit("setUser", user);

      // 유저 정보 저장
      localStorage.setItem("user", JSON.stringify(user));

      // 인증 상태를 true로 변경
      commit("setAuthenticated", true);
    },
    logoutUser({ commit }) {
      // 사용자 정보를 지우고 로그아웃
      commit("clearUser");

      // 인증 상태를 false로 변경
      commit("setAuthenticated", false);

      // 로컬 스토리지에서 사용자 정보 삭제
      localStorage.removeItem("user");
      localStorage.removeItem("assignmentSearchHistory");
      localStorage.removeItem("dashboardSearchHistory");
      localStorage.removeItem("assignmentCurrentPage");
      localStorage.removeItem("dashboardCurrentPage"); // 추가
      localStorage.removeItem("assignmentSortColumn");
      localStorage.removeItem("assignmentSortDirection");
      localStorage.removeItem("openedAssignments");
      // 대시보드 필터 상태 삭제
      localStorage.removeItem("dashboardFilterProjectId");
      localStorage.removeItem("dashboardFilterCancerId");
      localStorage.removeItem("dashboardFilterMode");
      localStorage.removeItem("dashboardSelectedMode");
      localStorage.removeItem("dashboardSelectedTag");
      localStorage.removeItem("dashboardSliderValue");
      localStorage.removeItem("dashboardScoreValue");
      localStorage.removeItem("dashboardSortColumn");
      localStorage.removeItem("dashboardSortDirection");
    },
  },
  modules: {},
});
