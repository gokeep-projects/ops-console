<script>
  import { onMount } from "svelte";
  import layout from "./layout.html?raw";
  import { initLegacyApp } from "./legacy-app.js";

  onMount(() => {
    initLegacyApp();
  });
</script>

{@html layout}
