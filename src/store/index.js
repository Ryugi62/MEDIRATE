import { createStore } from "vuex";

export default createStore({
  state: {
    user: null, // 초기에는 로그인하지 않은 상태이므로 null로 초기화
    isAuthenticated: false, // 초기에는 로그인하지 않은 상태이므로 false로 초기화
    isSlideBarOpen: false, // 초기에는 사이드바가 닫힌 상태이
  },
  getters: {
    isAuthenticated: (state) => !!state.user,
    getUser: (state) => state.user,
    isSlideBarOpen: (state) => state.isSlideBarOpen,
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
    },
  },
  actions: {
    loginUser({ commit }, user) {
      console.log(user);

      // 사용자 정보를 저장하고 로그인
      commit("setUser", user);

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
