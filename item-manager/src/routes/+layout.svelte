<script lang="ts">
	import '../app.css';
	import { Toast, Vignette } from '@hyvnt/hyvui';
</script>

<Vignette />
<Toast position="bottom-right" />

<div
	style="min-height: 100dvh; background: var(--bg); padding: 0;"
>
	<slot />
</div>
