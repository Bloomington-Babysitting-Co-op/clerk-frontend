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

// Alpine needs these on window
window.authState = authState;
window.loginForm = loginForm;

// Guard for pages that require auth
export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location = "/login.html";
  }
  return data.session;
}
