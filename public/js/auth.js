import { supabase } from "./supabase.js";

function authState() {
  return {
    session: null,
    async init() {
      const { data } = await supabase.auth.getSession();
      this.session = data.session;
    },
    async logout() {
      await supabase.auth.signOut();
      window.location = "/";
    }
  };
}

function loginForm() {
  return {
    email: "",
    password: "",
    error: "",
    async login() {
      const { error } = await supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password
      });
      if (error) {
        this.error = error.message;
      } else {
        window.location = "/requests.html";
      }
    }
  };
}

window.authState = authState;
window.loginForm = loginForm;
