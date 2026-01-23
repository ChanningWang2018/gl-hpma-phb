import "@/assets/styles/global.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { createHead } from "@vueuse/head";
import App from "./App.vue";
import router from "@/router/index.js";

const app = createApp(App);
const head = createHead();
app.use(createPinia());
app.use(router);
app.use(head);
app.mount("#app");
