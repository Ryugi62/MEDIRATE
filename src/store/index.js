import { createStore } from "vuex";

export default createStore({
  state: {
    // 로커스토리지에 저장된 사용자 정보를 가져옴
    user: JSON.parse(localStorage.getItem("user")) || null,
    isAuthenticated: !!localStorage.getItem("user"), // 사용자가 인증되었는지 여부
    isSlideBarOpen: localStorage.getItem("isSlideBarOpen") === "true" || false,
  },
  getters: {
    isAuthenticated: (state) => !!state.user,
    getUser: (state) => state.user,
    isSlideBarOpen: (state) => state.isSlideBarOpen,
    getJwtToken: (state) => state.user?.token,
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
    },
    openSlideBar(state) {
      state.isSlideBarOpen = true;
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
    },
  },
  modules: {},
});
