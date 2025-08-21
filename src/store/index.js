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
    mitofDashboardSearchHistory:
      localStorage.getItem("mitofDashboardSearchHistory") || "",
    tsrDashboardSearchHistory:
      localStorage.getItem("tsrDashboardSearchHistory") || "",
    assignmentCurrentPage:
      parseInt(localStorage.getItem("assignmentCurrentPage")) || 1,
    dashboardCurrentPage:
      parseInt(localStorage.getItem("dashboardCurrentPage")) || 1,
    mitofDashboardCurrentPage:
      parseInt(localStorage.getItem("mitofDashboardCurrentPage")) || 1,
    tsrDashboardCurrentPage:
      parseInt(localStorage.getItem("tsrDashboardCurrentPage")) || 1,
  },
  getters: {
    isAuthenticated: (state) => !!state.user,
    getUser: (state) => state.user,
    isSlideBarOpen: (state) => state.isSlideBarOpen,
    getJwtToken: (state) => state.user?.token,
    tokenExpires: (state) => state.user?.expires,
    getAssignmentSearchHistory: (state) => state.assignmentSearchHistory,
    getDashboardSearchHistory: (state) => state.dashboardSearchHistory,
    getMiTOFDashboardSearchHistory: (state) => state.mitofDashboardSearchHistory,
    getTSRDashboardSearchHistory: (state) => state.tsrDashboardSearchHistory,
    getAssignmentCurrentPage: (state) => state.assignmentCurrentPage,
    getDashboardCurrentPage: (state) => state.dashboardCurrentPage,
    getMiTOFDashboardCurrentPage: (state) => state.mitofDashboardCurrentPage,
    getTSRDashboardCurrentPage: (state) => state.tsrDashboardCurrentPage,
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
    setMiTOFDashboardSearchHistory(state, history) {
      state.mitofDashboardSearchHistory = history;
      localStorage.setItem("mitofDashboardSearchHistory", history);
    },
    setTSRDashboardSearchHistory(state, history) {
      state.tsrDashboardSearchHistory = history;
      localStorage.setItem("tsrDashboardSearchHistory", history);
    },
    setAssignmentCurrentPage(state, page) {
      state.assignmentCurrentPage = page;
      localStorage.setItem("assignmentCurrentPage", page);
    },
    setDashboardCurrentPage(state, page) {
      state.dashboardCurrentPage = page;
      localStorage.setItem("dashboardCurrentPage", page);
    },
    setMiTOFDashboardCurrentPage(state, page) {
      state.mitofDashboardCurrentPage = page;
      localStorage.setItem("mitofDashboardCurrentPage", page);
    },
    setTSRDashboardCurrentPage(state, page) {
      state.tsrDashboardCurrentPage = page;
      localStorage.setItem("tsrDashboardCurrentPage", page);
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
      localStorage.removeItem("mitofDashboardSearchHistory");
      localStorage.removeItem("tsrDashboardSearchHistory");
      localStorage.removeItem("assignmentCurrentPage");
      localStorage.removeItem("dashboardCurrentPage");
      localStorage.removeItem("mitofDashboardCurrentPage");
      localStorage.removeItem("tsrDashboardCurrentPage");
    },
  },
  modules: {},
});
